/* probe-session-lapse.mjs — a session that lapses MID-USE must be said out loud, never shown as
   zeros (2026-09-02, attack round 18). The real story (js/55's own header): a lapsed token once
   made Finance load happily with Revenue 0 / Cost 0 / Profit 0 — real money, invisible, nothing
   on screen saying anything was wrong. Driven for real: sign in, open Finance with figures,
   then flip the mock into "anonymous caller" mode (role null, every read empty) and make the
   app reload its rows the way a page visit does. Asserts:
     - the orange session bar appears within a few seconds, with the plain-language sentence
     - it appears BEFORE the person has to wait for the minute sweep (the Finance zero-shape
       triggers the check immediately)
     - once the session is good again, the next check removes the bar
     - the guard never rotated a token: no /auth/v1/token call was made by it
   Sabotage: drop the Finance zero-shape trigger in js/55 → the bar does not appear in time → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8361;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  const tokenCalls = [];
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (u.pathname.startsWith('/auth/v1/token')) tokenCalls.push(Date.now());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { current = 'finance'; render(); });
  for (let i = 0; i < 20; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => (typeof FIN !== 'undefined' && FIN.rows) ? FIN.rows.length : 0); if (n > 0) break; }
  const before = await p.evaluate(() => ({ rows: FIN.rows.length, bar: !!document.getElementById('sessgone'), role: window.__userRole }));
  if (before.rows > 0 && !before.bar) ok('signed in: Finance shows ' + before.rows + ' invoices, no session bar (role ' + before.role + ')');
  else fail('setup: rows ' + before.rows + ', bar ' + before.bar);
  const tokensAtStart = tokenCalls.length;

  // the session lapses while the person is working; they visit Finance again (rows reload)
  await fetch(BASE + '/__lapse?on=1');
  const t0 = Date.now();
  await p.evaluate(() => { FIN.rows = null; finLoad(); });
  let seen = null;
  for (let i = 0; i < 25; i++) { await p.waitForTimeout(300); const s = await p.evaluate(() => { const d = document.getElementById('sessgone'); return d ? d.innerText : null; }); if (s) { seen = { text: s, ms: Date.now() - t0 }; break; } }
  if (seen && /session has expired|انتهت جلستك/.test(seen.text)) ok('the session bar appeared ' + seen.ms + ' ms after the empty reload, with the plain sentence');
  else fail('no session bar within 7.5 s of the lapsed reload — the page would sit on zeros (' + JSON.stringify(seen) + ')');
  if (seen && seen.ms < 6000) ok('it came from the Finance zero-shape trigger, not the minute sweep');
  else if (seen) fail('the bar took ' + seen.ms + ' ms — the immediate Finance trigger did not fire');
  const zerosShown = await p.evaluate(() => /Revenue|الإيرادات/.test(document.getElementById('view').innerText) && (document.getElementById('view').innerText.match(/0\.00/g) || []).length >= 2);
  console.log('  · Finance body shows zero figures under the bar: ' + zerosShown + ' (allowed only because the bar says they are not real)');
  if (tokenCalls.length > tokensAtStart) fail('the guard rotated a token (' + (tokenCalls.length - tokensAtStart) + ' /auth/v1/token call(s)) — it must only read');
  else ok('no token rotation by the guard (read-only, as its header promises)');

  // the session is good again (e.g. the client refreshed itself): the next check clears the bar
  await fetch(BASE + '/__lapse?on=0');
  await p.evaluate(() => { if (window.__sessionCheck) window.__sessionCheck(); });
  await p.waitForTimeout(1200);
  const barAfter = await p.evaluate(() => !!document.getElementById('sessgone'));
  if (!barAfter) ok('with the session good again, the next check removed the bar');
  else fail('the bar stayed after the session was good again');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nsession-lapse OK — a lapsed session is said out loud, never shown as zeros');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
