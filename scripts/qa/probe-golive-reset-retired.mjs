/* probe-golive-reset-retired.mjs (2026-09-10, second live pass — Settings) — the two v22 go-live
   tools on the Settings page can no longer write into the live workspace. Attack area (ad).
   Measured on the wire.

   PORT NOTE: 8701–8774 are taken. This is 8775, verified free by scanning every PORT= in
   scripts/qa.

   Found on the Settings page (visible to every admin AND manager): "🔄 Reset for go-live" — with
   a browser confirm() and a typed "GO LIVE" — dropped every company that was not a client from
   DB.businesses, cleared the kept ones' activities / deal value / wallet, emptied offers,
   bookings, invoices, expenses, refunds and the audit, and saved: the next push archived every
   lead and prospect in the table. Its "Pre-go-live snapshot" safety net stored localStorage's
   copy of the workspace — which js/02 removes on every load — so the snapshot's data was ''.
   Beside it, "🚀 Run workflow test suite" pushed a test company, offers, bookings and invoices
   into DB and saved them: practice data written into the live workspace by one click, the kind
   the owner had removed on 9 Sep. Both are retired since go-live (22 Aug): the buttons are gone
   from the card, and the functions (still reachable from a console or an old bookmark) explain
   in the page and change nothing. The two other one-click practice-data writers on the same
   page — "🧪 Run a day" (core-06: a test lead, offer, booking, draft invoice, sync events) and
   "🟢 Run v23 scenario suite" (core-07: test companies, bookings, invoices, refunds, expenses) —
   are retired the same way.

   Under test:
     1. The Settings card carries the "Retired since go-live" text and NO "Reset for go-live" or
        "Run workflow test suite" button; "Wipe v22 test data" (filters _v22test rows only) stays.
     2. v22ResetForGoLive() called directly → an in-page notice saying it is retired; the 60
        companies, offers, bookings and invoices are unchanged; zero writes to businesses,
        app_state or save_state; no native confirm/prompt.
     3. v22OpenWorkflowSuite() called directly → a notice; no _v22test row anywhere in DB; zero
        writes.
     4. In Arabic the card's text is Arabic and the notice is Arabic.
     5. "Run a day" and the v23 scenario suite: no Run button on their cards (the Wipe buttons
        stay); called directly → a notice, no b_rad_/_v21test/_v23test row, zero writes.
     6. No native dialog at any point; no JavaScript errors.

   Run:  node scripts/qa/probe-golive-reset-retired.mjs        (port 8775)
   Sabotage: in core-07's Settings card put `<button class="btn sm danger"
   onclick="v22ResetForGoLive()">🔄 Reset for go-live</button>` back — check 1 goes red; in
   v22ResetForGoLive() add `DB.businesses=DB.businesses.filter(b=>b.isClient);save();` — check 2
   goes red (companies gone, an archive PATCH on the wire); in core-06 put `<button class="btn pri"
   onclick="v21OpenRunADay()">` back on its card — check 5 goes red. Assert the sabotage APPLIED with a
   marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import { tapNotices } from './notice-tap.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8775;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const W = [];

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 40)); await d.dismiss(); });
  const notices = []; await tapNotices(p, (t) => notices.push(t));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (!['GET', 'HEAD'].includes(rq.method())) W.push({ m: rq.method(), path: u.pathname, body: rq.postData() || '' });
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L3') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s after load
  await p.evaluate(() => { openLead = null; current = 'settings'; render(); }); await p.waitForTimeout(800);
  const dataWrites = (from) => W.slice(from).filter((w) => /\/rest\/v1\/(businesses|app_state)\b|\/rpc\/save_state/.test(w.path));
  const shape = () => p.evaluate(() => ({ biz: DB.businesses.length, offers: (DB.offers || []).length, bookings: (DB.bookings || []).length, invoices: (DB.invoices || []).length, test: ['businesses', 'bookings', 'invoices', 'offers'].reduce((n, k) => n + (DB[k] || []).filter((x) => x && x._v22test).length, 0) }));

  /* ---- 1. the card ---- */
  const card = await p.evaluate(() => { const c = document.querySelector('.v22SettingsCard'); if (!c) return null; return { text: c.innerText.replace(/\s+/g, ' '), reset: !!c.querySelector('button[onclick*="v22ResetForGoLive"]'), suite: !!c.querySelector('button[onclick*="v22OpenWorkflowSuite"]'), wipe: !!c.querySelector('button[onclick*="v22WipeWorkflowTestData"]') }; });
  if (card && /Retired since go-live/.test(card.text) && !card.reset && !card.suite && card.wipe) ok('the Settings card says "Retired since go-live" and has no Reset-for-go-live or Run-suite button (Wipe v22 test data stays)');
  else fail(`card: ${JSON.stringify(card)} — the live-site red "Reset for go-live" button`);

  /* ---- 2. the reset, called directly ---- */
  const s0 = await shape(); const w0 = W.length; const n0 = notices.length;
  await p.evaluate(() => v22ResetForGoLive()); await p.waitForTimeout(2500);
  const s2 = await shape(); const n2 = notices.slice(n0).join(' | ');
  if (/retired/i.test(n2) && JSON.stringify(s2) === JSON.stringify(s0) && s2.biz >= 60 && dataWrites(w0).length === 0 && !dialogs.length)
    ok(`v22ResetForGoLive(): "${n2.slice(0, 60)}…" — ${s2.biz} companies, ${s2.offers} offers, ${s2.bookings} bookings, ${s2.invoices} invoices untouched; zero writes; no browser box`);
  else fail(`reset: notice=${JSON.stringify(n2)} before=${JSON.stringify(s0)} after=${JSON.stringify(s2)} writes=${JSON.stringify(dataWrites(w0).map((w) => w.m + ' ' + w.path))} dialogs=${JSON.stringify(dialogs)} — the live-site every-lead-archived reset`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  /* ---- 3. the suite, called directly ---- */
  const w3 = W.length; const n3 = notices.length;
  await p.evaluate(() => v22OpenWorkflowSuite()); await p.waitForTimeout(2500);
  const s3 = await shape(); const nn3 = notices.slice(n3).join(' | ');
  if (/retired|harness/i.test(nn3) && s3.test === 0 && JSON.stringify(s3) === JSON.stringify(s0) && dataWrites(w3).length === 0)
    ok('v22OpenWorkflowSuite(): a notice, no _v22test row anywhere, nothing written'); else fail(`suite: notice=${JSON.stringify(nn3)} shape=${JSON.stringify(s3)} writes=${dataWrites(w3).length} — the live-site practice-data generator`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  /* ---- 4. Arabic ---- */
  await p.evaluate(() => { try { if (typeof setLang === 'function') setLang('ar'); else { LANG = 'ar'; render(); } } catch (_) { LANG = 'ar'; render(); } }); await p.waitForTimeout(1200);
  const n4 = notices.length;
  const cardAr = await p.evaluate(() => { const c = document.querySelector('.v22SettingsCard [data-v22-retired]'); return c ? c.textContent : null; });
  await p.evaluate(() => v22ResetForGoLive()); await p.waitForTimeout(600);
  const nn4 = notices.slice(n4).join(' | ');
  if (cardAr && /[؀-ۿ]/.test(cardAr) && !/Retired since/.test(cardAr) && /[؀-ۿ]/.test(nn4)) ok('Arabic: the card\'s text and the notice are Arabic'); else fail(`Arabic: card=${JSON.stringify(cardAr)} notice=${JSON.stringify(nn4)}`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  /* ---- 5. Run a day and the v23 scenario sweep ---- */
  await p.evaluate(() => { LANG = 'en'; render(); }); await p.waitForTimeout(800);
  const cards5 = await p.evaluate(() => ({ runDay: !!document.querySelector('button[onclick*="v21OpenRunADay"]'), v23: !!document.querySelector('button[onclick*="v23OpenScenarioSuite"]'), wipes: document.querySelectorAll('button[onclick*="v21WipeTestRecords"], button[onclick*="v23WipeScenarioData"]').length, t21: !!document.querySelector('[data-v21-retired]'), t23: !!document.querySelector('[data-v23-retired]') }));
  const w5 = W.length; const n5 = notices.length;
  await p.evaluate(() => { v21OpenRunADay(); v23OpenScenarioSuite(); }); await p.waitForTimeout(2500);
  const s5 = await shape();
  const testRows = await p.evaluate(() => ['businesses', 'bookings', 'invoices', 'offers', 'refundRequests', 'expenses'].reduce((n, k) => n + (DB[k] || []).filter((x) => x && (x._v21test || x._v23test || /^b_rad_|^o_rad_|^bk_rad_|^inv_rad_/.test(String(x.id)))).length, 0));
  const nn5 = notices.slice(n5);
  if (!cards5.runDay && !cards5.v23 && cards5.wipes === 2 && cards5.t21 && cards5.t23 && nn5.length === 2 && nn5.every((t) => /retired/i.test(t)) && testRows === 0 && JSON.stringify(s5) === JSON.stringify(s0) && dataWrites(w5).length === 0)
    ok('"Run a day" and the v23 scenario sweep: no Run button, the cards say why; called directly → two notices, no test row, zero writes');
  else fail(`run-a-day / v23: cards=${JSON.stringify(cards5)} notices=${JSON.stringify(nn5)} testRows=${testRows} shape=${JSON.stringify(s5)} writes=${dataWrites(w5).length}`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ngolive-reset-retired OK — the go-live reset and the live test suite can no longer touch the workspace');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
