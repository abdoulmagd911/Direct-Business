/* probe-cost-import.mjs (2026-09-28) — D27, the raw Direct Payments cost exports through js/121 into the stand-in, which mirrors
   public.fn_cost_import (scripts/sql/cost-import.sql). Made-up references (99…), companies and amounts only (rule 7); the
   headers are the real 27 Sep ones, and the dates are Payments' own "dd/mm/yyyy hh:mm:ss AM/PM".

   What it holds:
     1. the raw Transaction Expense Export is RECOGNISED (never js/65's "not recognized"), read by js/121, and every other
        file dropped with it still goes to js/65 (a mixed drop reads both);
     2. only APPROVED lines are cost — Pending (blank amount), Under Review, Cancelled and Rejected never; the cost lands on the
        money row, profit follows, and nothing else moves: a hand-entered row, a commission, a reference with two money rows
        and a cost someone else wrote are left alone; a reference with no money row is HELD — listed, never stored, no
        invoice row is made; an unreadable row is skipped and named;
     3. the same file twice: "Nothing new", no Import button, nothing written;
     4. a NEWER file (its Payments export time in the name) wins: a line now Cancelled drops out of the cost;
     5. an OLDER file after it changes nothing (it can only fill blanks);
     6. the Expense Invoice Export (an EXCEL file, read in the background worker) stores the Overdue flag and the expense
        status for references in Finance, holds the rest;
     7. the Revenue Report keeps only the submitted expenses (Total Expense Amount, "1,500.00 SAR"), never revenue or VAT; with no
        approved line, they are the flagged estimate beside the cost (before D23's pass-through), never the cost itself;
     8. a full-size file (258,000 rows, ~23 MB) is read in chunks: the tab never freezes (the longest gap between two 50 ms
        heartbeats stays under 1.5 s) and only the ~650 lines of references in Finance are kept;
     9. the block reads Arabic; a View-only person has no Import card, and the database refuses the write;
    10. no JS error, no native dialog.
   Sabotage (SABOTAGE=A|B|C|D swaps in a broken layer; each run 28 Sep, each caught):
     A  js/121 reads "Under Review" as approved           → 2b red (530.26, not 500.26), and 4, 5 with it
     B  js/121 ignores the export time in the file name   → 5 red (the older file rolls the cancellation back)
     C  js/65 without the hand-off to js/121              → 1, 2a red (the file is "not recognized" again)
     D  js/121 reads a CSV in one piece, not in slices    → 8 red (the tab froze 2.7 s)
   PORTS 9861 … 9864. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const XLSXLIB = fs.readFileSync('/tmp/node_modules/xlsx/dist/xlsx.full.min.js', 'utf8');
const XLSX = (await import('/tmp/node_modules/xlsx/xlsx.mjs'));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SAB = process.env.SABOTAGE || '';
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* ---------- the made-up world ---------- */
const R = { A: '9900000101', B: '9900000102', HAND: '9900000103', COM: '9900000104', TWO: '9900000105', OTHER: '9900000106', EST: '9900000107' };
const money = (no, o) => Object.assign({ id: 'qa-ci-' + no + '-' + (o && o.line_no || 1), invoice_no: no, line_no: 1, client_group: 'QA Cost Co', invoice_date: '2026-07-10',
  total_incl_vat_sar: 1000, revenue_sar: 1000, cost_sar: null, profit_sar: null, integrity_status: 'verified_paid', row_kind: 'sale', revenue_way: 'invoice',
  source: 'import', payments_status: 'Fully Paid', deleted_at: null }, o || {});
const BIG = [...Array(200)].map((_, i) => String(9900001000 + i));
const SEED = [money(R.A), money(R.B, { total_incl_vat_sar: 3000, revenue_sar: 3000 }), money(R.HAND, { source: 'manual' }), money(R.COM, { revenue_way: 'commission' }),
  money(R.TWO), money(R.TWO, { line_no: 2 }), money(R.OTHER, { cost_sar: 640, profit_sar: 360 }), money(R.EST)].concat(BIG.map((r) => money(r)));

const TXH = ['Invoice#', 'Customer Name', 'Customer Email', 'Customer Phone', 'ID Reference', 'Amount (SAR)', 'Expense Type', 'Status', 'Created At', 'Submission Date',
  'Approval/Rejection Date', 'Merchant', 'Card Details', 'Submitter', 'Approver/Rejector'];
const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (h, rows) => [h].concat(rows).map((r) => r.map(q).join(',')).join('\n');
const tx = (ref, amt, type, st, created, dec) => [ref, 'QA Person', 'qa@example.test', '+966500000000', '', amt, type, st, created, created, dec || '', 'qa_merchant', '****0000', 'QA Submitter', dec ? 'QA Approver' : ''];
const TX1 = [
  tx(R.A, '400.255', 'Hotel Cost', 'Approved', '01/07/2026 10:00:00 AM', '02/07/2026 09:00:00 AM'), tx(R.A, '100', 'Airline Fees', 'Approved', '01/07/2026 11:00:00 AM', '02/07/2026 09:00:00 AM'),
  tx(R.A, '', 'Hotel Cost', 'Pending', '02/07/2026 09:00:00 AM'), tx(R.A, '30', 'Visa', 'Under Review', '02/07/2026 09:00:00 AM'),
  tx(R.A, '20', 'Insurance', 'Cancelled', '02/07/2026 09:00:00 AM'), tx(R.A, '10', 'Submission', 'Rejected', '02/07/2026 09:00:00 AM', '03/07/2026 09:00:00 AM'),
  tx(R.B, '1234.5', 'Institution Fee', 'Approved', '05/07/2026 01:12:43 PM', '05/07/2026 03:18:03 PM'), tx(R.B, '65.5', 'Miscellaneous', 'Approved', '05/07/2026 01:12:43 PM', '05/07/2026 03:44:51 PM'),
  tx(R.HAND, '100', 'Hotel Cost', 'Approved', '06/07/2026 10:00:00 AM', '06/07/2026 11:00:00 AM'), tx(R.COM, '100', 'Hotel Cost', 'Approved', '06/07/2026 10:00:00 AM', '06/07/2026 11:00:00 AM'),
  tx(R.TWO, '100', 'Hotel Cost', 'Approved', '06/07/2026 10:00:00 AM', '06/07/2026 11:00:00 AM'), tx(R.OTHER, '100', 'Hotel Cost', 'Cancelled', '06/07/2026 10:00:00 AM'),
  tx('9912345001', '999', 'Hotel Cost', 'Approved', '07/07/2026 10:00:00 AM', '07/07/2026 11:00:00 AM'), tx('9912345002', '50', 'Airline Fees', 'Approved', '07/07/2026 10:00:00 AM', '07/07/2026 11:00:00 AM'),
  tx('9912345003', '', 'Visa', 'Pending', '07/07/2026 10:00:00 AM'), tx(R.B, 'abc', 'Visa', 'Approved', '07/07/2026 10:00:00 AM', '07/07/2026 11:00:00 AM')];
const FILE_TX1 = { name: '2026-09-27_10-00-00transaction-expense-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(TXH, TX1)) };
const TX2 = TX1.map((r) => r.slice()); TX2[0][7] = 'Cancelled'; TX2[0][10] = '';          // the 400.255 line is cancelled in a newer export
const FILE_TX2 = { name: '2026-09-28_09-00-00transaction-expense-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(TXH, TX2)) };
const FILE_TX0 = { name: '2026-09-20_09-00-00transaction-expense-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(TXH, TX1)) };   // OLDER, says it was approved

const EIH = ['Invoice # / Ref #', 'Request Number', 'Invoice Product', 'Invoice Amount', 'Invoice Status', 'Invoice Type', 'Expense Assignments', 'Overdue', 'Customer Name',
  'Customer Email', 'Customer Phone', 'Invoice Created By', 'Invoice Created At'];
const xlsxBuf = (h, rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h].concat(rows)), 'Sheet1'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); };
const FILE_EI = { name: '2026-09-27_10-05-00-expense-invoice-QA.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: xlsxBuf(EIH, [[Number(R.A), '', 'Direct Hotels', '1,000.00 SAR', 'Fully Paid', 'B2B', '2 Approved , 1 Pending', '1 Overdue', 'QA Cost Co', 'qa@example.test', '+966500000000', 'QA Seller', '01/07/2026 09:00:00 AM'],
    ['9912345001', '', 'Direct Hotels', '999.00 SAR', 'Fully Paid', 'B2B', '1 Approved', '', 'QA Person', 'qa@example.test', '+966500000000', '', '07/07/2026 09:00:00 AM']]) };
const RRH = ['Invoice # / Ref #', 'Invoice Product', 'Invoice Amount', 'Invoice Expenses', 'Total Expense Amount', 'Total Revenue', 'VAT', 'Revenue', '% of Revenue out of GMV'];
const FILE_RR = { name: '2026-09-27_10-10-00-revenue-report-QA.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(RRH, [
  [R.B, 'Direct Flights', '3,000.00 SAR', '1,234.50 SAR,265.50 SAR', '1,500.00 SAR', '1,500.00 SAR', '34.50 SAR', '1,465.50 SAR', '48.9%'],
  [R.EST, 'Direct Hotels', '1,000.00 SAR', '750.00 SAR', '750.00 SAR', '1,000.00 SAR', '37.50 SAR', '962.50 SAR', '96.3%'],
  ['9912345002', 'Direct Flights', '681.97 SAR', '0.00 SAR', '0.00 SAR', '681.97 SAR', '0.00 SAR', '681.97 SAR', '100%']])) };
const INVH = ['Type', 'Invoice Reference #', 'Invoice Number', 'Customer Name', 'Customer Email', 'Invoice Create Date', 'Invoice Generate Date', 'Last Payment Date', 'Invoice Status',
  'Last Status At', 'Invoice Total', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Sale Branch', 'Salesman'];
const FILE_INV = { name: 'QA-invoice-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(INVH, [['invoice', '9900000900', '', 'QA Paper Co', '', '10/03/2026 09:00:00 AM', '', '12/03/2026', 'Fully Paid', '12/03/2026 10:00:00 AM', 1000, '', '', '', '', '', 'Riyadh', 'QA']])) };
function bigFile() {   // 258,000 rows: ~650 lines on the 200 references in Finance, the rest consumer sales
  const out = [TXH.map(q).join(',')];
  for (let i = 0; i < 258000; i++) {
    const inF = i % 397 === 0, ref = inF ? BIG[(i / 397) % 200 | 0] : String(9800000000 + (i % 97000));
    const d = String(1 + (i % 28)).padStart(2, '0'), s = String(i % 60).padStart(2, '0');
    out.push(tx(ref, (100 + (i % 900)) + '.25', ['Hotel Cost', 'Airline Fees', 'Visa'][i % 3], inF ? 'Approved' : ['Approved', 'Pending', 'Cancelled'][i % 3], d + '/06/2026 0' + (i % 9 + 1) + ':' + s + ':' + s + ' PM', d + '/06/2026 11:00:00 PM').map(q).join(','));
  }
  /* handed over from DISK, as a person's file arrives: a 47 MB in-memory buffer is copied into the page by the test tool itself,
     which blocks the tab before the app has even seen the file (measured: one 11 s long task with js/121 not yet started) */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-big-')), f = path.join(dir, '2026-09-27_12-00-00transaction-expense-FULL.csv');
  fs.writeFileSync(f, out.join('\n')); return f;
}

/* ---------- a session on the stand-in ---------- */
async function session(PORT, lang, pageAccess) {
  process.env.MOCK_ROLE = pageAccess ? 'team_member' : 'admin'; if (pageAccess) process.env.MOCK_PAGE_ACCESS = JSON.stringify(pageAccess); else delete process.env.MOCK_PAGE_ACCESS;
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT, { finance_invoices: SEED.map((x) => Object.assign({}, x)) }); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } }); const p = await ctx.newPage();
  const errors = [], natives = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang || 'en');
  await ctx.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await ctx.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: /xlsx/.test(r.request().url()) ? XLSXLIB : LIB }));
  await ctx.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  /* sabotage: serve a changed layer instead of the real one */
  const swap = (file, fn) => ctx.route((u) => u.pathname === '/js/' + file, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fn(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8')) }));
  if (SAB === 'A') await swap('121-cost-import.js', (s) => s.replace("if(s==='under review') return 'under_review';", "if(s==='under review') return 'approved';"));
  if (SAB === 'B') await swap('121-cost-import.js', (s) => s.replace("var m=String((f&&f.name)||'').match(", "var m=String('').match("));
  if (SAB === 'C') await swap('65-universal-importer.js', (s) => s.replace("if(window.v121Route&&!files.__v121)", "if(false)"));
  if (SAB === 'D') await swap('121-cost-import.js', (s) => s.replace('var CH=1<<20, pos=0,', 'var CH=1<<30, pos=0,'));
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  const ready = await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && typeof window.v121Route === 'function', null, { timeout: 150000 }).then(() => true).catch(() => false);
  if (!ready) { console.log('NOT READY'); failures++; }
  await p.evaluate(() => { current = 'finance'; finGo('import'); }); await p.waitForTimeout(900);
  return { p, b, srv, errors, natives };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const drop = async (s, files) => { await s.p.evaluate(() => { if (window.v121Clear) v121Clear(); }); await s.p.setInputFiles('#finFile', files); };
const phase = (s, want, ms) => s.p.waitForFunction((w) => { const e = document.querySelector('#v121Out [data-v121-phase]'); return e && w.includes(e.getAttribute('data-v121-phase')); }, want, { timeout: ms || 60000 }).then(() => true).catch(() => false);
const rows = (s) => s.p.evaluate(async () => { const r = await fc().from('finance_invoices').select('invoice_no,line_no,cost_sar,profit_sar,source').is('deleted_at', null); return r.data || []; });
const costOf = (list, no) => list.filter((x) => x.invoice_no === no).map((x) => x.cost_sar == null ? '∅' : String(Math.round(+x.cost_sar * 100) / 100)).join(',');
const attr = (s, sel, a) => s.p.evaluate(([q, n]) => { const e = document.querySelector(q); return e ? e.getAttribute(n) : null; }, [sel, a]);
const importNow = async (s) => { await s.p.click('#v121Out [data-v121-go]'); return phase(s, ['done', 'error'], 60000); };

/* ================= 1–7, 10: one admin session ================= */
{
  console.log('— the three raw exports, an admin, English —');
  const s = await session(9861, 'en');
  const n0 = (await rows(s)).length;
  await drop(s, [FILE_TX1, FILE_INV]);
  const okP = await phase(s, ['preview', 'error']);
  const js65 = await s.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  check(okP && await attr(s, '#v121Out [data-v121-kind]', 'data-v121-kind') === 'tx' && !/not recogni[sz]ed/i.test(js65) && /Invoice Export/.test(js65),
    '1. the raw Transaction Expense Export is read by js/121 (never "not recognized"), and the invoice export dropped with it still goes to js/65', JSON.stringify({ okP, js65: js65.slice(0, 160) }));
  const cst = await attr(s, '#v121Out [data-v121-cost]', 'data-v121-cost'), held = await attr(s, '#v121Out [data-v121-held]', 'data-v121-held'), badN = await attr(s, '#v121Out [data-v121-bad]', 'data-v121-bad');
  const txt = await s.p.evaluate(() => document.getElementById('v121Out').innerText);
  check(cst === '2,0,0,0,1' && held === '3' && badN === '1' && /1 hand-entered/.test(txt) && /1 commission/.test(txt) && /1 with several money rows/.test(txt),
    '2a. the preview: 2 invoices get their cost, 1 waits (its only line was cancelled, and its cost is someone else\'s); 3 references held; 1 unreadable row named; hand-entered, commission and two-row references left alone', JSON.stringify({ cst, held, badN }));
  const ok1 = await importNow(s); await s.p.waitForTimeout(800);
  const r1 = await rows(s);
  check(ok1 && costOf(r1, R.A) === '500.26' && costOf(r1, R.B) === '1300' && costOf(r1, R.HAND) === '∅' && costOf(r1, R.COM) === '∅' && costOf(r1, R.TWO) === '∅,∅' && costOf(r1, R.OTHER) === '640' && r1.length === n0,
    '2b. only APPROVED lines are cost (400.255 + 100 = 500.26; not the Pending, Under Review, Cancelled or Rejected ones); nothing else moved; no invoice row was made for a held reference',
    JSON.stringify({ A: costOf(r1, R.A), B: costOf(r1, R.B), hand: costOf(r1, R.HAND), com: costOf(r1, R.COM), two: costOf(r1, R.TWO), other: costOf(r1, R.OTHER), rows: r1.length + '/' + n0 }));
  const stored = await s.p.evaluate(async () => { const r = await fc().from('finance_expense_lines').select('ref'); return (r.data || []).map((x) => x.ref); });
  check(!stored.some((x) => /^99123/.test(x)) && stored.length === 12, '2c. a held reference\'s lines are never stored (12 lines kept, all on references in Finance)', stored.length + ' stored');

  await drop(s, [FILE_TX1]); await phase(s, ['preview', 'error']);
  const nothing = await attr(s, '#v121Out [data-v121-nothing]', 'data-v121-nothing'), btn = await s.p.$('#v121Out [data-v121-go]');
  check(nothing === '1' && !btn, '3. the same file twice: "Nothing new", no Import button', JSON.stringify({ nothing, button: !!btn }));

  await drop(s, [FILE_TX2]); await phase(s, ['preview', 'error']);
  const cst2 = await attr(s, '#v121Out [data-v121-cost]', 'data-v121-cost');
  await importNow(s); await s.p.waitForTimeout(800); const r2 = await rows(s);
  check(cst2 === '0,1,1,0,1' && costOf(r2, R.A) === '100', '4. a NEWER export wins: the 400.255 line now Cancelled drops out (500.26 → 100)', JSON.stringify({ cst2, A: costOf(r2, R.A) }));

  await drop(s, [FILE_TX0]); await phase(s, ['preview', 'error']);
  const old = await attr(s, '#v121Out [data-v121-nothing]', 'data-v121-nothing'); const r3 = await rows(s);
  check(old === '1' && costOf(r3, R.A) === '100', '5. an OLDER export arriving later changes nothing (it can only fill blanks) — the cancellation stands', JSON.stringify({ nothingNew: old, A: costOf(r3, R.A) }));

  await drop(s, [FILE_EI]); const okEI = await phase(s, ['preview', 'error'], 90000);
  const eiKind = await attr(s, '#v121Out [data-v121-kind]', 'data-v121-kind'), eiHeld = await attr(s, '#v121Out [data-v121-held]', 'data-v121-held');
  await importNow(s);
  const facts = await s.p.evaluate(async () => { const r = await fc().from('finance_payments_facts').select('*'); return r.data || []; });
  const fA = facts.find((x) => x.ref === '9900000101') || {};
  check(okEI && eiKind === 'ei' && eiHeld === '1' && fA.overdue === '1 Overdue' && fA.expense_assignments === '2 Approved , 1 Pending' && !facts.some((x) => x.ref === '9912345001'),
    '6. the Expense Invoice Export (Excel, read in the background worker, the reference as an Excel number) keeps Overdue and the expense status for a reference in Finance; the other is held', JSON.stringify({ okEI, eiKind, eiHeld, overdue: fA.overdue, asg: fA.expense_assignments }));

  await drop(s, [FILE_RR]); await phase(s, ['preview', 'error']); await importNow(s);
  const f2 = await s.p.evaluate(async () => { const r = await fc().from('finance_payments_facts').select('*'); return r.data || []; });
  const fB = f2.find((x) => x.ref === '9900000102') || {}, cols = Object.keys(fB).join(',');
  const r4 = await rows(s);
  check(+fB.rr_total_expense_sar === 1500 && !/revenue_sar|vat/i.test(cols.replace('rr_total_expense_sar', '')) && !f2.some((x) => x.ref === '9912345002') && costOf(r4, R.B) === '1300',
    '7. the Revenue Report keeps only the submitted expenses ("1,500.00 SAR" → 1500) — never its revenue or VAT — and the approved cost stays the approved lines\'', JSON.stringify({ rr: fB.rr_total_expense_sar, B: costOf(r4, R.B), cols }));
  await s.p.evaluate(() => { FIN.rows = null; finLoad(); }); await s.p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => { });
  const est = await s.p.evaluate((no) => { const r = FIN.rows.find((x) => x.invoice_no === no); const m = (r && FIN.m[r.id]) || {}; const cell = document.createElement('div'); cell.innerHTML = r ? finCostCell(r) : '';
    return { est: m.est_cost_sar, flag: m.cost_estimated, cost: r && r.cost_sar, cell: cell.innerText }; }, R.EST);
  check(+est.est === 750 && est.flag === true && est.cost == null && /est\./.test(est.cell),
    '7b. with no approved line, the Revenue Report\'s submitted expenses (750) are the flagged estimate beside the cost — never the cost itself', JSON.stringify(est));
  check(s.errors.length === 0 && s.natives.length === 0, '10a. no JS error, no native dialog (admin)', JSON.stringify({ e: s.errors.slice(0, 3), n: s.natives }));
  await done(s);
}

/* ================= 8: the full-size file, the tab never freezes ================= */
{
  console.log('— a full-size export (258,000 rows) —');
  const s = await session(9862, 'en');
  const big = bigFile();
  await s.p.evaluate(() => { window.__hb = { last: performance.now(), max: 0 }; window.__hbT = setInterval(() => { const n = performance.now(); window.__hb.max = Math.max(window.__hb.max, n - window.__hb.last); window.__hb.last = n; }, 50); });
  const t0 = Date.now(); await drop(s, [big]); const ok = await phase(s, ['preview', 'error'], 240000); const secs = Math.round((Date.now() - t0) / 1000);
  const hb = await s.p.evaluate(() => { clearInterval(window.__hbT); return Math.round(window.__hb.max); });
  const st = await s.p.evaluate(() => { const S = v121.state(); const F = S && S.files[0]; return F ? { rows: F.rows, kept: Object.keys(F.lines).length, held: Object.keys(F.held).length, heldLines: F.heldLines } : null; });
  check(ok && st && st.rows === 258000 && st.kept > 600 && st.kept < 700 && hb < 1500,
    '8. a 258,000-row (' + (fs.statSync(big).size / 1048576).toFixed(1) + ' MB) export is read in slices: every row read, only the lines of references in Finance kept, and the tab never froze (longest pause ' + hb + ' ms, ' + secs + ' s in all)', JSON.stringify({ ok, st, hb, secs }));
  try { fs.rmSync(path.dirname(big), { recursive: true, force: true }); } catch (_) { }
  await done(s);
}

/* ================= 9: Arabic (an admin), and a View-only person ================= */
{
  console.log('— Arabic —');
  const s = await session(9863, 'ar');
  await drop(s, [FILE_TX1]); await phase(s, ['preview', 'error']);
  const t = await s.p.evaluate(() => (document.getElementById('v121Out') || {}).innerText || '');
  check(/ملفات التكلفة من المدفوعات/.test(t) && /الفواتير في المالية/.test(t) && /محجوزة/.test(t) && !/Invoices in Finance|get their cost|held, nothing written|rows read/.test(t),
    '9a. the block reads Arabic, with no English left in it', t.slice(0, 160));
  check(s.errors.length === 0 && s.natives.length === 0, '10b. no JS error, no native dialog (Arabic)', JSON.stringify({ e: s.errors.slice(0, 3) }));
  await done(s);
}
{
  console.log('— a View-only person —');
  const s = await session(9864, 'en', { finance: 'view', leads: 'view', clients: 'view' });
  const card = await s.p.$('#finFile');
  const rpc = await s.p.evaluate(async () => { const r = await fc().rpc('fn_cost_import', { p_lines: [{ ref: '9900000101', line_key: 'x', status: 'approved', amount_sar: 1 }] }); return r.error ? String(r.error.message || r.error.code) : 'WROTE'; });
  const after = await rows(s);
  check(!card && /Full control of Finance/.test(rpc) && costOf(after, '9900000101') === '∅',
    '9b. a View-only person has no Import card, and the database refuses the cost import (nothing written)', JSON.stringify({ card: !!card, rpc }));
  await done(s);
}

console.log(failures ? `\nFAILED — ${failures} check(s) did not pass.` + (SAB ? ' (sabotage ' + SAB + ')' : '') : '\ncost import OK' + (SAB ? ' — but this was sabotage ' + SAB + ', which should have failed' : ''));
process.exit(failures ? 1 : 0);
