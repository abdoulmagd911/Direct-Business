/* probe-audit-array-not-reuploaded.mjs — guards the 2026-09-17 (fire #80) change in js/53.
   Found by driving one real lead change against the live database with every write intercepted, so the
   payloads could be read without anything being stored: the change sent one company row of 1,895 bytes,
   which is right, and a workspace patch of 131,273 bytes whose ONLY section was `audit`. That array is
   142,211 bytes of the stored 478,462 — 30% of the workspace — re-uploaded on every lead change and
   re-downloaded at every sign-in, and nothing reads it: Activity & Audit moved to the database's own
   record_history in 2026-08 (js/63), and the invoice/booking cards that also read it have 0 invoices and
   0 bookings to show. js/53's 4-second sweep was what grew it; the sweep is retired and the 799 existing
   entries are left untouched.
   This probe changes one lead's stage on the mock and checks that the array does not grow, that no
   workspace patch carries an `audit` section, that the company row is still saved (so the drive really
   happened), and that Activity & Audit still lists history from the database.
   Sabotage-tested: with the js/53 edit stashed, the growth check goes FAIL (1), exit 1 — the array gains
   an entry within one sweep turn of the lead change, which is the whole mechanism.
   Run: node scripts/qa/probe-audit-array-not-reuploaded.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9060; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const writes = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) writes.push({ m, path: u.pathname.replace('/rest/v1/', ''), body: rq.postData() || '' });
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && typeof setLeadStage === 'function', { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(6000);                 /* two full turns of the retired 4s sweep */
const before = await p.evaluate(() => ({ audit: (DB.audit || []).length, biz: (DB.businesses || []).length }));
writes.length = 0;                            /* only what the lead change itself sends */
const acted = await p.evaluate(() => { const b = (DB.businesses || []).find((x) => !x.isClient && x.stage !== 'Contacted'); if (!b) return null; setLeadStage(b.id, 'Contacted'); return { id: b.id, was: b.stage }; });
await p.waitForTimeout(11000);                /* the debounced save, plus two more sweep turns */
const after = await p.evaluate(() => ({ audit: (DB.audit || []).length }));
const rowWrites = writes.filter((w) => w.path === 'businesses');
const patchKeys = writes.filter((w) => /rpc\/save_state/.test(w.path)).flatMap((w) => { try { const j = JSON.parse(w.body); return Object.keys(j.patch || j.payload || {}); } catch (_) { return []; } });
/* Activity & Audit must still have something to show — from the database, not the array */
await p.evaluate(() => { current = 'activity'; openLead = null; render(); });
let histRows = 0; for (let i = 0; i < 25; i++) { await p.waitForTimeout(500); histRows = await p.evaluate(() => document.querySelectorAll('#view .act-row').length); if (histRows) break; }
await b.close(); srv.close?.();
const checks = [
  ['the drive really happened — one lead was moved and its company row was saved', !!acted && rowWrites.length >= 1],
  ['the browser-side audit array did not grow', before.audit === after.audit],
  ['no workspace write carried an `audit` section', !patchKeys.includes('audit')],
  ['the existing entries are left alone — nothing was deleted', after.audit >= before.audit],
  ['Activity & Audit still lists history, from the database', histRows > 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ before, after, acted, rowWrites: rowWrites.length, patchKeys, histRows })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
