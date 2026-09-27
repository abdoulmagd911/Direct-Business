/* probe-finance-links-race.mjs — guards the 2026-09-15 (fire #58) fix in js/41 (automatic finance↔client
   linking). Found live, read-only visit to Finance: 13 finance_client_links rows were rewritten on EVERY
   visit by any editor. js/16 sets FIN.rows first and fetches the links afterwards; js/41's pass runs 400 ms
   after each render, saw rows but an empty link map, and upserted every name-matchable group again —
   confirmed_at/updated_at bumped to "now", and a human's later correction of a link would be undone by the
   name match. The pass now waits until FIN.links exists (set only when the links have actually loaded).
   Mock: every invoice group is ALREADY linked by a person; the links response is delayed 1.5 s so the old
   race is deterministic. Asserts 0 writes to finance_client_links, links loaded, every link still the
   person's, no JS errors. Sabotage-tested: with the js/41 edit stashed, 2 checks go FAIL, exit 1.
   E (2026-09-27, DECISIONS D16/D17): finance_client_links is no longer read, js/41's name auto-linker is off, and
   the company of an invoice group is DERIVED from money_rows (FIN.linkByGroup, confirmed_by 'rules'). The race is
   gone with the pass, but the rule it protected is now wider — no code writes a record on its own (D17). So this
   probe now asserts: a read-only Finance visit (several renders, past every timer) writes NOTHING to any merge/rule
   table (finance_client_links, company_name_aliases, client_profiles, company_discount_codes,
   money_exclusion_rules, finance_invoices); the old links table is not even read; the person's six links (turned
   into typed customer names by the harness, D16 migration shape) give exactly those six groups their companies in
   FIN.linkByGroup, provenance 'rules'; the 'individuals' link (no company) makes no company; no JS errors.
   Sabotage (reasoned, not run — the worktree was shared with other runs on 27 Sep): re-enable js/41 pass() (drop its
   early return) → it upserts finance_client_links for any name-matchable unlinked group → check 1 goes red.
   Run: node scripts/qa/probe-finance-links-race.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const LINKS = [0, 1, 2, 3, 4, 5].map((i) => ({ id: 'fl' + i, client_group: 'Test Company ' + i, business_id: 'b' + i, is_client: true, note: 'confirmed by a person', confirmed_by: 'Othman (person)', confirmed_at: '2026-08-10T00:00:00Z', created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z', credit_balance_sar: null }))
  .concat([{ id: 'flv', client_group: 'Test Company VAT Canary', business_id: null, is_client: false, note: 'individuals', confirmed_by: 'Othman (person)', confirmed_at: '2026-08-10T00:00:00Z', created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z', credit_balance_sar: null }]);
const PORT = 9045; const srv = start(PORT, { finance_client_links: LINKS }); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const WATCH = ['finance_client_links', 'company_name_aliases', 'client_profiles', 'company_discount_codes', 'money_exclusion_rules', 'finance_invoices'];
let writes = 0, linkReads = 0; const writeLog = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const t = u.pathname.replace(/^\/rest\/v1\//, '');
  if (WATCH.includes(t) && !['GET', 'HEAD'].includes(rq.method())) { writes++; writeLog.push(rq.method() + ' ' + t + ' ' + (rq.postData() || '').slice(0, 80)); }
  if (t === 'finance_client_links' && ['GET', 'HEAD'].includes(rq.method())) linkReads++;
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof finLoad === 'function' && document.querySelectorAll('#nav button').length > 0, null, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
await p.evaluate(() => { current = 'finance'; render(); });          /* the visit — nothing else */
await p.waitForFunction(() => window.FIN && FIN.rows && FIN.m && !FIN.loading, null, { timeout: 60000 }).catch(() => { });
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.evaluate(() => { try { render(); } catch (_) { } }); }
await p.waitForTimeout(6000);                                        /* past the old 1.2 s / 4 s / render+400 ms passes */
const after = await p.evaluate(() => ({ byGroup: Object.keys(FIN.linkByGroup || {}).sort().map((g) => [g, FIN.linkByGroup[g].business_id, FIN.linkByGroup[g].confirmed_by]),
  canEdit: (typeof canFinEdit === 'function') ? canFinEdit() : null, finRows: (FIN.rows || []).length, mErr: FIN.mErr || null }));
const names = await (await fetch(BASE + '/rest/v1/company_name_aliases')).json();
const links = await (await fetch(BASE + '/rest/v1/finance_client_links')).json();
await b.close(); srv.close?.();
const want = LINKS.filter((l) => l.business_id);
/* expected, exactly: groups 0-3 carry no client ID, so the person's typed name decides (b0..b3); groups 4 and 5 carry
   client IDs 12 and 13, which the harness's client_profiles give to b4 — a row with an ID goes by that ID alone (D16), so
   the person's old name link of group 5 to b5 no longer decides anything */
const EXPECT = { 'Test Company 0': 'b0', 'Test Company 1': 'b1', 'Test Company 2': 'b2', 'Test Company 3': 'b3', 'Test Company 4': 'b4', 'Test Company 5': 'b4' };
const got = Object.fromEntries(after.byGroup.map(([g, biz, by]) => [g, { biz, by }]));
const namedOk = Object.keys(EXPECT).every((g) => got[g] && got[g].biz === EXPECT[g] && got[g].by === 'rules');
const checks = [
  ['a read-only visit to Finance writes NOTHING to any merge, rule or money table (D17: no record is created by code)', writes === 0],
  ['the retired finance_client_links table is not read by the app any more (D16)', linkReads === 0],
  ['the links table is untouched — every row still the person\'s', links.length === LINKS.length && links.every((x) => x.confirmed_by === 'Othman (person)')],
  ['the typed customer names stayed exactly as seeded (' + want.length + ', none added by code)', names.length === want.length && names.every((n) => /^na-link-/.test(n.id))],
  ['FIN.linkByGroup is derived from the rules view (provenance "rules"): typed names decide groups 0-3, typed client IDs decide 4-5', namedOk && after.byGroup.every(([, , by]) => by === 'rules')],
  ['the "individuals" group (a link with no company) makes no company', !got['Test Company VAT Canary']],
  ['the view answered and the QA admin may edit finance (so the pass was live, not skipped)', !after.mErr && after.canEdit === true && after.finRows > 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ writes, linkReads, writeLog: writeLog.slice(0, 4), after, names: names.length })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
