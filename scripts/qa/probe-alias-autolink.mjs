/* probe-alias-autolink.mjs — M14 on the LINKING path, not only the display path.
   Owner's instruction (2026-08-25), verbatim shape: the client-name alias map "should sit
   beside [finExclusionCheck] and be called the same way" on the import path — not applied once
   at display time. The 2026-08-29 sweep found the letter of that unmet: finCanon() (display)
   consulted the map, but js/41's automatic finance↔client linker did not, so a freshly
   imported alias spelling that is not itself a business name stayed "needs linking" — and
   finSectorOf() (js/16), which reads the link by RAW client_group, would sector it as plain
   B2B even when its sibling spelling is a linked Tender client.

   THE CLAIM: an unlinked client_group that is a registered alias of an already-linked sibling
   gets linked to the SAME business automatically (confirmed_by 'auto-match-alias'), with the
   write going out in the same shape the real auto-linker uses. Sabotage: remove the alias
   fallback in js/41-money-in.js → the group stays unlinked → this fails.

   E (2026-09-27, DECISIONS D16/D17): the automatic linker (js/41 "v66") is switched off and the alias map is retired —
   a spelling belongs to a company only when a person has TYPED it there (company_name_aliases), and the database view
   money_rows applies that on every read, on every path, imports included. The claim above ("an unlinked sibling
   spelling gets linked automatically, confirmed_by auto-match-alias") is now exactly what must NOT happen. What this
   probe keeps from its purpose — the typed name, not a name match, decides; and it matches however it is spelled:
     1. a sibling spelling nobody typed is NOT linked to its sibling's company, and the page writes nothing (D17);
     2. PRECEDENCE: a row named exactly like another company (the decoy) but typed into b2 goes to b2 — the typed
        name wins, a name match decides nothing (the Client M split cannot recur);
     3. ARABIC VARIANTS: a row spelled ه/إ where the typed name has ة/ا lands under the typed name's company;
     4. PRESENTATION FORMS: a row in shaped Arabic glyphs lands under its normal-form typed name;
     5. SUGGESTION: two untyped rows differing only by ة/ه wait as ONE entry under Needs a decision (2 rows), not two.
   3-5 exercise the harness model of money_norm (mockMoneyNorm); the SQL money_norm itself is tested on Postgres by
   scripts/qa/phase3 (E-01..06).
   Rows and typed names are seeded through start() (the company comes from the view, not from FIN.rows). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8266;
const SIB_LINKED = 'Alias Sibling Linked Spelling';
const SIB_NEW = 'Alias Sibling Fresh Spelling';          // a different spelling nobody typed
const DECOY = 'Test Company 9';                          // exactly the name of harness company b9 …
const AR_ALIAS = 'شركة الاختبار المحدودة', AR_ROW = 'شركه الإختبار المحدوده';
const PF_ALIAS = 'شركة الأفق للسياحة';
const PF_ROW = 'ﺷﺮﻛﺔ ﺍﻠﺄﻓﻘ ﻟﻠﺴﻴﺎﺣﺔ';   // the same words in presentation-form code points
const SUG_A = 'شركة النور للسفر', SUG_B = 'شركه النور للسفر';
const BIZ = 'b2';
const typed = (name, i) => ({ id: 'na-aa-' + i, business_id: BIZ, name, created_by: null, created_by_name: 'probe seed', created_at: '2026-08-10T00:00:00Z', removed_by: null, removed_by_name: null, removed_at: null });
const NAMES = [SIB_LINKED, DECOY, AR_ALIAS, PF_ALIAS].map(typed);   // … but typed into b2 by a person
const row = (g, no, v) => ({ id: 'aa-' + no, invoice_no: no, client_group: g, customer_raw_name: g, invoice_date: '2026-05-10', month: 'May', quarter: 'Q2', year: 2026, products: 'Flights', service_type: 'Flights', record_type: 'b2b',
  total_incl_vat_sar: v, wallet_portion_sar: 0, revenue_sar: v, cost_sar: 0, profit_sar: v, amount_received_sar: v, amount_remaining_sar: 0, integrity_status: 'verified_paid', exclusion_reason: null, notes: null,
  source_batch: 'qa-aa', revenue_way: 'invoice', created_at: '2026-05-10T00:00:00Z', updated_at: '2026-05-10T00:00:00Z', deleted_at: null });
const ROWS = [row(SIB_LINKED, '777000001', 1000), row(SIB_NEW, '777000002', 1000), row(DECOY, '777000004', 1000), row(AR_ALIAS, '777000005', 1000), row(AR_ROW, '777000006', 1000),
  row(PF_ALIAS, '777000009', 700), row(PF_ROW, '777000010', 700), row(SUG_A, '777000007', 500), row(SUG_B, '777000008', 500)];
let srv;
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  /* the harness's own fixture rows stay; these are added to them */
  srv = start(PORT, { company_name_aliases: NAMES });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const WATCH = ['finance_client_links', 'company_name_aliases', 'client_profiles', 'company_discount_codes', 'money_exclusion_rules'];
  const writes = [];
  await p.route(u=>u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const t = u.pathname.replace(/^\/rest\/v1\//, '');
    if (WATCH.includes(t) && !['GET', 'HEAD'].includes(rq.method())) writes.push(rq.method() + ' ' + t + ' ' + (rq.postData() || '').slice(0, 80));
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u=>u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u=>u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u=>u.href.includes('fonts.gstatic.com'), (r) => r.abort());

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && (DB.businesses || []).length > 0 && window.FIN && typeof finLoad === 'function', null, { timeout: 90000 }).catch(() => {});
  /* seed the rows through the table, as an import would (the harness keeps its own rows too) */
  const seeded = await p.evaluate(async (rows) => { const r = await fc().from('finance_invoices').insert(rows.map((x) => { const y = Object.assign({}, x); delete y.year; return y; })).select('id'); return r.error ? r.error.message : (r.data || []).length; }, ROWS);
  if (seeded !== ROWS.length) fail('seeding failed: ' + seeded);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  await p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => {});
  /* render several times, past the retired linker's 400 ms / 1.2 s / 4 s passes */
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(1200); await p.evaluate(() => { try { render(); } catch (_) {} }); }
  await p.waitForTimeout(2500);
  const bizOf = (g) => p.evaluate((n) => { const r = (FIN.rows || []).find((x) => x.client_group === n); const m = r && FIN.m[r.id]; return m ? { biz: m.business_id || null, state: m.merge_state, link: ((FIN.linkByGroup || {})[n] || {}).business_id || null } : null; }, g);

  const base = await bizOf(SIB_LINKED);
  if (base && base.biz === BIZ && base.link === BIZ) ok(`control: the typed spelling "${SIB_LINKED}" is under ${BIZ} (view and FIN.linkByGroup agree)`);
  else fail('control: the typed spelling is not under its company: ' + JSON.stringify(base));

  const fresh = await bizOf(SIB_NEW);
  if (fresh && !fresh.biz && !fresh.link && fresh.state === 'no_client_id') ok(`1: the sibling spelling nobody typed ("${SIB_NEW}") stands alone — no automatic link to its sibling's company`);
  else fail('1: an untyped spelling was linked automatically: ' + JSON.stringify(fresh));
  if (!writes.length) ok('1: the page wrote nothing to any link, name, client-ID, code or rule table through several renders (D17)');
  else fail('1: the page wrote on its own: ' + JSON.stringify(writes.slice(0, 4)));

  const dec = await bizOf(DECOY);
  if (dec && dec.biz === BIZ && dec.link === BIZ) ok(`2 PRECEDENCE: "${DECOY}" is the exact name of company b9, but it was typed into ${BIZ} — it goes to ${BIZ}; a name match decides nothing`);
  else fail(`2 PRECEDENCE: "${DECOY}" should follow its typed name to ${BIZ}, got ${JSON.stringify(dec)} — this is the mechanism that split Client M`);

  const ar = await bizOf(AR_ROW);
  if (ar && ar.biz === BIZ) ok('3 ARABIC VARIANTS: a row spelled ه / إ lands under the company whose typed name is spelled ة / ا');
  else fail(`3 ARABIC VARIANTS: "${AR_ROW}" should match the typed name "${AR_ALIAS}" and land under ${BIZ}, got ${JSON.stringify(ar)}`);

  const pf = await bizOf(PF_ROW);
  if (pf && pf.biz === BIZ) ok('4 PRESENTATION FORMS: a row in shaped Arabic glyphs lands under its normal-form typed name');
  else fail('4 PRESENTATION FORMS: a row in shaped glyphs did not match its typed name — got ' + JSON.stringify(pf));

  await p.evaluate(() => { current = 'finance'; finGo('rules'); });
  await p.waitForTimeout(1200);
  const sug = await p.evaluate(([a, bn]) => [...document.querySelectorAll('tr[data-v117-loose]')].filter((tr) => { const k = tr.getAttribute('data-v117-loose'); return k === a || k === bn; })
    .map((tr) => ({ key: tr.getAttribute('data-v117-loose'), rows: (tr.children[2] || {}).textContent || '' })), [SUG_A, SUG_B]);
  if (sug.length === 1 && /^2\b/.test(sug[0].rows.trim())) ok('5 SUGGESTION: the untyped ة/ه pair waits as ONE entry under Needs a decision (2 rows) — one decision, not two');
  else fail(`5 SUGGESTION: "${SUG_A}" / "${SUG_B}" (ة/ه) should wait as one Needs-a-decision entry with 2 rows — got ${JSON.stringify(sug)}`);

  const realErrors = errors.filter((e) => !/net::ERR_|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5), null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} unexpected JS/console error(s)`);

  await b.close();
  srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nalias-autolink OK — only a typed name links a spelling to a company, in any spelling, and nothing links on its own.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
