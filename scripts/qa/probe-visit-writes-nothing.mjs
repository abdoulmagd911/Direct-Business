/* probe-visit-writes-nothing.mjs (2026-09-09, live test finding N2) — looking at a page is not a
   change: opening cards and switching pages sends no save to the cloud. Attack area (ad).

   PORT NOTE: 8701–8760 are taken. This is 8761, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: opening the app, and then a card, with nothing changed made
   the pill say "Saving… / Saved to cloud". Two causes, measured here on the wire:
     · js/53 appended a "sign in" line to DB.audit — an array nothing has read since js/63 pointed
       Activity & Audit at record_history — and called save() on every load, which js/02 turns
       into a save_state_patch carrying seven sections;
     · core-06's "Recently visited" pushed every render of a detail page into DB.recents (the
       shared workspace blob, one list for the whole team) and called the base save() — a local
       write per glance, and the blob section then rode along with the next cloud save.
   The sign-in save is retired; the list now lives per person in the browser and a visit writes
   nothing.

   Under test (counted on the wire, at the point Playwright hands requests to the mock):
     0. Opening the app and signing in, then 26 s of nothing → no cloud write (js/53 used to
        append a 'sign in' line to the dead DB.audit array and save it on every load).
     1. After the app has settled (js/35's 20 s re-assert window included), open a lead card, go
        to Today, open a client card, open Operations, open a proposal, come back to Today →
        zero save_state / save_state_patch calls and zero writes to businesses.
     2. Control: a real change (a note logged on the lead) DOES produce a save — the counter is
        wired to the right thing.
     3. "Recently visited" on Today still lists what was just opened (the feature survived the
        move) and is read from the browser, not from DB.recents.

   Run:  node scripts/qa/probe-visit-writes-nothing.mjs        (port 8761)
   Sabotage: in core-06 pushRecent add `save();` back at the end — check 1 goes red (a save per
   visit); in js/53 put the sign-in `save()` back — check 0 goes red. Assert the sabotage APPLIED with a marker unique to it; confirm the restore by marker
   count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8761;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT, { app_offers: [{ id: 'o-visit', data: { id: 'o-visit', ref: 'PR-VISIT', client: 'Quill Meadow Probe', proposalType: 'Travel — flights', subject: 'visit probe', status: 'Draft', date: new Date().toISOString().slice(0, 10), currency: 'SAR' } }] });
const BASE = 'http://localhost:' + PORT;
const W = { saves: 0, biz: 0, log: [] };
let counting = false;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (counting) {
      if (/\/rest\/v1\/rpc\/save_state/.test(u.pathname)) { W.saves++; W.log.push('rpc ' + u.pathname.split('/').pop()); }
      if (/\/rest\/v1\/businesses/.test(u.pathname) && !['GET', 'HEAD'].includes(rq.method())) { W.biz++; W.log.push(rq.method() + ' businesses'); }
    }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true && Array.isArray(DB.offers) && DB.offers.some((o) => o.id === 'o-visit'), { timeout: 90000 }).catch(() => fail('the app never settled'));
  /* ---- 0. opening the app is not a change either ---- */
  W.saves = 0; W.biz = 0; W.log = []; counting = true;
  await p.waitForTimeout(26000);   // js/35 re-asserts table copies for ~20 s after load; anything start-up wants to write, it writes in here
  counting = false;
  if (W.saves === 0 && W.biz === 0) ok('opening the app and signing in, then 26 s of nothing: no cloud write');
  else fail(`opening the app wrote to the cloud with nothing changed: ${W.log.join(', ')} — js/53's retired "sign in" save`);
  const ids = await p.evaluate(() => ({ lead: (DB.businesses.find((x) => !x.isClient) || {}).id, client: (DB.businesses.find((x) => x.isClient) || {}).id }));

  /* ---- 1. a tour with nothing changed ---- */
  W.saves = 0; W.biz = 0; W.log = []; counting = true;
  const go = async (fn, arg) => { await p.evaluate(fn, arg); await p.waitForTimeout(2500); };
  await go((id) => { openLead = id; current = 'leads'; render(); }, ids.lead);
  await go(() => { openLead = null; current = 'today'; render(); });
  await go((id) => { openLead = id; current = 'leads'; render(); }, ids.client);
  await go(() => { openLead = null; current = 'ops'; render(); });
  await go(() => { current = 'offers'; openOffer = 'o-visit'; render(); });
  await go(() => { openOffer = null; current = 'today'; render(); });
  await p.waitForTimeout(3000);
  counting = false;
  if (W.saves === 0 && W.biz === 0) ok('six page visits with nothing changed: no save_state call, no write to businesses');
  else fail(`visits wrote to the cloud: ${W.saves} save_state call(s), ${W.biz} businesses write(s) — ${W.log.slice(0, 6).join(', ')} — the live-site "Saving…" on a glance`);

  /* ---- 3. Recently visited survived the move ---- */
  const rec = await p.evaluate(() => {
    const el = document.querySelector('#view .v19-recents');
    let local = null; try { local = JSON.parse(localStorage.getItem('db_recents') || 'null'); } catch (_) { }
    return { shown: el ? el.innerText.replace(/\s+/g, ' ').trim() : null, local: Array.isArray(local) ? local.map((r) => r.kind + ':' + r.id) : null, blob: Array.isArray(DB.recents) ? DB.recents.length : 0 };
  });
  if (rec.local && rec.local[0] === 'offer:o-visit' && rec.local.some((x) => x === 'lead:' + ids.lead) && rec.shown && /PR-VISIT|visit probe/.test(rec.shown)) ok(`"Recently visited" still works, read from this browser: ${rec.local.slice(0, 3).join(', ')}`);
  else fail(`Recently visited: ${JSON.stringify(rec)}`);

  /* ---- 2. control: a real change still saves ---- */
  W.saves = 0; W.biz = 0; W.log = []; counting = true;
  await p.evaluate((id) => { const l = DB.businesses.find((x) => x.id === id); l.activities = l.activities || []; l.activities.push({ date: Date.now(), type: 'Note', note: 'visit-probe control', by: 'QA' }); save(); }, ids.lead);
  await p.waitForTimeout(4000);
  counting = false;
  if (W.saves + W.biz > 0) ok(`control: a real change produced ${W.saves} save_state call(s) and ${W.biz} businesses write(s) — the counter is wired`);
  else fail('control: a real change produced no cloud write — the counter is not measuring saves');

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nvisit-writes-nothing OK — looking is not changing');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
