/* probe-finance-deeplink-signin.mjs — guards the 2026-09-15 (fire #56) fix in js/16 finLoad().
   Found live, driven as a real team member: opening the app at the /finance ADDRESS before signing in
   left the ledger permanently empty — "0 invoices · data through —" — for every role. js/16 renders
   Finance 600 ms into boot for that address, its loader ran with no session, the database answered
   zero rows and no error, that [] was cached as FIN.rows and nothing reloaded after sign-in.
   Opens the mock at /finance, signs in, waits, and asserts the ledger holds the mock's invoices and
   the header no longer says "0 invoices". Then reloads at "/" (normal path) as the control.
   Sabotage-tested: with the js/16 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-finance-deeplink-signin.mjs                                          */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9043; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
/* the deep link: /finance BEFORE any session */
await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.waitForTimeout(2500);                       /* past the 600 ms finance render, still signed out */
const preLogin = await p.evaluate(() => ({ rows: (window.FIN && FIN.rows) ? FIN.rows.length : null, rowsIsNull: !!(window.FIN && FIN.rows === null) }));
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => {});
let loaded = null; for (let i = 0; i < 30; i++) { await p.waitForTimeout(600); loaded = await p.evaluate(() => (window.FIN && Array.isArray(FIN.rows)) ? FIN.rows.length : null); if (loaded) break; }
await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({ current, rows: (window.FIN && Array.isArray(FIN.rows)) ? FIN.rows.length : null, header: ((document.getElementById('view').innerText || '').match(/\d+\s+invoices?[^A-Za-z]*data through[^·]*/i) || [''])[0].slice(0, 60), zero: /\b0 invoices\b/.test(document.getElementById('view').innerText || '') }));
/* control: the normal path (open at "/", sign in, then Finance) in a fresh context */
const ctx2 = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p2 = await ctx2.newPage();
await p2.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url()); try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() }); const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
await p2.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p2.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p2.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForSelector('#cl_email', { timeout: 60000 });
await p2.fill('#cl_email', 'test@directksa.com'); await p2.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p2.click('#cl_go');
await p2.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => {});
await p2.waitForTimeout(2000); await p2.evaluate(() => { current = 'finance'; render(); });
let ctl = null; for (let i = 0; i < 20; i++) { await p2.waitForTimeout(600); ctl = await p2.evaluate(() => (window.FIN && Array.isArray(FIN.rows)) ? FIN.rows.length : null); if (ctl) break; }
await b.close(); srv.close?.();
const checks = [
  ['signed out at /finance: the ledger is NOT cached as an empty list (rows stay null)', preLogin.rowsIsNull || preLogin.rows === null],
  ['after signing in from the /finance address the invoices load (rows > 0)', typeof after.rows === 'number' && after.rows > 0],
  ['the Finance header no longer reads "0 invoices"', after.current === 'finance' && !after.zero],
  ['control: the normal path (sign in at "/", then Finance) loads the same ledger', typeof ctl === 'number' && ctl > 0 && ctl === after.rows],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ preLogin, after, ctl })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
