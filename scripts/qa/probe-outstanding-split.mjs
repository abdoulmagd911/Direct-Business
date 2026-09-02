/* probe-outstanding-split.mjs (2026-08-29) — "invoiced outstanding" and "uninvoiced work" are two
   different amounts and must never be blended into one number.
   Borrowed from Direct's own Payments team, which split a single "Outstanding Balance" into
   "Invoiced Outstanding" + "Uninvoiced Transactions" after agents kept misreading one as the
   other. Here the rule already exists (DECISIONS: never sum finance_invoices and
   finance_transactions in one total; only confirmed fully-paid tax invoices count as revenue) —
   this probe makes it mechanical (P5):
     1. Overview "Outstanding" == sum of amount_remaining over LIVE INVOICES in period, recomputed
        independently from the raw rows — and != that sum plus any transaction money.
     2. Ledger "Confirmed revenue" == ready + invoiced transactions only; pending estimates are
        excluded from it and shown separately.
     3. The uninvoiced-but-ready transaction amount appears in NO Overview tile.
   Sabotage: temporarily make Overview's outstanding also add TXN ready amounts (edit js/16,
   run, restore) — check 1 and 3 must fail. Done by hand 2026-08-29, recorded in BACKLOG. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8181; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET','HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v,k)=>{ if(!['content-encoding','content-length','transfer-encoding'].includes(k)) h[k]=v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };

  // Make the two amounts distinguishable: one live invoice with money still owed (invoiced
  // outstanding), and the seed's ready-but-uninvoiced transaction (tx1, 9,500) as uninvoiced work.
  await p.evaluate(() => { current = 'finance'; render(); });
  await settle();
  await p.evaluate(() => {
    FIN.rows.push({ id: 'qa-split-unpaid', invoice_no: 'QA-SPLIT-UNPAID-1', client_group: 'QA Split Co', customer_raw_name: 'QA Split Co',
      integrity_status: 'pending', total_incl_vat_sar: 12345, revenue_sar: 12345, cost_sar: 0, profit_sar: 12345, amount_received_sar: 0, amount_remaining_sar: 12345,
      invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null });
    FIN.p = { year: 'all', part: 'all', sector: 'all' };
    if (window.finGo) finGo('overview'); else render();
  });
  await settle();

  // Load the ledger once so TXN.rows exists, then go back to Overview.
  await p.evaluate(() => { if (window.finGo) finGo('ledger'); });
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.profiles)); i++) await p.waitForTimeout(250);
  await settle();
  const txn = await p.evaluate(() => {
    const st = (r) => r.invoice_no ? 'invoiced' : r.overdue === true ? 'overdue' : r.expense_status === 'ready' ? 'ready' : 'pending';
    const rows = TXN.rows || [];
    return { n: rows.length,
      readyUninvoiced: rows.filter(r => st(r) === 'ready').reduce((a, r) => a + (+r.amount_sar || 0), 0),
      confirmedRev: rows.filter(r => st(r) === 'ready' || st(r) === 'invoiced').reduce((a, r) => a + (+r.amount_sar || 0), 0),
      pendingEst: rows.filter(r => !(st(r) === 'ready' || st(r) === 'invoiced')).reduce((a, r) => a + (+r.cost_estimate_sar || 0), 0) };
  });
  if (txn.n >= 4 && txn.readyUninvoiced > 0) ok(`ledger fixture: ${txn.n} transactions, ${txn.readyUninvoiced} SAR ready-but-uninvoiced (uninvoiced work exists)`);
  else fail('ledger fixture missing or has no ready-uninvoiced row: ' + JSON.stringify(txn));

  // Ledger KPI: Confirmed revenue excludes pending; pending shown separately.
  const tile = async (label) => p.evaluate((label) => {
    const els = [...document.querySelectorAll('#view .card')];
    const el = els.find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    if (!el) return null; const v = el.children[1]; const t = v && v.getAttribute('title'); return t ? +t.replace(/[^\d.-]/g, '') : (v ? v.textContent.trim() : null);
  }, label);
  const cRev = await tile('Confirmed revenue');
  if (cRev === txn.confirmedRev) ok(`ledger "Confirmed revenue" ${cRev} = ready + invoiced transactions only`); else fail(`ledger Confirmed revenue ${cRev} != ready+invoiced ${txn.confirmedRev}`);
  if (cRev !== null && cRev !== txn.confirmedRev + txn.pendingEst) ok('ledger Confirmed revenue does not blend in pending estimates'); else fail('ledger Confirmed revenue includes pending estimates');

  // Overview: Outstanding = invoiced outstanding only.
  await p.evaluate(() => { if (window.finGo) finGo('overview'); });
  await settle();
  const inv = await p.evaluate(() => {
    const ex = (typeof window.finExclusionCheck === 'function') ? window.finExclusionCheck : () => false;
    const live = (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)));
    return { invoicedOutstanding: live.reduce((a, r) => a + (+r.amount_remaining_sar || 0), 0), n: live.length };
  });
  const out = await tile('Outstanding (invoiced)');
  if (out === null) fail('Overview: no "Outstanding (invoiced)" tile found — the label must say which outstanding it is');
  else {
    if (Math.abs(out - inv.invoicedOutstanding) < 0.005) ok(`Overview Outstanding ${out} = amount still owed on live INVOICES (${inv.n} rows), recomputed from raw rows`);
    else fail(`Overview Outstanding ${out} != invoiced outstanding ${inv.invoicedOutstanding}`);
    if (Math.abs(out - (inv.invoicedOutstanding + txn.readyUninvoiced)) > 0.005) ok('Overview Outstanding does NOT add uninvoiced (ready) transaction money into the same number');
    else fail('Overview Outstanding blends invoiced outstanding with uninvoiced transaction money');
  }
  // No Overview tile carries the uninvoiced amount or a blend of the two.
  const tiles = await p.evaluate(() => [...document.querySelectorAll('#view .card')].map(e => { const v = e.children[1]; const t = v && v.getAttribute('title'); return { l: e.firstElementChild ? e.firstElementChild.textContent.trim() : '', v: t ? +t.replace(/[^\d.-]/g, '') : NaN }; }).filter(x => !isNaN(x.v)));
  const blends = tiles.filter(x => Math.abs(x.v - txn.readyUninvoiced) < 0.005 || Math.abs(x.v - (inv.invoicedOutstanding + txn.readyUninvoiced)) < 0.005);
  if (!blends.length) ok(`no Overview tile equals the uninvoiced amount (${txn.readyUninvoiced}) or the blended sum — ${tiles.length} tiles checked`);
  else fail('Overview tile(s) carry uninvoiced/blended money: ' + JSON.stringify(blends));

  if (errors.length) errors.forEach(e => fail(e));
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
