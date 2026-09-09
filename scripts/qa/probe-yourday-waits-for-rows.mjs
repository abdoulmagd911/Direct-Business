/* probe-yourday-waits-for-rows.mjs (2026-09-09, live test finding T5) — Today's "Your day" card
   is built from the real rows, never from the start-up copy. Attack area (ad).

   PORT NOTE: 8701–8761 are taken. This is 8762, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: with a remembered session the page is on screen before the
   businesses table has arrived; the Your-day card said "never contacted" for four seconds and
   then "23d no contact" once the rows landed. A not-loaded-yet state shown as a fact.

   Under test — the businesses table is held back for 5 s on the wire:
     1. While it is held, the Today page shows NO Your-day card (and never the words "never
        contacted"); js/02's flag __bizTableLoaded is not set.
     2. Once the rows land, the flag is set and the card appears, built from the real rows.
     3. Control: the rest of Today rendered during the hold (the page was not blanked to hide the
        problem).

   Run:  node scripts/qa/probe-yourday-waits-for-rows.mjs        (port 8762)
   Sabotage: in js/14 inject() delete the `__bizTableLoaded` guard — check 1 goes red (the card
   paints during the hold). Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8762;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const HOLD_MS = 5000;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  let released = false; let holdStart = 0;
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (rq.method() === 'GET' && /\/rest\/v1\/businesses/.test(u.pathname) && !released) { holdStart = Date.now(); await new Promise((res) => setTimeout(res, HOLD_MS)); released = true; }
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
  /* sample the page every 300 ms while the table is held back */
  const samples = [];
  const t0 = Date.now();
  while (!released || Date.now() - t0 < 1500) {
    const s = await p.evaluate(() => { const v = document.getElementById('view'); const t = v ? v.innerText : ''; return { flag: window.__bizTableLoaded === true, card: !!(v && v.querySelector('.v57-yourday')), never: /never contacted/.test(t), today: !!(v && (v.querySelector('#v26TodayHub') || v.querySelector('.hero'))), n: (typeof DB !== 'undefined' && DB.businesses) ? DB.businesses.length : -1 }; }).catch(() => null);
    if (s) samples.push(Object.assign({ at: Date.now() - t0, released }, s));
    await p.waitForTimeout(300);
    if (Date.now() - t0 > 40000) break;
  }
  const during = samples.filter((s) => !s.released && !s.flag);
  const earlyCard = during.filter((s) => s.card || s.never);
  const pageUp = during.filter((s) => s.today);
  if (during.length >= 3 && !earlyCard.length) ok(`while the table was held back (${during.length} samples over ${during[during.length - 1].at} ms): no Your-day card, never "never contacted"`);
  else fail(`during the hold: ${JSON.stringify({ samples: during.length, early: earlyCard.slice(0, 3) })} — the live-site "never contacted" painted from the start-up copy`);
  if (pageUp.length) ok(`control: Today itself was on screen during the hold (${pageUp.length} samples) — the page was not blanked`);
  else fail(`control: Today was not visible during the hold at all — ${JSON.stringify(during.slice(0, 3))} (a hidden page proves nothing)`);
  /* after the rows land */
  await p.waitForFunction(() => window.__bizTableLoaded === true && document.querySelector('#view .v57-yourday'), { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => { const c = document.querySelector('#view .v57-yourday'); return { flag: window.__bizTableLoaded === true, card: !!c, txt: c ? c.innerText.replace(/\s+/g, ' ').slice(0, 300) : '', fromTable: (DB.businesses || []).some((x) => x.id === 'L3') }; });
  if (after.flag && after.card && after.fromTable) ok(`after the rows landed: flag set and the card is built from the table rows: "${after.txt.slice(0, 80)}…"`);
  else fail(`after load: ${JSON.stringify(after)}`);
  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nyourday-waits-for-rows OK — the card waits for the real rows');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
