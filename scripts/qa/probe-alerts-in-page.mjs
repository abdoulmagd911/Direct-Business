/* probe-alerts-in-page.mjs (2026-09-10, live test finding D1 — the last of it) — every alert() in
   the app is shown in the page, never as the browser's own box. Attack area (ad).

   PORT NOTE: 8701–8767 are taken. This is 8768, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: a native alert()/confirm() freezes the whole tab until it is
   dismissed — two of the owner's own test tabs froze on exactly that. The questions (confirm)
   were moved into js/57's box one by one across four landings, because each needs a callback.
   About 120 places report a result through alert() — "Not saved", "No rows to export", "Could
   not restore: …" — and a report needs no callback, so js/63 now replaces window.alert app-wide
   with its notice card. The call sites keep their wording; only the box changes.

   Under test (Playwright's dialog event catches every native box — if one fires, red):
     1. alert('…') after load → no native dialog; the notice card shows the text; a 'v63-notice'
        document event carried the same text (what tests and later layers read).
     2. A second alert while the first is up stacks in the same card — the first is not lost.
     3. OK closes the card; Escape closes it too.
     4. A real path: the Ledger export with no rows → "No rows to export" in the card, no box.
     5. A real path across a file that never heard of js/63: core-06's invoice bulk action with
        nothing selected → "No invoices selected." in the card.
     6. The card never blocks the page: with it up, a button elsewhere on the page still receives
        its click (the old alert() blocked everything).
     7. window.__nativeAlert is the browser's own function, kept for the fallback.

   Run:  node scripts/qa/probe-alerts-in-page.mjs        (port 8768)
   Sabotage: in js/63 delete the `window.alert=function(m){…}` shim — checks 1, 2, 4, 5 and the
   no-native-dialog check go red (a native dialog fired). Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8768;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 50)); await d.dismiss(); });
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && window.__roleKnown === true && typeof window.v63Notice === 'function', { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(1500);
  const card = () => p.evaluate(() => { const c = document.getElementById('v63Notice'); return { up: !!c, texts: c ? [...c.querySelectorAll('[data-v63-text]')].map((x) => x.textContent.trim()) : [] }; });

  /* ---- 1. a plain alert ---- */
  await p.evaluate(() => { window.__noticeEvents = []; document.addEventListener('v63-notice', (e) => window.__noticeEvents.push(e.detail.text)); alert('Probe message one'); });
  await p.waitForTimeout(300);
  const c1 = await card(); const ev1 = await p.evaluate(() => window.__noticeEvents.slice());
  if (!dialogs.length && c1.up && c1.texts[0] === 'Probe message one' && ev1[0] === 'Probe message one') ok('alert() shows the in-page card with the text, no native box; the v63-notice event carried it');
  else fail(`alert(): dialogs=${JSON.stringify(dialogs)} card=${JSON.stringify(c1)} events=${JSON.stringify(ev1)} — the live-site tab-freezing box`);

  /* ---- 2. a second one stacks ---- */
  await p.evaluate(() => alert('Probe message two')); await p.waitForTimeout(300);
  const c2 = await card();
  if (!dialogs.length && c2.texts.length === 2 && c2.texts[0] === 'Probe message one' && c2.texts[1] === 'Probe message two') ok('a second alert stacks under the first in the same card — nothing lost');
  else fail(`stacking: ${JSON.stringify(c2)}`);

  /* ---- 6. the card never blocks the page ---- */
  const clickable = await p.evaluate(() => { const btn = document.querySelector('#nav button[data-view="today"]') || document.querySelector('#nav button'); if (!btn) return { noBtn: true }; const r = btn.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hitIsBtn: !!hit && (hit === btn || btn.contains(hit)) }; });
  if (clickable.hitIsBtn) ok('with the card up, a sidebar button still receives its click — the page is not blocked'); else fail(`blocked: ${JSON.stringify(clickable)}`);

  /* ---- 3. OK closes; Escape closes ---- */
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); }); await p.waitForTimeout(200);
  const c3a = await card();
  await p.evaluate(() => alert('Probe message three')); await p.waitForTimeout(200);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.focus(); }); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const c3b = await card();
  if (!c3a.up && !c3b.up) ok('OK closes the card; Escape closes it too'); else fail(`closing: afterOK=${c3a.up} afterEsc=${c3b.up}`);

  /* ---- 4. a real path in js/16 ---- */
  await p.evaluate(() => { try { FIN._csvRows = []; } catch (_) { } finLedgerCSV(); }); await p.waitForTimeout(400);
  const c4 = await card();
  if (!dialogs.length && c4.up && /No rows to export|لا صفوف/.test(c4.texts.join(' '))) ok(`Ledger export with no rows: "${c4.texts[0]}" in the card`); else fail(`ledger export: dialogs=${JSON.stringify(dialogs)} card=${JSON.stringify(c4)}`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  /* ---- 5. a real path in a core file that never heard of js/63 ---- */
  await p.evaluate(() => { invBulkSel = {}; invBulkAction('archive'); }); await p.waitForTimeout(400);
  const c5 = await card();
  if (!dialogs.length && c5.up && /No invoices selected/.test(c5.texts.join(' '))) ok(`core-06 invoice bulk action with nothing selected: "${c5.texts[0]}" in the card`); else fail(`core-06: dialogs=${JSON.stringify(dialogs)} card=${JSON.stringify(c5)}`);
  await p.evaluate(() => { const o = document.getElementById('v63NoticeOk'); if (o) o.click(); });

  /* ---- 7. the native function is kept ---- */
  const nat = await p.evaluate(() => typeof window.__nativeAlert === 'function' && /\[native code\]/.test(String(window.__nativeAlert)));
  if (nat) ok('the browser\'s own alert is kept as window.__nativeAlert for the fallback'); else fail('window.__nativeAlert is not the native function');

  if (!dialogs.length) ok('no native dialog at any point'); else fail('native dialogs: ' + dialogs.join(','));
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nalerts-in-page OK — every alert() is a card in the page, none a box that freezes the tab');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
