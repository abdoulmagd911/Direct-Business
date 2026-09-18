/* probe-import-revenue-has-no-vat-in-it.mjs — guards the 2026-09-18 (fire #93) fix in js/41.
   M1 is the highest rule this project has: cost, profit and revenue must always be clean, and VAT must
   never enter or be mixed into any of the three. js/41's row builder computed
       revenue = total − VAT
   which is that prohibition exactly. The doctrine, the database trigger `finance_derive_fields`
   (BEFORE INSERT OR UPDATE on finance_invoices) and js/65's own importer all say revenue = total −
   wallet. This was the only place in the app that subtracted VAT instead.
   It had never produced a wrong STORED figure, for two independent reasons: every VAT value in the
   live ledger is 0.00, so both formulas returned the same number, and the trigger rewrites revenue
   whenever it differs from total − wallet by more than a hundredth. But the app was computing it
   wrongly on the live import path — js/65's importer calls js/41's builder through
   window.__v65_toRowsDP — and a Direct Payments export carrying real VAT would have had the app's
   arithmetic disagree with the ledger it was writing to. A doctrine that holds only because a trigger
   silently corrects it is not being followed.
   This probe feeds the REAL parser a synthetic Direct Payments export with a REAL 15% VAT line — the
   case the live data cannot produce, because its VAT is zero everywhere — and checks the row the app
   would send. Everything in the fixture is invented; no real company, invoice or amount appears.
   NOT changed, and asserted so: the fee-pair maths a few lines above divides a VAT-inclusive taxable
   total by 1.15 to get Direct's net service fee and records the VAT separately. That REMOVES VAT
   rather than mixing it in, which is what the doctrine wants — a rule flagging "a profit line that
   mentions VAT" was measured, would have flagged this correct code, and was rejected for that reason.
   Sabotage-tested: with the js/41 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-import-revenue-has-no-vat-in-it.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9070; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const wrote = [];
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof window.__v65_parseDP === 'function' && typeof window.__v65_toRowsDP === 'function', { timeout: 90000 });
await p.waitForTimeout(2500);

/* A synthetic Direct Payments export. Entirely invented — the shape is real, the content is not.
   One taxable service line of 1,150.00 (1,000 net + 15% VAT) and one non-taxable supplier cost of
   700.00, on a 1,850.00 invoice. With real VAT present, the two formulas finally disagree:
       total − wallet = 1850.00   (the doctrine, the trigger, js/65)
       total − VAT    = 1700.00   (what js/41 used to compute) */
const HEADER = ['Type', 'Invoice Reference #', 'Invoice Number', 'Invoice Create Date', 'Invoice Status',
  'Customer Name', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Invoice Total',
  'Sale Branch', 'Salesman'];
const ROWS = [HEADER,
  ['invoice', 'QA-REF-1', 'QA-INV-1', '2026-03-14', 'Paid', 'QA Fixture Company', 'Flights', '', '', '', '', '1850.00', 'QA Branch', 'QA Seller'],
  ['item', 'QA-REF-1', '', '', '', 'QA Fixture Company', 'Flights', 'Service fee', 'Yes', '0', '1150.00', '1850.00', 'QA Branch', 'QA Seller'],
  ['item', 'QA-REF-1', '', '', '', 'QA Fixture Company', 'Flights', 'Supplier cost', 'No', '0', '700.00', '1850.00', 'QA Branch', 'QA Seller'],
  /* and a wallet top-up, which the owner's 2026-08-12 rule says is never imported at all — the
     surrounding exclusions must survive a change to the revenue line right beside them */
  ['invoice', 'QA-REF-2', 'QA-INV-2', '2026-03-15', 'Paid', 'QA Fixture Company', 'Direct Wallet', '', '', '', '', '500.00', 'QA Branch', 'QA Seller'],
  ['item', 'QA-REF-2', '', '', '', 'QA Fixture Company', 'Direct Wallet', 'Wallet Balance top-up', 'No', '0', '500.00', '500.00', 'QA Branch', 'QA Seller'],
];
const out = await p.evaluate((rows2d) => {
  const parsed = window.__v65_parseDP(rows2d);
  const built = window.__v65_toRowsDP(parsed);
  return { parsed: parsed.map((x) => ({ ref: x.ref, total: x.total, vat: x.vat, cost: x.cost, profit: x.profit, wallet: !!x.wallet })), built,
    excluded: (window.__v65_exclusionCounts ? window.__v65_exclusionCounts() : null) };
}, ROWS);
await b.close(); srv.close?.();

const row = (out.built || [])[0] || null;
const parsed = (out.parsed || [])[0] || null;
const near = (a, b2) => typeof a === 'number' && Math.abs(a - b2) < 0.011;
const checks = [
  ['the real parser read the synthetic export and built exactly one row — the wallet top-up is not one of them', !!parsed && !!row && out.built.length === 1],
  ['the fixture really does carry VAT, so the two formulas can disagree', !!parsed && near(parsed.vat, 150)],
  ['revenue is total minus wallet — the doctrine, the trigger and js/65 all agree on this', !!row && near(row.revenue_sar, 1850)],
  ['revenue is NOT total minus VAT — that is M1\'s exact prohibition', !!row && !near(row.revenue_sar, 1700)],
  ['the VAT is still recorded in its own column, never lost', !!row && near(row.vat_sar, 150)],
  ['the total is sent unchanged', !!row && near(row.total_incl_vat_sar, 1850)],
  ['the non-taxable supplier line is the cost, untouched by VAT', !!row && near(row.cost_sar, 700)],
  ['the fee-pair maths still nets VAT OUT of Direct\'s own fee (1150 ÷ 1.15 = 1000)', !!parsed && near(parsed.profit, 1000)],
  /* this used to read `true === true`, which can never fail — the tautology the integrity gate exists
     to catch. It now asserts the real thing: the wallet top-up in the fixture was counted as skipped
     and never became a row. */
  ['the wallet top-up beside it is still skipped entirely, never imported', !!out.excluded && out.excluded.wallet === 1 && !out.built.some((r) => r.invoice_no === 'QA-REF-2')],
  ['reading the parser wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ parsed, row: row && { total_incl_vat_sar: row.total_incl_vat_sar, wallet_portion_sar: row.wallet_portion_sar, revenue_sar: row.revenue_sar, cost_sar: row.cost_sar, profit_sar: row.profit_sar, vat_sar: row.vat_sar } }, null, 1)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
