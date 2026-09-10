/* probe-columns-follow-record.mjs (2026-09-10, live test finding L6) — the businesses table's own
   columns say what the record says. Attack area (ad). Measured on the wire, not from the code.

   PORT NOTE: 8701–8768 are taken. This is 8769, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: a lead created and assigned in the app had assigned_to EMPTY
   in the table while the record's own blob said Abdulrahman — js/02's appToRow never wrote
   assigned_to, account_manager, tier or segment, only the raw blob. Anything reading the table
   (SQL, the KPI project, an export outside the app) saw "unassigned" over a name that was there.
   And the other way round: three live rows carry a tier and segment in the column only (set by
   SQL) and the app showed them blank, because rowToApp never read those two columns.

   Under test:
     1. A row whose columns say assigned_to / account_manager / tier / segment and whose raw blob
        says nothing → the app object carries all four (the column is the fallback).
     2. Loading and a six-page tour write NOTHING to businesses — reading the columns into the
        object must not make the row compare unequal on the next save (no phantom write).
     3. Assign the lead to someone else in the app and save → the upsert carries assigned_to =
        the new name, and tier / segment / account_manager equal to the record — not null.
     4. The stored row afterwards: columns and raw blob agree on all four.
     5. The raw blob still wins when both are present and differ (a record the app itself saved).

   Run:  node scripts/qa/probe-columns-follow-record.mjs        (port 8769)
   Sabotage: in js/02 appToRow drop the assigned_to/account_manager/tier/segment line — checks 3
   and 4 go red; in rowToApp drop the tier/segment fallback — check 1 goes red. Assert the
   sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8769;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const H = { 'content-type': 'application/json', apikey: 'x', authorization: 'Bearer x', prefer: 'return=representation' };
const W = { biz: 0, bodies: [] };

async function main() {
  /* one row: columns only (no raw), as a SQL import writes; one row: raw says a different owner than the column */
  await fetch(`${BASE}/rest/v1/businesses?id=eq.b41`, { method: 'PATCH', headers: H, body: JSON.stringify({ assigned_to: 'Column Owner', account_manager: 'Column Manager', tier: 'Key', segment: 'Government / Health', raw: {} }) });
  await fetch(`${BASE}/rest/v1/businesses?id=eq.b42`, { method: 'PATCH', headers: H, body: JSON.stringify({ assigned_to: 'Column Owner', raw: { assignedTo: 'Blob Owner' } }) });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    if (/\/rest\/v1\/businesses/.test(u.pathname) && !['GET', 'HEAD'].includes(rq.method())) { W.biz++; W.bodies.push({ m: rq.method(), q: u.search, body: rq.postData() }); }
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
  await p.waitForFunction(() => typeof DB !== 'undefined' && typeof render === 'function' && Array.isArray(DB.businesses) && DB.businesses.some((x) => x.id === 'L41') && window.__roleKnown === true, { timeout: 90000 }).catch(() => fail('the app never loaded'));
  await p.waitForTimeout(22000);   // js/35 re-asserts table copies for ~20 s after load

  /* ---- 1. columns reach the object ---- */
  const o1 = await p.evaluate(() => { const b = getLead('L41'); return { assignedTo: b.assignedTo, accountManager: b.accountManager, tier: b.tier, segment: b.segment }; });
  if (o1.assignedTo === 'Column Owner' && o1.accountManager === 'Column Manager' && o1.tier === 'Key' && o1.segment === 'Government / Health') ok('a row whose columns alone carry owner, manager, tier and segment shows all four in the app');
  else fail(`columns → object: ${JSON.stringify(o1)} — the live-site blank tier/segment on SQL-set rows`);

  /* ---- 5. the blob wins when both are present ---- */
  const o5 = await p.evaluate(() => getLead('L42').assignedTo);
  if (o5 === 'Blob Owner') ok('control: when the blob and the column differ, the blob (what the app itself saved) wins'); else fail(`blob vs column: ${o5}`);

  /* ---- 2. no phantom write ---- */
  W.biz = 0; W.bodies.length = 0;
  for (const v of ['today', 'leads', 'clients', 'finance', 'reports', 'leads']) { await p.evaluate((v) => { openLead = null; current = v; render(); }, v); await p.waitForTimeout(700); }
  await p.evaluate(() => { try { save(); } catch (_) { } }); await p.waitForTimeout(2500);
  if (W.biz === 0) ok('loading, a six-page tour and a plain save() write nothing to businesses — reading the columns did not make any row look changed');
  else fail(`phantom writes: ${W.biz} — ${JSON.stringify(W.bodies.map((x) => x.m + ' ' + x.q + ' ' + String(x.body).slice(0, 120)))}`);

  /* ---- 3. an assignment in the app reaches the columns ---- */
  W.biz = 0; W.bodies.length = 0;
  await p.evaluate(() => { const b = getLead('L41'); b.assignedTo = 'New Owner'; save(); }); await p.waitForTimeout(3000);
  const up = W.bodies.map((x) => { try { const j = JSON.parse(x.body); return Array.isArray(j) ? j : [j]; } catch (_) { return []; } }).flat().find((r) => r && r.legacy_id === 'L41');
  if (up && up.assigned_to === 'New Owner' && up.account_manager === 'Column Manager' && up.tier === 'Key' && up.segment === 'Government / Health' && up.raw && up.raw.assignedTo === 'New Owner') ok('the save carries assigned_to = the new name, and manager / tier / segment as the record has them — in the columns, not only the blob');
  else fail(`upsert row: ${JSON.stringify(up && { assigned_to: up.assigned_to, account_manager: up.account_manager, tier: up.tier, segment: up.segment, rawAssigned: up.raw && up.raw.assignedTo })} — the live-site empty assigned_to column`);

  /* ---- 4. the stored row agrees with itself ---- */
  const stored = await fetch(`${BASE}/rest/v1/businesses?id=eq.b41`, { headers: { apikey: 'x' } }).then((r) => r.json()).then((a) => a[0]).catch(() => null);
  if (stored && stored.assigned_to === 'New Owner' && stored.raw && stored.raw.assignedTo === 'New Owner' && stored.tier === 'Key' && stored.raw.tier === 'Key' && stored.segment === stored.raw.segment && stored.account_manager === stored.raw.accountManager) ok('the stored row: columns and blob agree on owner, manager, tier and segment');
  else fail(`stored: ${JSON.stringify(stored && { assigned_to: stored.assigned_to, tier: stored.tier, segment: stored.segment, account_manager: stored.account_manager, raw: stored.raw && { assignedTo: stored.raw.assignedTo, tier: stored.raw.tier, segment: stored.raw.segment, accountManager: stored.raw.accountManager } })}`);

  if (!errors.length) ok('no JavaScript errors'); else fail('JavaScript errors: ' + errors.join(' | '));
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ncolumns-follow-record OK — the table\'s own columns say what the record says');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
