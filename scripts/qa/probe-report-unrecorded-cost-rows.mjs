/* probe-report-unrecorded-cost-rows.mjs (2026-09-09, live test finding F2) — the Report Builder's
   own rows must not print a cost of 0 and a profit equal to the whole sale for invoices whose cost
   simply has not been recorded. Attack area (ad).

   PORT NOTE: 8701–8747 are taken. This is 8748, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: grouped by client, a real client group with no cost recorded
   on any invoice printed cost 0 and its whole revenue as profit in the Report Builder, while the
   Clients tab — two clicks away, same invoices — printed "not recorded" and
   "unknown". Round 36 had chosen a single line under the table over per-row words; the row was
   still the lie, and the row is what a manager reads.

   Under test:
     1. A client whose invoices ALL lack a cost prints the WORDS in the Cost and Profit cells —
        no 0, no revenue-as-profit — on the group row.
     2. A client with some cost recorded keeps its figures and wears the ⚠ marker; a client with
        every cost recorded prints plain figures with no marker.
     3. The same rule one level in: with a second grouping (client › month), a sub-row whose
        invoices all lack a cost prints the words; a sub-row with cost prints the figure.
     4. The TOTAL row keeps the real arithmetic (revenue, cost and profit sums over the raw rows) —
        the fix changes what is SAID, never a number.
     5. The exported CSV is UNCHANGED — every cell still the exact figure, TOTAL to the hallala.
        (The honest file would leave the two cells empty on an all-unrecorded row; that is pinned
        the other way by probe-report-builder-attacks, out of this lane — see BACKLOG 2026-09-09.
        This check exists so a later change to the file is a decision, not an accident.)
     6. Revenue-only report: nothing changes — no words, no markers, no rounding-note noise.

   Run:  node scripts/qa/probe-report-unrecorded-cost-rows.mjs        (port 8748)
   Sabotage: in rReports make _rbAllUnrec return false — checks 1 and 3 go red (check 5 reads the
   file, which this sabotage does not touch — verified 9 Sep). Assert the
   sabotage APPLIED with a marker unique to it; confirm the restore by marker count and git
   status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8748;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.finRB === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finRB / FIN.rows never appeared, so nothing below examined anything');

  /* Three fixture clients, whole riyals so rounding never enters:
       Harbor Lantern — 2 invoices, NO cost on either (the live shape)
       Quill Meadow   — 2 invoices, cost on one only (partial gap)
       Slate Orchard  — 1 invoice, cost recorded
     Names carry no word this probe later searches the screen for. */
  const seed = () => p.evaluate(() => {
    const base = { integrity_status: 'verified_paid', amount_received_sar: 0, amount_remaining_sar: 0, service_type: 'flights', record_type: 'invoice', deleted_at: null, quarter: 'Q1', year: 2026 };
    const rows = [
      { g: 'Harbor Lantern', v: 50000, c: 0, d: '2026-01-10', m: 'January' },
      { g: 'Harbor Lantern', v: 26000, c: 0, d: '2026-02-10', m: 'February' },
      { g: 'Quill Meadow', v: 10000, c: 0, d: '2026-01-12', m: 'January' },
      { g: 'Quill Meadow', v: 20000, c: 14000, d: '2026-02-12', m: 'February' },
      { g: 'Slate Orchard', v: 9000, c: 6000, d: '2026-03-01', m: 'March' },
    ];
    FIN.rows = rows.map((r, i) => Object.assign({}, base, {
      id: 'uc-' + i, invoice_no: 'UC-' + i, client_group: r.g, customer_raw_name: r.g,
      revenue_sar: r.v, cost_sar: r.c, profit_sar: r.v - r.c, total_incl_vat_sar: r.v,
      invoice_date: r.d, month: r.m,
    }));
    URL.createObjectURL = function (blob) { blob.text().then((t) => { window.__csv = t; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
  });

  const show = (g1, g2, metrics) => p.evaluate((c) => {
    FIN.rb = { g1: c.g1, g2: c.g2, quarter: 'all', verifiedOnly: false, metrics: c.metrics };
    if (window.finGo) finGo('reports'); else render();
  }, { g1, g2, metrics });

  /* Printed text only. Header order is what the screen shows; cells are read by header label. */
  const readTable = () => p.evaluate(() => {
    const view = document.getElementById('view');
    const tbl = view.querySelector('table'); if (!tbl) return { err: 'no table' };
    const heads = [].slice.call(tbl.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    const idx = (re) => heads.findIndex((h) => re.test(h));
    const ci = { rev: idx(/^revenue|إيراد/i), cost: idx(/^cost|تكلفة/i), profit: idx(/^profit|ربح/i) };
    const cell = (tr, i) => (i >= 0 && tr.cells[i]) ? tr.cells[i].textContent.trim() : null;
    const rows = [].slice.call(tbl.querySelectorAll('tr[data-rbk]')).map((tr) => ({
      k: tr.getAttribute('data-rbk'), s: tr.getAttribute('data-rbs'),
      rev: cell(tr, ci.rev), cost: cell(tr, ci.cost), profit: cell(tr, ci.profit),
      unrec: [].slice.call(tr.querySelectorAll('[data-rb-unrec]')).map((e) => e.getAttribute('data-rb-unrec')),
    }));
    const all = [].slice.call(tbl.querySelectorAll('tbody tr'));
    const totalRow = all.filter((tr) => !tr.getAttribute('data-rbk')).pop();
    const total = totalRow ? { rev: cell(totalRow, ci.rev), cost: cell(totalRow, ci.cost), profit: cell(totalRow, ci.profit) } : null;
    const card = tbl.closest('.card');
    const notes = card ? (card.innerText || '').split('\n').filter((l) => /rounded|مقر/i.test(l)) : [];
    return { heads, rows, total, notes };
  });
  const num = (t) => Number(String(t || '').replace(/[^0-9.\-]/g, ''));
  const isWords = (t) => /not recorded|unknown|غير مسجّلة|غير معروف/.test(String(t || ''));

  await seed();

  /* ---- 1 + 2: group rows, client grouping, revenue + cost + profit ---- */
  await show('__client', '', { revenue_sar: true, cost_sar: true, profit_sar: true });
  await p.waitForTimeout(1200);
  let t = await readTable();
  if (t.err) fail('client report: ' + t.err);
  const hl = t.rows.find((r) => r.k === 'Harbor Lantern' && !r.s);
  const qm = t.rows.find((r) => r.k === 'Quill Meadow' && !r.s);
  const so = t.rows.find((r) => r.k === 'Slate Orchard' && !r.s);
  if (!hl || !qm || !so) fail('the three fixture clients did not all appear as group rows: ' + JSON.stringify(t.rows.map((r) => r.k)));
  if (hl && isWords(hl.cost) && isWords(hl.profit) && hl.unrec.includes('cost') && hl.unrec.includes('profit') && num(hl.rev) === 76000)
    ok(`a client with no cost on any invoice prints the words — Cost "${hl.cost}", Profit "${hl.profit}" — beside its revenue ${hl.rev}, not 0 and not the whole sale`);
  else fail(`Harbor Lantern (76,000 revenue, no cost anywhere) printed Cost "${hl && hl.cost}", Profit "${hl && hl.profit}" — the live-site defect: an unrecorded cost shown as 0 and the whole revenue shown as profit`);
  if (qm && num(qm.cost) === 14000 && num(qm.profit) === 16000 && /⚠/.test(qm.cost) && /⚠/.test(qm.profit) && !isWords(qm.cost))
    ok(`a client with a cost on some invoices keeps its figures (cost ${num(qm.cost)}, profit ${num(qm.profit)}) and wears the ⚠ marker on both`);
  else fail(`Quill Meadow (one of two invoices costed) printed Cost "${qm && qm.cost}", Profit "${qm && qm.profit}" — expected 14,000 / 16,000 each with a ⚠`);
  if (so && num(so.cost) === 6000 && num(so.profit) === 3000 && !/⚠/.test(so.cost) && !/⚠/.test(so.profit) && !isWords(so.cost))
    ok(`a fully costed client prints plain figures with no marker (cost ${num(so.cost)}, profit ${num(so.profit)})`);
  else fail(`Slate Orchard (fully costed) printed Cost "${so && so.cost}", Profit "${so && so.profit}" — expected plain 6,000 / 3,000`);

  /* ---- 4: the TOTAL row keeps the real arithmetic ---- */
  if (t.total && num(t.total.rev) === 115000 && num(t.total.cost) === 20000 && num(t.total.profit) === 95000)
    ok(`TOTAL row still carries the raw sums — revenue ${num(t.total.rev)}, cost ${num(t.total.cost)}, profit ${num(t.total.profit)} — the fix changed words, not numbers`);
  else fail(`TOTAL row moved: ${JSON.stringify(t.total)} (expected 115,000 / 20,000 / 95,000)`);
  if (!t.notes.length) ok('no rounding note appeared under a table whose Cost/Profit columns carry words — the words are the explanation, not "rounding"');
  else fail(`a rounding note appeared under a table with word cells, restating an unaddable column as rounding: ${JSON.stringify(t.notes)}`);

  /* ---- 5: the CSV ---- */
  await p.evaluate(() => { window.__csv = null; finCSV(); });
  for (let i = 0; i < 20 && !(await p.evaluate(() => window.__csv)); i++) await p.waitForTimeout(100);
  const csv = await p.evaluate(() => (window.__csv || '').replace(/^﻿/, '').split('\r\n').filter(Boolean));
  const csvRow = (name) => (csv.find((l) => l.startsWith(name)) || '').split(',');
  const hlC = csvRow('Harbor Lantern'), qmC = csvRow('Quill Meadow'), totC = csv[csv.length - 1] ? csv[csv.length - 1].split(',') : [];
  if (hlC.length >= 4 && hlC[1] === '76000.00' && hlC[2] === '0.00' && hlC[3] === '76000.00')
    ok(`CSV: the all-unrecorded row still exports its raw figures (${JSON.stringify(hlC)}) — the file is pinned by probe-report-builder-attacks; changing it is a recorded decision, not a side effect`);
  else fail(`CSV: the all-unrecorded row exported ${JSON.stringify(hlC)} — the file changed without the decision recorded in BACKLOG 2026-09-09`);
  if (qmC[2] === '14000.00' && qmC[3] === '16000.00') ok('CSV: the partially costed row keeps its exact figures (14000.00 / 16000.00)');
  else fail(`CSV: the partially costed row exported ${JSON.stringify(qmC)}`);
  if (totC[1] === '115000.00' && totC[2] === '20000.00' && totC[3] === '95000.00') ok(`CSV: TOTAL line unchanged to the hallala (${totC.slice(1).join(' / ')})`);
  else fail(`CSV: TOTAL line moved: ${JSON.stringify(totC)}`);

  /* ---- 3: sub-rows under a second grouping ---- */
  await show('__client', 'month', { revenue_sar: true, cost_sar: true, profit_sar: true });
  await p.waitForTimeout(1200);
  t = await readTable();
  const qmJan = t.rows.find((r) => r.k === 'Quill Meadow' && r.s === 'January');
  const qmFeb = t.rows.find((r) => r.k === 'Quill Meadow' && r.s === 'February');
  if (qmJan && isWords(qmJan.cost) && isWords(qmJan.profit)) ok(`sub-row Quill Meadow › January (its one invoice uncosted) prints the words — "${qmJan.cost}" / "${qmJan.profit}"`);
  else fail(`sub-row Quill Meadow › January printed Cost "${qmJan && qmJan.cost}", Profit "${qmJan && qmJan.profit}" — an uncosted month shown as a number`);
  if (qmFeb && num(qmFeb.cost) === 14000 && num(qmFeb.profit) === 6000 && !/⚠/.test(qmFeb.cost)) ok('sub-row Quill Meadow › February (costed) prints plain 14,000 / 6,000');
  else fail(`sub-row Quill Meadow › February printed Cost "${qmFeb && qmFeb.cost}", Profit "${qmFeb && qmFeb.profit}"`);
  const qmG = t.rows.find((r) => r.k === 'Quill Meadow' && !r.s);
  if (qmG && num(qmG.cost) === 14000 && /⚠/.test(qmG.cost)) ok('the Quill Meadow group row above its sub-rows still shows 14,000 ⚠');
  else fail(`the Quill Meadow group row printed "${qmG && qmG.cost}" under the second grouping`);

  /* ---- 6: revenue-only report is untouched ---- */
  await show('__client', '', { revenue_sar: true });
  await p.waitForTimeout(1000);
  t = await readTable();
  const anyWords = t.rows.some((r) => r.unrec.length) || /⚠/.test(JSON.stringify(t.rows));
  if (!anyWords && t.rows.length === 3 && num((t.rows.find((r) => r.k === 'Harbor Lantern') || {}).rev) === 76000)
    ok('a revenue-only report prints no words and no markers — the change only speaks when a cost or profit column is on');
  else fail(`revenue-only report changed: ${JSON.stringify(t.rows)}`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nreport-unrecorded-cost-rows OK — a row whose cost nobody recorded says so on screen; the file is unchanged, on record');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
