/* probe-scale-attacks.mjs (2026-09-03, watch cycle 13) — SCALE. Every Finance tab and export
   driven against a table far past the API's 1000-row ceiling.

   Why this probe exists: Supabase/PostgREST return AT MOST 1000 rows per request no matter what
   the client asks for, and say so only in a Content-Range header nobody reads. A client that
   does not page therefore gets a clean, plausible, WRONG answer — the first 1000 rows presented
   as the company's totals, with nothing on screen admitting it. finLoad() has paged since
   August; the question this probe answers is whether everything else in Finance does too.

   The harness had to be made honest first (same cycle): the mock ignored the Range HEADER
   entirely and returned every row in one response, so a client that pages and a client that
   does not looked identical here. It now honours Range and enforces a 1000-row max like the
   real thing — which is what let checks 4-6 below go red.

   Under test:
     1. The ceiling is real in the harness (an unpaged read of 5,200 rows gets exactly 1,000,
        and Content-Range still reports the true total) — so every check below means something.
     2. Every Finance read pages to completion: invoices, transactions, client profiles,
        client links, and the expense-capture tables.
     3. Every headline number equals an INDEPENDENT recount over all the rows, not the page.
     4. Clients & collections: grand total, the "all N clients, top 10 shown" label, and the
        ageing buckets (including "No invoice date") all add up at scale.
     5. Report Builder: every grouping's rows sum to the same grand total.
     6. Both CSV exports carry every row on screen, with a BOM.
     7. Nothing freezes: each tab renders inside a time budget, and no O(n^2) blow-up.
     8. A hostile shape at scale — 120 client groups, aliases, credit notes, excluded rows,
        date-less rows, string amounts — still totals correctly.

   Run:  node scripts/qa/probe-scale-attacks.mjs        (port 8213)
   Sabotage (file-level, the only kind that bites here — js/16 calls its own local txnLoad and
   finPageAll, so replacing the window copies proves nothing and was dropped after it "passed"):
   revert txnLoad()'s two reads in js/16 to plain unpaged selects → the four transaction/profile
   checks go red. Restore byte-identical (md5) after.
   NOT guarded, said plainly: removing the .order('id') tie-break from the paged invoice read
   changes nothing here, because the mock's sort keeps identical dates in the same order on every
   request. A real database may not, and an unstable sort across page boundaries can show a row
   twice or not at all — that risk is real and this harness cannot reproduce it, so the tie-break
   stays in the code on principle rather than because a check would catch its removal. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8213;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const r2 = (n) => Math.round(n * 100) / 100;

/* ---------------- the fixture: deliberately past every ceiling ---------------- */
const N_INV = 5200, N_TXN = 5200, N_PROF = 1200, N_LINES = 1500;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SERVICES = ['Flights','Hotels','Visa','Packages','Support Services','Umrah','Translation'];
// 120 distinct billing names; 12 of them are a second spelling of another one (the alias shape).
const GROUPS = [];
for (let i = 0; i < 108; i++) GROUPS.push('Scale Co ' + String(i).padStart(3, '0'));
for (let i = 0; i < 12; i++) GROUPS.push('Scale Co ' + String(i).padStart(3, '0') + ' LLC');   // alias twin
const EXCLUDED_GROUP = 'Takamol Scale QA';   // standing exclusion must hold at scale too

function invoices() {
  const out = [];
  for (let i = 0; i < N_INV; i++) {
    const g = GROUPS[i % GROUPS.length];
    const svc = SERVICES[i % SERVICES.length];
    const yr = (i % 5 === 0) ? 2025 : 2026;
    const mo = (i % 12) + 1;
    const sign = (i % 311 === 0) ? -1 : 1;                                 // a few credit notes
    const total = sign * (1000 + (i % 97) * 13);
    const cost = (i % 11 === 0) ? null : Math.round(total * 0.7);        // ~9% with no cost recorded
    const rev = total;
    const noDate = (i % 233 === 0);                                       // a few with no invoice date
    const outstanding = (i % 7 === 0 && sign > 0) ? total : 0;             // ~14% unpaid
    const date = noDate ? null : (yr + '-' + String(mo).padStart(2, '0') + '-' + String((i % 27) + 1).padStart(2, '0'));
    out.push({
      id: 'sc' + i, invoice_no: 'SC-' + (100000 + i), zatca_dpin: (i % 3) ? ('TTIN-' + (500000 + i)) : null,
      client_group: g, customer_raw_name: g,
      invoice_date: date, year: date ? yr : null, month: date ? MONTHS[mo - 1] : null,
      quarter: date ? ('Q' + (Math.floor((mo - 1) / 3) + 1)) : null,
      products: svc, service_type: svc, record_type: 'b2b',
      // profit = revenue − cost on EVERY row, the way the live trigger stores it — a fixture that
      // breaks that invariant would make the app look wrong when it is the fixture that is.
      total_incl_vat_sar: total, wallet_portion_sar: 0,
      revenue_sar: rev, cost_sar: cost, profit_sar: rev - (cost || 0),
      amount_received_sar: outstanding ? 0 : total,
      amount_remaining_sar: outstanding ? total : 0,
      collection_due_date: date, integrity_status: outstanding ? 'pending' : 'verified_paid',
      exclusion_reason: null, notes: null, source_batch: 'scale-qa', vat_sar: 0,
      created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', deleted_at: (i % 401 === 0) ? '2026-08-01T00:00:00Z' : null
    });
  }
  // rows that must NEVER reach a total, at the far end of the table (past every page boundary)
  out.push(Object.assign({}, out[0], { id: 'sc-excl', invoice_no: 'SC-EXCL-1', client_group: EXCLUDED_GROUP, customer_raw_name: EXCLUDED_GROUP, total_incl_vat_sar: 999999, revenue_sar: 999999, cost_sar: 0, profit_sar: 999999, amount_received_sar: 999999, amount_remaining_sar: 0, deleted_at: null }));
  out.push(Object.assign({}, out[0], { id: 'sc-del', invoice_no: 'SC-DEL-1', total_incl_vat_sar: 888888, revenue_sar: 888888, profit_sar: 888888, amount_received_sar: 888888, deleted_at: '2026-08-02T00:00:00Z' }));
  return out;
}
function transactions() {
  const out = [];
  for (let i = 0; i < N_TXN; i++) {
    const invoiced = (i % 3 === 0), ready = (!invoiced && i % 3 === 1);
    out.push({
      id: 'stx' + i, transaction_ref: 'STX-' + (200000 + i), invoice_no: invoiced ? ('SC-' + (100000 + i)) : null,
      zatca_dpin: invoiced ? ('TTIN-' + (500000 + i)) : null, direct_uuid: null,
      business_id: 'b' + (i % 5), client_profile_id: 'scp' + (i % N_PROF),
      product: 'Direct ' + SERVICES[i % SERVICES.length], service_type: SERVICES[i % SERVICES.length],
      amount_sar: 500 + (i % 89) * 11,
      expense_status: ready ? 'ready' : (invoiced ? null : 'pending'),
      cost_confirmed_sar: (invoiced || ready) ? Math.round((500 + (i % 89) * 11) * 0.72) : 0,
      cost_estimate_sar: (invoiced || ready) ? null : Math.round((500 + (i % 89) * 11) * 0.75),
      amount_received_sar: (i % 4 === 0) ? 0 : (500 + (i % 89) * 11),
      amount_remaining_sar: (i % 4 === 0) ? (500 + (i % 89) * 11) : 0,
      overdue: (i % 53 === 0) ? true : null,           // ~2%, some of them ALSO invoiced (cycle 4's mirror)
      created_at_source: '2026-0' + ((i % 8) + 1) + '-1' + (i % 9) + 'T10:00:00Z',
      origin: 'booking', proposal_ref: null, source: 'scale-qa', deleted_at: null
    });
  }
  return out;
}
function profiles() {
  const out = [];
  for (let i = 0; i < N_PROF; i++) out.push({ id: 'scp' + i, business_id: 'b' + (i % 5), direct_client_id: 'DC-' + (7000 + i), profile_type: (i % 4 === 0) ? 'tender' : (i % 4 === 1 ? 'prepaid' : 'postpaid'), payment_terms: 'Net 30', billing_cycle: 'monthly', status: 'active' });
  return out;
}
function expenseLines() {
  const out = [];
  for (let i = 0; i < N_LINES; i++) out.push({ id: 'sel' + i, invoice_no: 'SC-' + (100000 + i), line_no: 1, supplier: 'Supplier ' + (i % 40), amount_sar: 100 + (i % 50), currency: 'SAR', captured_at: '2026-08-01T00:00:00Z', batch_id: 'scale-qa' });
  return out;
}
const SEED_INV = invoices(), SEED_TXN = transactions(), SEED_PROF = profiles(), SEED_LINES = expenseLines();
const srv = start(PORT, {
  finance_invoices: SEED_INV,
  finance_transactions: SEED_TXN,
  client_profiles: SEED_PROF,
  finance_expense_lines_capture: SEED_LINES,
  // Each billing name gets its OWN client, EXCEPT the 12 "… LLC" twins, which point at the same
  // client as their base name — the alias shape, carried all the way out to 120 groups.
  finance_client_links: GROUPS.map((g, i) => ({ id: 'scl' + i, client_group: g, business_id: (i < 108 ? ('sbz' + i) : ('sbz' + (i - 108))), is_client: true, confirmed_by: 'auto-match' }))
});
const BASE = 'http://localhost:' + PORT;

/* ---------- the independent recount: computed HERE, from the seed, never from the page ---------- */
const liveInv = SEED_INV.filter(r => !r.deleted_at && r.client_group !== EXCLUDED_GROUP);
const num = (v) => (v == null || v === '') ? 0 : (typeof v === 'number' ? (isFinite(v) ? v : 0) : (isFinite(parseFloat(String(v).replace(/[,\s]/g, ''))) ? parseFloat(String(v).replace(/[,\s]/g, '')) : 0));
// The Performance tiles, the Top-clients table and the Report Builder all read VERIFIED-PAID
// rows (their own subtitle says so); Outstanding is the one number read over every live row.
const verInv = liveInv.filter(r => r.integrity_status === 'verified_paid');
const WANT = {
  rows: SEED_INV.length,
  live: liveInv.length,
  verified: verInv.length,
  revenue: r2(verInv.reduce((a, r) => a + num(r.revenue_sar), 0)),
  cost: r2(verInv.reduce((a, r) => a + num(r.cost_sar), 0)),
  invoices: new Set(verInv.map(r => r.invoice_no)).size,
  liveInvoices: new Set(liveInv.map(r => r.invoice_no)).size,
  outstanding: r2(liveInv.reduce((a, r) => a + num(r.amount_remaining_sar), 0)),
  txn: SEED_TXN.length,
  txnOverdue: SEED_TXN.filter(t => t.overdue === true).length,
  txnConfirmedRevenue: r2(SEED_TXN.filter(t => t.invoice_no || t.expense_status === 'ready').reduce((a, t) => a + num(t.amount_sar), 0)),
  profiles: SEED_PROF.length,
  lines: SEED_LINES.length,
  groups: new Set(liveInv.map(r => r.client_group)).size,
  clients: 108,
  liveRevenue: r2(liveInv.reduce((a, r) => a + num(r.revenue_sar), 0))
};
WANT.profit = r2(verInv.reduce((a, r) => a + num(r.profit_sar), 0));

async function main() {
  console.log(`fixture: ${N_INV} invoices · ${N_TXN} transactions · ${N_PROF} profiles · ${N_LINES} expense lines · ${WANT.groups} client groups`);
  /* ---------- 1-2. the ceiling is real in the harness ---------- */
  const raw = await fetch(BASE + '/rest/v1/finance_invoices?select=*');
  const rawRows = await raw.json();
  if (rawRows.length === 1000) ok(`an unpaged read of ${N_INV} invoices gets back exactly 1000 — the API ceiling is real here`);
  else fail(`unpaged read returned ${rawRows.length}, expected the 1000-row ceiling — every check below would be meaningless`);
  const cr = raw.headers.get('content-range');
  if (cr && cr.split('/')[1] === String(SEED_INV.length)) ok(`Content-Range still reports the true total (${cr}) — the truncation is silent unless you read it`);
  else fail(`Content-Range was "${cr}", expected .../${SEED_INV.length}`);

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate(() => {
    // one business per base billing name, so a linked group resolves to a NAMED client and the
    // twelve "… LLC" twins fold onto the same client as their base
    DB.businesses = DB.businesses || [];
    for (let i = 0; i < 108; i++) DB.businesses.push({ id: 'sbz' + i, name: 'Scale Client ' + String(i).padStart(3, '0'), isClient: true, paymentTerms: 'Net 30' });
  });
  await p.evaluate((g) => {
    DB.settings = DB.settings || {};
    DB.settings.financeExclusions = [{ id: 'fx-scale', clientId: 'scale-excl', matchNames: [g], reason: 'QA scale fixture', addedBy: 'probe', addedAt: new Date().toISOString() }];
  }, EXCLUDED_GROUP);
  await p.evaluate(() => { current = 'finance'; render(); });
  const settle = async (budgetMs = 30000) => {
    const t0 = Date.now(); let last = -1, same = 0;
    while (Date.now() - t0 < budgetMs) {
      const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0);
      if (h === last && h > 0) { same++; if (same >= 3) return Date.now() - t0; } else same = 0;
      last = h; await p.waitForTimeout(200);
    }
    return Date.now() - t0;
  };
  for (let i = 0; i < 120 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 5000)); i++) await p.waitForTimeout(250);
  await settle();

  /* ---------- 3. every read pages to completion ---------- */
  const loaded = await p.evaluate(() => ({
    inv: (window.FIN && FIN.rows) ? FIN.rows.length : -1,
    links: (window.FIN && FIN.links) ? FIN.links.length : -1
  }));
  if (loaded.inv === WANT.rows) ok(`invoices: all ${WANT.rows} loaded (the read pages past the ceiling)`);
  else fail(`invoices: page holds ${loaded.inv} rows, the table has ${WANT.rows} — ${WANT.rows - loaded.inv} silently missing`);
  if (loaded.links === GROUPS.length) ok(`client links: all ${GROUPS.length} loaded`);
  else fail(`client links: ${loaded.links} of ${GROUPS.length} loaded`);

  /* ---------- the shared paging helper, on the table that grows fastest ---------- */
  // Every read in the Finance lane now goes through window.finPageAll (js/16). Prove the helper
  // itself against finance_expense_lines_capture — one row per expense line per transaction, the
  // table that outgrows every other — and prove what the pre-fix single select would have got.
  const helperN = await p.evaluate(() => new Promise(res => {
    try {
      const c = fc();
      window.finPageAll(() => c.from('finance_expense_lines_capture').select('transaction_ref,amount_sar,expense_status').order('transaction_ref', { ascending: true }), r => res((r && r.data) ? r.data.length : -1));
    } catch (e) { res(-1); }
  }));
  if (helperN === N_LINES) ok(`the shared paging helper reads all ${N_LINES} expense-capture lines (the table every Finance read now goes through it for)`);
  else fail(`the shared paging helper returned ${helperN} of ${N_LINES} expense-capture lines`);
  const unpagedN = await p.evaluate(() => new Promise(res => {
    try { fc().from('finance_expense_lines_capture').select('transaction_ref').then(r => res((r && r.data) ? r.data.length : -1)); } catch (e) { res(-1); }
  }));
  if (unpagedN === 1000) ok(`the same read WITHOUT paging gets 1000 of ${N_LINES} and no error — this is the shape the fix removes`);
  else fail(`an unpaged read returned ${unpagedN}, expected the silent 1000-row truncation`);

  /* ---------- 4-9. Performance (Overview) tiles vs an independent recount ---------- */
  const tile = async (label) => p.evaluate((label) => {
    const els = [...document.querySelectorAll('#view .card')];
    const el = els.find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    if (!el) return null; const v = el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : (v ? +v.textContent.trim().replace(/[^\d.-]/g, '') : null);
  }, label);
  await p.evaluate(() => { FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('overview'); });
  const tOverview = await settle();
  for (const [label, want] of [['Revenue', WANT.revenue], ['Cost', WANT.cost], ['Profit', WANT.profit]]) {
    const got = await tile(label);
    if (got != null && Math.abs(got - want) < 1) ok(`${label} tile = ${want.toLocaleString()} — matches an independent recount of all ${WANT.verified} verified rows`);
    else fail(`${label} tile shows ${got}, an independent recount of all rows gives ${want}`);
  }
  const hdr = await p.evaluate(() => { const m = document.querySelector('#view').innerHTML.match(/(\d[\d,]*) invoices · data through/); return m ? +m[1].replace(/,/g, '') : null; });
  if (hdr === WANT.liveInvoices) ok(`header counts ${WANT.liveInvoices} distinct invoices — every page of the table, not the first`);
  else fail(`header counts ${hdr} invoices, the table holds ${WANT.liveInvoices} distinct numbers`);
  const excl = await p.evaluate(() => document.querySelector('#view').innerHTML.indexOf('999,999') >= 0 || document.querySelector('#view').innerHTML.indexOf('888,888') >= 0);
  if (!excl) ok('the excluded row and the deleted row at the far end of the table reach no total');
  else fail('an excluded or deleted row past the 1000-row boundary reached a total on screen');
  if (tOverview < 20000) ok(`Performance renders in ${(tOverview / 1000).toFixed(1)}s at ${WANT.live} rows`);
  else fail(`Performance took ${(tOverview / 1000).toFixed(1)}s at ${WANT.live} rows — too slow to use`);

  /* ---------- 10-13. Clients & collections ---------- */
  await p.evaluate(() => finGo('clients'));
  const tClients = await settle();
  const clientsHtml = await p.evaluate(() => document.querySelector('#view').innerHTML);
  const nLabel = clientsHtml.match(/all (\d+) clients, top 10 shown/);
  if (nLabel && +nLabel[1] === WANT.clients) ok(`Top clients total is labelled "all ${WANT.clients} clients, top 10 shown" — the twelve alias twins folded into their base client, and the total is not mistaken for the ten rows`);
  else fail(`Top clients label reads ${nLabel ? nLabel[0] : 'nothing'}; expected all ${WANT.clients} clients (120 billing names, 12 of them alias twins)`);
  const ageing = await p.evaluate(() => {
    // Recompute the ageing split the same way rClients does, but over the page's own chokepoint,
    // so this measures the DATA that reached the render (the thing scale threatens) rather than
    // an abbreviated "145.0K" on screen.
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod || (() => true));
    let out = 0, nodate = 0; const now = Date.now();
    const ag = { b030: 0, b3160: 0, b6190: 0, b90: 0 };
    rows.forEach(r => {
      const o = +r.amount_remaining_sar || 0; if (o <= 0) return; out += o;
      const d = r.invoice_date ? new Date(r.invoice_date).getTime() : NaN;
      if (isNaN(d)) { nodate += o; return; }
      const days = Math.floor((now - d) / 86400000);
      if (days <= 30) ag.b030 += o; else if (days <= 60) ag.b3160 += o; else if (days <= 90) ag.b6190 += o; else ag.b90 += o;
    });
    return { out: Math.round(out * 100) / 100, nodate: Math.round(nodate * 100) / 100, buckets: Math.round((ag.b030 + ag.b3160 + ag.b6190 + ag.b90) * 100) / 100 };
  });
  if (Math.abs(ageing.out - WANT.outstanding) < 2) ok(`outstanding across every page of the table = ${WANT.outstanding.toLocaleString()}, matching an independent recount`);
  else fail(`the page sees ${ageing.out} outstanding, an independent recount of all rows gives ${WANT.outstanding}`);
  if (Math.abs((ageing.buckets + ageing.nodate) - ageing.out) < 2) ok('every outstanding riyal lands in exactly one ageing bucket — nothing lost between them at scale');
  else fail(`ageing buckets + no-date = ${ageing.buckets + ageing.nodate}, outstanding = ${ageing.out}`);
  if (ageing.nodate > 0 && clientsHtml.indexOf('No invoice date') >= 0) ok(`date-less outstanding money (${ageing.nodate.toLocaleString()}) is shown in its own "No invoice date" bucket, not aged as 0–30 days`);
  else fail('the date-less bucket is missing on screen though date-less unpaid rows exist');
  if (!/NaN|undefined/.test(clientsHtml)) ok('no NaN or undefined on the Clients tab at scale');
  else fail('NaN or undefined rendered on the Clients tab');
  if (tClients < 20000) ok(`Clients & collections renders in ${(tClients / 1000).toFixed(1)}s`);
  else fail(`Clients & collections took ${(tClients / 1000).toFixed(1)}s`);

  /* ---------- 14-18. Ledger (transactions) ---------- */
  await p.evaluate(() => finGo('ledger'));
  for (let i = 0; i < 120 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.rows.length)); i++) await p.waitForTimeout(250);
  const tLedger = await settle();
  const txnState = await p.evaluate(() => ({
    rows: (window.TXN && TXN.rows) ? TXN.rows.length : -1,
    profiles: (window.TXN && TXN.profiles) ? Object.keys(TXN.profiles).length : -1,
    overdue: (window.TXN && TXN.rows) ? TXN.rows.filter(t => t.overdue === true).length : -1,
    confirmed: (window.TXN && TXN.rows) ? Math.round(TXN.rows.filter(t => t.invoice_no || t.expense_status === 'ready').reduce((a, t) => a + (+t.amount_sar || 0), 0) * 100) / 100 : -1
  }));
  if (txnState.rows === WANT.txn) ok(`transactions: all ${WANT.txn} loaded`);
  else fail(`transactions: the Ledger holds ${txnState.rows} of ${WANT.txn} rows — ${WANT.txn - txnState.rows} silently missing, and every Ledger total is computed from the short list`);
  if (txnState.profiles === WANT.profiles) ok(`client profiles: all ${WANT.profiles} loaded`);
  else fail(`client profiles: ${txnState.profiles} of ${WANT.profiles} loaded — transactions past the cut lose their company and profile type`);
  if (txnState.overdue === WANT.txnOverdue) ok(`Overdue counts all ${WANT.txnOverdue} flagged transactions across the whole table`);
  else fail(`Overdue counts ${txnState.overdue}, the table holds ${WANT.txnOverdue}`);
  if (Math.abs(txnState.confirmed - WANT.txnConfirmedRevenue) < 1) ok(`confirmed revenue on the Ledger = ${WANT.txnConfirmedRevenue.toLocaleString()}, an independent recount of every transaction`);
  else fail(`confirmed revenue is ${txnState.confirmed}, an independent recount gives ${WANT.txnConfirmedRevenue}`);
  const filtered = await p.evaluate(() => { TXN.f.stage = 'overdue'; render(); return null; });
  await settle();
  const overdueShown = await p.evaluate(() => (document.querySelector('#view').innerHTML.match(/STX-/g) || []).length);
  await p.evaluate(() => { TXN.f.stage = 'all'; render(); }); await settle();
  if (overdueShown > 0) ok(`the Overdue filter lists ${overdueShown} rows without freezing at ${WANT.txn} transactions`);
  else fail('the Overdue filter listed nothing at scale');
  if (tLedger < 25000) ok(`Ledger renders in ${(tLedger / 1000).toFixed(1)}s at ${WANT.txn} transactions`);
  else fail(`Ledger took ${(tLedger / 1000).toFixed(1)}s at ${WANT.txn} transactions — too slow to use`);

  /* ---------- 19-22. Report Builder: every grouping sums to the same grand total ---------- */
  await p.evaluate(() => finGo('reports')); await settle();
  const groupings = [['month', ''], ['__client', ''], ['quarter', 'service_type'], ['service_type', '']];
  for (const [g1, g2] of groupings) {
    const got = await p.evaluate(([g1, g2]) => {
      FIN.rb.g1 = g1; FIN.rb.g2 = g2; FIN.rb.verifiedOnly = true; FIN.rb.quarter = 'all';
      FIN.rb.metrics = { revenue_sar: true, cost_sar: true, profit_sar: true };
      render();
      return new Promise(res => setTimeout(() => {
        // the grand total row is the one whose first cell reads TOTAL (bold, dark, last in the table)
        const tr = [...document.querySelectorAll('#view table tr')].filter(t => t.children.length && /^(TOTAL|الإجمالي)/.test((t.children[0].textContent || '').trim())).pop();
        if (!tr) return res({ grand: null, rows: 0 });
        const cells = [...tr.children].slice(1).map(td => +String(td.textContent).replace(/[^\d.-]/g, ''));
        const bodyRows = [...document.querySelectorAll('#view table tbody tr')].length;
        return res({ grand: cells[0], cost: cells[1], profit: cells[2], rows: bodyRows });
      }, 1200));
    }, [g1, g2]);
    const lbl = g1 + (g2 ? ' › ' + g2 : '');
    if (got.grand != null && Math.abs(got.grand - WANT.revenue) < 2) ok(`Report Builder grouped by ${lbl}: grand total ${WANT.revenue.toLocaleString()} — the same recount every other tab agrees on (${got.rows} rows rendered)`);
    else fail(`Report Builder grouped by ${lbl}: grand total ${got.grand}, independent recount ${WANT.revenue}`);
    if (got.grand != null && got.cost != null && Math.abs((got.grand - got.cost) - (got.profit == null ? NaN : got.profit)) < 2) ok(`  …and its profit column is still revenue − cost at ${lbl}`);
    else fail(`  grouped by ${lbl}: profit ${got.profit} ≠ revenue ${got.grand} − cost ${got.cost}`);
  }

  /* ---------- 23-25. exports carry every row ---------- */
  const grabCsv = async (fn) => p.evaluate((fn) => new Promise(res => {
    let captured = null;
    const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    try { window[fn](); } catch (e) { }
    URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick;
    if (!captured) return res(null);
    captured.arrayBuffer().then(ab => res(Array.from(new Uint8Array(ab)).map(c => String.fromCharCode(c)).join('')));
  }), fn);
  await p.evaluate(() => finGo('ledger')); await settle();
  const shownLedger = await p.evaluate(() => (window.TXN && TXN._csvRows) ? TXN._csvRows.length : -1);
  const csvLedger = await grabCsv('finTxnCSV');
  if (csvLedger) {
    const lines = csvLedger.replace(/\n$/, '').split('\n').length - 1;
    if (lines === shownLedger) ok(`Ledger CSV holds every one of the ${lines} rows on screen`);
    else fail(`Ledger CSV holds ${lines} rows, the screen shows ${shownLedger}`);
    if (csvLedger.charCodeAt(0) === 0xEF && csvLedger.charCodeAt(1) === 0xBB && csvLedger.charCodeAt(2) === 0xBF) ok('Ledger CSV still starts with a UTF-8 BOM at scale'); else fail('Ledger CSV lost its BOM');
  } else { fail('Ledger CSV produced no file'); fail('Ledger CSV BOM unverifiable'); }
  await p.evaluate(() => { finGo('overview'); }); await settle();
  const shownInv = await p.evaluate(() => (window.FIN && FIN._csvRows) ? FIN._csvRows.length : -1);
  const csvInv = await grabCsv('finLedgerCSV');
  if (csvInv) {
    const lines = csvInv.replace(/\n$/, '').split('\n').length - 1;
    if (shownInv > 0 && lines === shownInv) ok(`invoice CSV holds every one of the ${lines} rows behind the screen`);
    else fail(`invoice CSV holds ${lines} rows, the page's own export set has ${shownInv}`);
  } else ok('invoice CSV not offered from this tab (nothing to export) — not a failure');

  /* ---------- 26. the alias shape at scale ---------- */
  const aliasOk = await p.evaluate(() => {
    // 12 groups are a second spelling ("… LLC") of another; canonical rollup must not lose money
    const rows = window.finLive ? finLive() : [];
    const total = rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0);
    return Math.round(total * 100) / 100;
  });
  if (Math.abs(aliasOk - WANT.liveRevenue) < 1) ok(`the chokepoint still totals ${WANT.liveRevenue.toLocaleString()} across all ${WANT.live} live rows, with ${WANT.groups} client groups and alias twins in play`);
  else fail(`chokepoint total ${aliasOk} vs recount ${WANT.liveRevenue}`);

  /* ---------- 27. nothing threw ---------- */
  if (!errors.length) ok('no page errors through the whole run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));

  await b.close(); srv.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
