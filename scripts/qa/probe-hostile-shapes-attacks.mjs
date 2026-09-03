/* probe-hostile-shapes-attacks.mjs (2026-09-03, watch cycle 16) - shapes the live SCHEMA permits
   that no earlier cycle has put on screen.

   The fixtures in this repo have always looked like today's 46 rows: one line per invoice, dates
   inside one year, nothing negative, no wallet. The live table permits much more than that, and
   the 653-invoice backfill will bring it. Every shape here was chosen by reading the real schema
   (information_schema + pg_constraint on the live database, this cycle), not invented:

     - line_no is NOT NULL default 1 and the unique key is (invoice_no, line_no): a tax invoice
       with several service lines is legal and normal. Is it counted ONCE as an invoice while its
       money is counted once PER LINE - or is a client charged twice?
     - invoice_date is a real DATE, NOT NULL, no default: no null dates are possible in production
       (an earlier cycle's fixture assumed otherwise), but a ten-year span and future dates are.
     - fin_nonneg_chk permits a negative total ONLY on integrity_status 'credit_note'.
     - fin_wallet_le_total_chk permits wallet == total (revenue then falls to exactly zero).
     - client_group is NOT NULL but "" and 400 characters both pass.

   Under test: the distinct-invoice count, the client rollup, the ageing split, the Report Builder
   at every grouping, and both CSV exports, against all of the above at once - each headline
   number recounted independently from the fixture, never read back off the screen.

   Run:  node scripts/qa/probe-hostile-shapes-attacks.mjs        (port 8219)
   Sabotage (file-level): make rOverview count rows instead of distinct invoice numbers ->
   the multi-line check goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8219;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const r2 = (n) => Math.round(n * 100) / 100;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const LONG_NAME = 'Very Long Client Name ' + 'x'.repeat(380);
const BLANK_NAME = '   ';
function row(o) {
  const d = o.invoice_date, mo = d ? +d.slice(5, 7) : null;
  const total = o.total, cost = o.cost == null ? 0 : o.cost, wallet = o.wallet || 0;
  const revenue = r2(total - wallet);
  return {
    id: o.id, invoice_no: o.no, line_no: o.line == null ? 1 : o.line, zatca_dpin: null,
    client_group: o.group, customer_raw_name: o.group,
    invoice_date: d, year: +d.slice(0, 4), month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: o.svc || 'Flights', service_type: o.svc || 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: wallet,
    revenue_sar: revenue, cost_sar: cost, profit_sar: r2(revenue - cost),
    vat_sar: 0, amount_received_sar: o.outstanding ? 0 : (total < 0 ? 0 : total),
    amount_remaining_sar: o.outstanding ? total : 0,
    collection_due_date: d, integrity_status: o.status || 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'hostile-qa', revenue_way: 'invoice',
    created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', deleted_at: null
  };
}
const SEED = [];
// (a) one tax invoice, four service lines - the shape the backfill will bring
['Flights', 'Hotels', 'Visa', 'Packages'].forEach((svc, i) =>
  SEED.push(row({ id: 'ml' + i, no: 'HS-MULTI-1', line: i + 1, group: 'Multiline Co', invoice_date: '2026-05-1' + i, total: 1000, cost: 400, svc })));
// (b) a ten-year span, one invoice a year
for (let y = 2016; y <= 2026; y++) SEED.push(row({ id: 'yr' + y, no: 'HS-Y-' + y, group: 'Decade Co', invoice_date: y + '-07-04', total: 500, cost: 200 }));
// (c) future-dated
SEED.push(row({ id: 'fut1', no: 'HS-FUT-1', group: 'Future Co', invoice_date: '2027-11-30', total: 900, cost: 300 }));
SEED.push(row({ id: 'fut2', no: 'HS-FUT-2', group: 'Future Co', invoice_date: '2028-01-15', total: 800, cost: 250, outstanding: true, status: 'pending' }));
// (d) edges: zero, sub-riyal, very large
SEED.push(row({ id: 'z0', no: 'HS-ZERO', group: 'Edge Co', invoice_date: '2026-06-01', total: 0, cost: 0 }));
SEED.push(row({ id: 'z1', no: 'HS-CENT', group: 'Edge Co', invoice_date: '2026-06-02', total: 0.005, cost: 0 }));
SEED.push(row({ id: 'z2', no: 'HS-BIG', group: 'Edge Co', invoice_date: '2026-06-03', total: 9876543.21, cost: 1234567.89 }));
// (e) wallet exactly equal to total -> revenue is exactly zero (allowed by fin_wallet_le_total_chk)
SEED.push(row({ id: 'w1', no: 'HS-WALLET', group: 'Wallet Co', invoice_date: '2026-06-04', total: 5000, cost: 0, wallet: 5000 }));
// (f) a credit note with a negative total - the only shape fin_nonneg_chk allows to be negative
SEED.push(row({ id: 'cn1', no: 'HS-CREDIT', group: 'Multiline Co', invoice_date: '2026-06-05', total: -750, cost: 0, status: 'credit_note' }));
// (g) names: blank-ish and 400 characters
SEED.push(row({ id: 'nm1', no: 'HS-BLANKNAME', group: BLANK_NAME, invoice_date: '2026-06-06', total: 1200, cost: 500 }));
SEED.push(row({ id: 'nm2', no: 'HS-LONGNAME', group: LONG_NAME, invoice_date: '2026-06-07', total: 1300, cost: 600 }));
// (i) a SOFT-DELETED invoice carrying a distinctive amount. Added 2026-09-03 (watch cycle 17)
// after a mutation audit: breaking live()'s deleted-row filter was caught by exactly ONE probe in
// the whole battery (the 5,200-row scale one) and by none of the five whose subject is closest to
// it. "Deleted means gone from every total" is the most basic money rule in this app; it now has
// a direct, fast guard as well.
SEED.push(Object.assign(row({ id: 'del1', no: 'HS-DELETED', group: 'Edge Co', invoice_date: '2026-06-08', total: 555555, cost: 111111 }), { deleted_at: '2026-08-01T00:00:00Z' }));
// (h) outstanding money, so the ageing card has something to split
SEED.push(row({ id: 'os1', no: 'HS-OPEN-1', group: 'Decade Co', invoice_date: '2026-01-10', total: 2000, cost: 800, outstanding: true, status: 'pending' }));
SEED.push(row({ id: 'os2', no: 'HS-OPEN-2', group: 'Edge Co', invoice_date: '2016-01-10', total: 3000, cost: 900, outstanding: true, status: 'pending' }));

const srv = start(PORT, { finance_invoices: SEED });
const BASE = 'http://localhost:' + PORT;

/* independent recount, from the fixture, never from the page */
const live = SEED.filter(r => !r.deleted_at);
const ver = live.filter(r => r.integrity_status === 'verified_paid');
const WANT = {
  rows: live.length,
  distinctInvoices: new Set(ver.map(r => r.invoice_no)).size,
  revenue: r2(ver.reduce((a, r) => a + r.revenue_sar, 0)),
  cost: r2(ver.reduce((a, r) => a + r.cost_sar, 0)),
  profit: r2(ver.reduce((a, r) => a + r.profit_sar, 0)),
  outstanding: r2(live.reduce((a, r) => a + r.amount_remaining_sar, 0)),
  multilineRevenue: r2(ver.filter(r => r.invoice_no === 'HS-MULTI-1').reduce((a, r) => a + r.revenue_sar, 0)),
  years: [...new Set(live.map(r => r.year))].sort()
};

async function main() {
  console.log('fixture: ' + WANT.rows + ' rows · ' + WANT.distinctInvoices + ' distinct verified invoice numbers · years ' + WANT.years[0] + '-' + WANT.years[WANT.years.length - 1]);
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; render(); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  const settle = async () => { let last = -1, same = 0; for (let i = 0; i < 40; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last && h > 0) { same++; if (same >= 3) return; } else same = 0; last = h; await p.waitForTimeout(200); } };
  await settle();
  const tile = async (label) => p.evaluate((label) => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    if (!el) return null; const v = el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : (v ? +v.textContent.trim().replace(/[^\d.-]/g, '') : null);
  }, label);

  /* ---------- 1. multi-line invoices ---------- */
  const hdr = await p.evaluate(() => { const m = document.querySelector('#view').innerHTML.match(/(\d[\d,]*) invoices · data through/); return m ? +m[1].replace(/,/g, '') : null; });
  const liveDistinct = new Set(live.map(r => r.invoice_no)).size;
  if (hdr === liveDistinct) ok('a four-line tax invoice counts as ONE invoice, not four: the header reads ' + liveDistinct + ' distinct invoice numbers across ' + WANT.rows + ' rows');
  else fail('the header counts ' + hdr + ' invoices; there are ' + liveDistinct + ' distinct numbers across ' + WANT.rows + ' rows (a multi-line invoice must not be counted per line)');
  // the header strip and the Invoices tile are TWO different counters (finTabs vs rOverview) —
  // check both, or a sabotage of one passes because the other is being read
  const deletedGone = !/555,555|555555/.test(await p.evaluate(() => document.querySelector('#view').innerHTML));
  if (deletedGone) ok('a deleted invoice of 555,555 appears in no tile and no count on Performance — deleted means gone from the totals, not hidden behind them');
  else fail('the deleted 555,555 invoice is showing on Performance');
  const invTile = await tile('Invoices');
  if (invTile === WANT.distinctInvoices) ok('the Invoices tile also counts ' + WANT.distinctInvoices + ' distinct verified invoices, not the ' + ver.length + ' service lines behind them');
  else fail('the Invoices tile shows ' + invTile + ', there are ' + WANT.distinctInvoices + ' distinct verified invoice numbers across ' + ver.length + ' lines');
  for (const [label, want] of [['Revenue', WANT.revenue], ['Cost', WANT.cost], ['Profit', WANT.profit]]) {
    const got = await tile(label);
    if (got != null && Math.abs(got - want) < 0.02) ok(label + ' tile = ' + want.toLocaleString() + ' — every service line counted once, no line double-counted and none dropped');
    else fail(label + ' tile shows ' + got + ', an independent recount gives ' + want);
  }

  /* ---------- 2. the ten-year span and future dates ---------- */
  const yearsOffered = await p.evaluate(() => [...document.querySelectorAll('#view select')].map(s => [...s.options].map(o => o.value)).flat().filter(v => /^(19|20)\d\d$/.test(v)).map(Number).sort());
  const missing = WANT.years.filter(y => yearsOffered.indexOf(y) < 0);
  if (!missing.length) ok('the period bar offers every year in the data, ' + WANT.years[0] + ' through ' + WANT.years[WANT.years.length - 1] + ', future years included');
  else fail('years missing from the period bar: ' + JSON.stringify(missing));
  const y2016 = await p.evaluate(() => { FIN.p.year = 2016; FIN.p.part = 'all'; render(); return null; });
  await settle();
  const rev2016 = await tile('Revenue');
  const want2016 = r2(ver.filter(r => r.year === 2016).reduce((a, r) => a + r.revenue_sar, 0));
  if (rev2016 != null && Math.abs(rev2016 - want2016) < 0.02) ok('a ten-year-old year still scopes correctly (2016 revenue = ' + want2016 + ')');
  else fail('2016 revenue reads ' + rev2016 + ', recount ' + want2016);
  await p.evaluate(() => { FIN.p.year = 2028; FIN.p.part = 'all'; render(); }); await settle();
  const rev2028 = await tile('Revenue');
  if (rev2028 === 0 || rev2028 === null) ok('a future year with only an unpaid invoice shows no verified revenue rather than inventing one');
  else fail('2028 shows ' + rev2028 + ' verified revenue, but its only invoice is unpaid');
  await p.evaluate(() => { FIN.p.year = 'all'; FIN.p.part = 'all'; render(); }); await settle();

  /* ---------- 3. edges: zero, sub-riyal, very large, wallet == total ---------- */
  const html = await p.evaluate(() => document.querySelector('#view').innerHTML);
  if (!/NaN|undefined|Infinity|Q0|Q5|Invalid Date/.test(html)) ok('no NaN, Infinity, undefined, Q0/Q5 or Invalid Date anywhere on the page with these shapes');
  else fail('the page carries NaN/Infinity/undefined/Q0/Q5/Invalid Date');
  const walletRow = await p.evaluate(() => (window.finLive ? finLive() : []).find(r => r.invoice_no === 'HS-WALLET') || null);
  if (walletRow && Math.abs(walletRow.revenue_sar) < 0.005) ok('an invoice paid entirely from the client wallet contributes exactly zero revenue — the wallet is not revenue');
  else fail('the wallet invoice contributes ' + (walletRow && walletRow.revenue_sar) + ' revenue');

  /* ---------- 4. the credit note ---------- */
  await p.evaluate(() => finGo('clients')); await settle();
  const clientsHtml = await p.evaluate(() => document.querySelector('#view').innerHTML);
  const creditVisible = clientsHtml.indexOf('-750') >= 0 || clientsHtml.indexOf('−750') >= 0 || clientsHtml.indexOf('(750') >= 0;
  const mlRow = await p.evaluate(() => {
    const rows = (window.finLive ? finLive() : []).filter(r => r.client_group === 'Multiline Co' && r.integrity_status === 'verified_paid');
    return Math.round(rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100;
  });
  if (Math.abs(mlRow - WANT.multilineRevenue) < 0.02) ok('the client behind the four-line invoice totals ' + WANT.multilineRevenue.toLocaleString() + ' — its four lines summed once, and the credit note (a different status) kept out of the verified total');
  else fail('the multi-line client totals ' + mlRow + ', recount ' + WANT.multilineRevenue);
  if (!/NaN|undefined/.test(clientsHtml)) ok('no NaN or undefined on Clients & collections with these shapes'); else fail('NaN/undefined on the Clients tab');

  /* ---------- 5. the two awkward names ---------- */
  if (clientsHtml.indexOf('xxxxxxxxxxxxxxxxxxxx') >= 0 || /Very Long Client Name/.test(clientsHtml)) ok('a 400-character client name renders without breaking the table'); else fail('the 400-character name is missing from the Clients tab');
  const blankShown = await p.evaluate(() => {
    const rows = (window.finLive ? finLive() : []).filter(r => r.invoice_no === 'HS-BLANKNAME');
    return rows.length === 1 ? (window.finCanon ? finCanon(rows[0].client_group).name : null) : 'missing';
  });
  if (blankShown && String(blankShown).trim() !== '') ok('an all-whitespace client name resolves to a visible placeholder (' + JSON.stringify(String(blankShown).slice(0, 24)) + ') rather than a row of real money with no owner on it');
  else fail('the whitespace-named client renders as ' + JSON.stringify(blankShown) + ' — an invoice with no visible owner');

  /* ---------- 6. Report Builder at every grouping ---------- */
  await p.evaluate(() => finGo('reports')); await settle();
  for (const [g1, g2] of [['month', ''], ['__client', ''], ['quarter', 'service_type'], ['record_type', '']]) {
    const got = await p.evaluate(([g1, g2]) => {
      FIN.rb.g1 = g1; FIN.rb.g2 = g2; FIN.rb.verifiedOnly = true; FIN.rb.quarter = 'all';
      FIN.rb.metrics = { revenue_sar: true, cost_sar: true, profit_sar: true };
      render();
      return new Promise(res => setTimeout(() => {
        const tr = [...document.querySelectorAll('#view table tr')].filter(t => t.children.length && /^(TOTAL|الإجمالي)/.test((t.children[0].textContent || '').trim())).pop();
        if (!tr) return res(null);
        const c = [...tr.children].slice(1).map(td => +String(td.textContent).replace(/[^\d.-]/g, ''));
        const head = tr.closest('table') ? [...tr.closest('table').querySelectorAll('th')].map(th => th.textContent.trim()) : [];
        return res({ rev: c[0], cost: c[1], profit: c[2], headers: head.slice(1) });
      }, 900));
    }, [g1, g2]);
    const lbl = g1 + (g2 ? ' › ' + g2 : '');
    if (got && Math.abs(got.rev - WANT.revenue) < 2) ok('Report Builder by ' + lbl + ': grand total ' + WANT.revenue.toLocaleString() + ', the same recount every tab agrees on');
    else fail('Report Builder by ' + lbl + ': grand total ' + (got && got.rev) + ', recount ' + WANT.revenue);
    // 2026-09-03 (watch cycle 17): the cost and profit columns were never checked here — a
    // mutation that summed revenue into the profit column survived this probe entirely.
    if (got && Math.abs(got.cost - WANT.cost) < 2 && Math.abs(got.profit - WANT.profit) < 2) ok('  …and its cost and profit columns match the same recount, each holding what its header says');
    else fail('  by ' + lbl + ': cost ' + (got && got.cost) + ' (recount ' + WANT.cost + '), profit ' + (got && got.profit) + ' (recount ' + WANT.profit + ')');
    if (got && got.headers && /revenue/i.test(got.headers[0] || '') && /cost/i.test(got.headers[1] || '') && /profit/i.test(got.headers[2] || '')) ok('  …and the columns are labelled Revenue · Cost · Profit, in that order');
    else fail('  by ' + lbl + ': column headers read ' + JSON.stringify(got && got.headers));
  }

  /* ---------- 7. both exports ---------- */
  const grabCsv = async (fn) => p.evaluate((fn) => new Promise(res => {
    let captured = null;
    const oc = URL.createObjectURL, ok2 = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (b) { captured = b; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    try { window[fn](); } catch (e) { }
    URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok2;
    if (!captured) return res(null);
    captured.text().then(res);
  }), fn);
  await p.evaluate(() => finGo('overview')); await settle();
  const csv = await grabCsv('finLedgerCSV');
  if (csv) {
    const body = csv.replace(/^﻿/, '').trim().split('\n').slice(1);
    const mlLines = body.filter(l => l.indexOf('HS-MULTI-1') >= 0).length;
    if (mlLines === 4) ok('the invoice export carries all four lines of the multi-line invoice — the file is a line list, and says so'); else fail('the export holds ' + mlLines + ' lines for HS-MULTI-1, the table has 4');
    if (body.some(l => l.indexOf('HS-CREDIT') >= 0)) ok('the credit note is in the export too, not quietly dropped'); else fail('the credit note is missing from the export');
    if (!body.some(l => l.indexOf('HS-DELETED') >= 0)) ok('the deleted invoice is not in the export either'); else fail('the deleted invoice was exported');
    const cells = body.filter(l => /NaN|undefined|Infinity/.test(l)).length;
    if (!cells) ok('no NaN, undefined or Infinity in any exported cell'); else fail(cells + ' exported rows carry NaN/undefined/Infinity');
  } else fail('the invoice export produced no file');

  if (!errors.length) ok('no page errors through the whole run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
