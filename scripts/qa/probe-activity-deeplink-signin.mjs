/* probe-activity-deeplink-signin.mjs — guards the 2026-09-16 (fire #70) fix in js/63 histLoad(), found live:
   opening the app at the /activity ADDRESS before signing in rendered Activity & Audit during boot, the
   history query went out with the anonymous key, the database answered [] with no error, that [] was cached,
   and the page read "No activity yet." with 0 / 0 / 0 tiles for the whole session (339 rows live) until
   Refresh. Same shape as the Finance deep-link bug (fire #56, probe-finance-deeplink-signin). The mock answers
   every GET regardless of session, so this probe answers a record_history GET that carries only the anonymous
   key with [] — exactly what the real database does — and asserts: signed out, nothing is cached as empty;
   after signing in from /activity the rows appear and the tile counts them; the normal path is the control.
   Sabotage-tested: with the js/63 edit stashed, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-activity-deeplink-signin.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9053; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; let anonHistoryGets = 0;
const wire = async (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const h = rq.headers();
    /* the real database shows an anonymous caller nothing — the mock does not know sessions, so say it here */
    if (/\/rest\/v1\/record_history/.test(u.pathname) && rq.method() === 'GET' && (!h.authorization || h.authorization === 'Bearer ' + (h.apikey || ''))) { anonHistoryGets++; await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const rh = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) rh[k] = v; });
      await r.fulfill({ status: resp.status, headers: rh, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
};
const readPage = (p) => p.evaluate(() => ({ current, rows: document.querySelectorAll('#view .act-row').length, tiles: [...document.querySelectorAll('#view .kv')].map((x) => x.innerText.trim()), empty: ((document.querySelector('#view .act-feed .empty') || {}).innerText || '').trim(), noActivity: /No activity yet|لا يوجد نشاط بعد/.test(document.getElementById('view').innerText || '') }));
/* the deep link: /activity BEFORE any session */
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); await wire(p);
await p.goto(BASE + '/activity', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.waitForTimeout(3000);
const preLogin = await readPage(p);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2000); await p.evaluate(() => { current = 'activity'; openLead = null; render(); });
let after = null; for (let i = 0; i < 25; i++) { await p.waitForTimeout(600); after = await readPage(p); if (after.rows) break; }
/* control: the normal path (open at "/", sign in, then Activity) in a fresh context */
const p2 = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); await wire(p2);
await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForSelector('#cl_email', { timeout: 60000 });
await p2.fill('#cl_email', 'test@directksa.com'); await p2.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p2.click('#cl_go');
await p2.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p2.waitForTimeout(2000); await p2.evaluate(() => { current = 'activity'; openLead = null; render(); });
let ctl = null; for (let i = 0; i < 25; i++) { await p2.waitForTimeout(600); ctl = await readPage(p2); if (ctl.rows) break; }
await b.close(); srv.close?.();
const checks = [
  ['signed out at /activity: the page is not cached as an empty log (no "No activity yet.", no rows)', !preLogin.noActivity && preLogin.rows === 0],
  ['after signing in from the /activity address the history rows appear (rows > 0)', after.current === 'activity' && after.rows > 0],
  ['the "Events loaded" tile counts those rows and the page no longer says "No activity yet."', after.rows > 0 && String(after.tiles[0]) === String(after.rows) && !after.noActivity],
  ['control: the normal path (sign in at "/", then Activity) loads the same rows', ctl.rows > 0 && ctl.rows === after.rows],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ preLogin, after, ctl, anonHistoryGets })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
