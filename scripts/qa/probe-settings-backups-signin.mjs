/* probe-settings-backups-signin.mjs — guards the 2026-09-17 (fire #71) fix in core-06 bkFetchAll(), found live:
   opening the app at the /settings ADDRESS before signing in drew the "Backup & restore" card during boot, so
   the backup list was fetched with no session (the database answered [] with no error) and "is admin" came back
   false for lack of a user — both cached for the whole session: 0 backups on screen against 95 real ones, the
   admin history hidden from an admin. Same shape as the Finance (fire #56) and Activity (fire #70) deep-link
   bugs. The mock answers every GET regardless of session, so this probe answers app_state_history /
   app_state_bak GETs that carry only the anonymous key with [] — what the real database does — and asserts:
   signed out at /settings nothing is cached; after signing in from that address the admin sees the history
   rows the mock seeds and is known as admin; the normal path is the control.
   Sabotage-tested: with the core-06 edit stashed, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-settings-backups-signin.mjs                                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9055; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const wire = async (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const h = rq.headers();
    if (/\/rest\/v1\/(app_state_history|app_state_bak|app_users)/.test(u.pathname) && rq.method() === 'GET' && (!h.authorization || h.authorization === 'Bearer ' + (h.apikey || ''))) { await r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const rh = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) rh[k] = v; });
      await r.fulfill({ status: resp.status, headers: rh, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
};
const read = (p) => p.evaluate(() => ({ current, loaded: BK_CACHE.loaded, history: BK_CACHE.history.length, tagged: BK_CACHE.tagged.length, isAdmin: BK_IS_ADMIN, err: BK_CACHE.error, restricted: BK_CACHE.historyRestricted }));
/* the deep link: /settings BEFORE any session */
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); await wire(p);
await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.waitForTimeout(3500);
const pre = await read(p);
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(2500); await p.evaluate(() => { current = 'settings'; openLead = null; render(); });
let after = null; for (let i = 0; i < 25; i++) { await p.waitForTimeout(600); after = await read(p); if (after.loaded && after.history) break; }
/* control: the normal path */
const p2 = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); await wire(p2);
await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p2.waitForSelector('#cl_email', { timeout: 60000 });
await p2.fill('#cl_email', 'test@directksa.com'); await p2.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p2.click('#cl_go');
await p2.waitForFunction(() => typeof render === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p2.waitForTimeout(2500); await p2.evaluate(() => { current = 'settings'; openLead = null; render(); });
let ctl = null; for (let i = 0; i < 25; i++) { await p2.waitForTimeout(600); ctl = await read(p2); if (ctl.loaded && ctl.history) break; }
await b.close(); srv.close?.();
const checks = [
  ['signed out at /settings: the backup list is not cached (loaded stays false, no admin verdict)', pre.loaded === false && pre.isAdmin !== false],
  ['after signing in from the /settings address the admin history rows appear', after.current === 'settings' && after.loaded === true && after.history > 0],
  ['…and the account is known as admin (history not restricted)', after.isAdmin === true && after.restricted === false],
  ['control: the normal path (sign in at "/", then Settings) shows the same history', ctl.loaded === true && ctl.history === after.history && ctl.isAdmin === true],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ pre, after, ctl })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
