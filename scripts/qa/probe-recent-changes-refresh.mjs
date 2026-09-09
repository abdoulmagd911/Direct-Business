/* probe-recent-changes-refresh.mjs (2026-09-09, live test finding A3) — the "Recent changes" card
   on a company card re-reads the log once a save has actually landed. Attack area (ad).

   PORT NOTE: 8701–8766 are taken. This is 8767, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: "Recent changes" said "No logged changes yet" straight after a
   save. The card is drawn by the render() that follows a save, but the row it looks for is
   written by the database trigger when the cloud save lands about a second later; nothing
   re-read the card. js/63 now chains js/02's status pill and re-reads the card when it says
   "Saved…".

   The harness cannot run the live trigger, so the row is planted the way the trigger would
   write it, and the pill event is raised the way js/02 raises it after a real round trip.
   Under test:
     1. A company whose row id is a real uuid shows the card, reading "No logged changes yet".
     2. A history row for that record is planted in the table; nothing on screen changes by
        itself (the card is not polling).
     3. The pill announces "Saved · 1 lead updated" → within a second the card lists the row,
        naming the company and the field that changed.
     4. Control: a pill that says "Saving…" does not trigger a re-read.

   Run:  node scripts/qa/probe-recent-changes-refresh.mjs        (port 8767)
   Sabotage: in js/63 remove the __pillHook chain — check 3 goes red (the card keeps saying "No
   logged changes yet"). Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8767;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const UUID = 'aaaaaaaa-0000-4000-8000-000000000040';
const H = { 'content-type': 'application/json', apikey: 'x', authorization: 'Bearer x', prefer: 'return=representation' };

async function main() {
  /* give one seed company a real uuid, as every live row has */
  await fetch(`${BASE}/rest/v1/businesses?id=eq.b40`, { method: 'PATCH', headers: H, body: JSON.stringify({ id: UUID }) });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L40') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies and re-renders for ~20 s after load — every render redraws the card

  /* ---- 1. the card shows, empty ---- */
  await p.evaluate(() => { openLead = 'L40'; current = 'leads'; leadDetailView = 'detail'; render(); });
  await p.waitForFunction(() => { const c = document.querySelector('#view .v63-record-hist'); return c && c.getAttribute('data-filled'); }, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(2500);   // opening a card renders three times in ~200 ms (js/64 re-renders); let every read land
  const c1 = await p.evaluate(() => { const c = document.querySelector('#view .v63-record-hist'); return { card: !!c, rec: c && c.getAttribute('data-rec'), txt: c ? c.innerText.replace(/\s+/g, ' ') : '' }; });
  if (c1.card && c1.rec === UUID && /No logged changes yet/.test(c1.txt)) ok('the card shows for the uuid-keyed company and reads "No logged changes yet"');
  else fail(`card: ${JSON.stringify(c1)}`);

  /* ---- 2. plant the row the trigger would write; nothing changes by itself ---- */
  const planted = await fetch(`${BASE}/rest/v1/record_history`, { method: 'POST', headers: H, body: JSON.stringify({ table_name: 'businesses', record_id: UUID, action: 'edit', before_row: { id: UUID, name: 'Test Company 40', stage: 'new' }, after_row: { id: UUID, name: 'Test Company 40', stage: 'contacted' } }) }).then((r) => r.json()).catch(() => null);
  if (Array.isArray(planted) && planted[0] && planted[0].id) ok('a history row for the record is in the table'); else fail(`planting the row: ${JSON.stringify(planted)}`);
  await p.waitForTimeout(1500);
  const c2 = await p.evaluate(() => (document.querySelector('#view .v63-record-hist') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
  if (/No logged changes yet/.test(c2)) ok('control: the card does not poll — still "No logged changes yet" before any save lands'); else fail(`the card changed without a save: "${c2.slice(0, 80)}"`);

  /* ---- 4. a "Saving…" pill does nothing ---- */
  await p.evaluate(() => { window.__pillHook('Saving...', '#F79009'); }); await p.waitForTimeout(900);
  const c4 = await p.evaluate(() => (document.querySelector('#view .v63-record-hist') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
  if (/No logged changes yet/.test(c4)) ok('control: "Saving…" does not re-read the card'); else fail(`"Saving…" re-read the card: "${c4.slice(0, 80)}"`);

  /* ---- 3. the pill says Saved → the card re-reads ---- */
  await p.evaluate(() => { window.__pillHook('Saved · 1 lead updated', '#16B364'); });
  await p.waitForFunction(() => { const c = document.querySelector('#view .v63-record-hist'); return c && /Test Company 40/.test(c.innerText); }, { timeout: 5000 }).catch(() => {});
  const c3 = await p.evaluate(() => (document.querySelector('#view .v63-record-hist') || { innerText: '' }).innerText.replace(/\s+/g, ' '));
  if (/Test Company 40/.test(c3) && /stage/.test(c3) && !/No logged changes yet/.test(c3)) ok(`after "Saved": the card lists the change — "${c3.slice(0, 100)}"`);
  else fail(`after "Saved": "${c3.slice(0, 120)}" — the live-site "No logged changes yet" after a save`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nrecent-changes-refresh OK — the card re-reads the log when the save lands');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
