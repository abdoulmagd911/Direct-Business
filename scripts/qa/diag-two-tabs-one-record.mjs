/* diag-two-tabs-one-record.mjs (2026-09-10) — REPORT, asserts nothing. Measures what two tabs
   saving the same company actually leave in the table, so the parked decision in
   docs/LANDMINES.md B.1 ("last save wins … revisit only if it actually bites") rests on a number
   rather than a belief.

   PORT NOTE: 8701–8772 are taken. This is 8773.

   Scenario: tab A logs a note and sets a next action on company L3 and saves; tab B, opened
   earlier (a stale copy), changes only the segment and saves 2.5 s later. The report prints
   what the table holds afterwards: whether A's note and next action survived B's save.
   Measured 2026-09-10: they did not — B's whole-row upsert carried its stale copy of the
   record, and A's note was gone from the table with nothing on either screen saying so.
   (Recovery exists: record_history keeps the before-image; Undo can bring it back — but
   nobody is told.)

   Run:  node scripts/qa/diag-two-tabs-one-record.mjs        (port 8773) */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8773; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const route = async (r) => { const rq = r.request(); const u = new URL(rq.url()); try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() }); const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } };
async function open() {
  const p = await ctx.newPage();
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', route);
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded' });
  try { await p.waitForSelector('#cl_email', { timeout: 20000 }); await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  await p.waitForFunction(() => typeof DB !== 'undefined' && window.__roleKnown === true && DB.businesses.some((x) => x.id === 'L3'), { timeout: 90000 });
  await p.waitForTimeout(22000);
  return p;
}
const A = await open(); const B = await open();
await A.evaluate(() => { const b = getLead('L3'); b.activities = b.activities || []; b.activities.push({ date: Date.now(), type: 'Note', note: 'TAB-A note', by: 'A' }); b.nextAction = 'TAB-A action'; save(); });
await A.waitForTimeout(2500);
await B.evaluate(() => { const b = getLead('L3'); b.segment = 'TAB-B segment'; save(); });
await B.waitForTimeout(2500);
const stored = await fetch(BASE + '/rest/v1/businesses?legacy_id=eq.L3', { headers: { apikey: 'x' } }).then((r) => r.json()).then((a) => a[0]);
const noteSurvived = !!(stored.raw && (stored.raw.activities || []).some((a) => /TAB-A note/.test(a.note || '')));
const nextSurvived = stored.raw && stored.raw.nextAction === 'TAB-A action';
console.log('two tabs, one company (L3): A logged a note + next action, B (stale) changed the segment 2.5 s later');
console.log('  table afterwards: segment = ' + JSON.stringify(stored.segment) + ' · A\'s note survived: ' + noteSurvived + ' · A\'s next action survived: ' + nextSurvived);
console.log('  ' + (noteSurvived && nextSurvived ? 'both tabs\' changes are in the table — no loss' : 'B\'s save carried its stale copy of the whole record and A\'s change is GONE from the table, with nothing on either screen saying so (LANDMINES B.1 — "revisit only if it actually bites": it bites)'));
await b.close(); srv.close(); process.exit(0);
