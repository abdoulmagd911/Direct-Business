/* probe-report-builder-attacks.mjs (2026-09-02, watch cycle 3) — the Report Builder under attack.
   What must hold, for any grouping and any metric set:
     R1  every group total == the sum of the invoice rows the app keeps behind it (FIN._lastReport
         .g[k].__rows) — the drill-down can never disagree with the row it expanded from
     R2  every sub-group total sums to its group total; the grand total sums the groups
     R3  the CSV export is the table: same groups, same sub-groups, same numbers, same order
     R4  a hostile client_group ("<img src=x onerror=…>") renders as TEXT in the table and is
         formula-guarded in the CSV (leading = + @ - escaped); no element is created
     R5  a row with a null quarter/month never becomes a "null"/"undefined" option in the period
         dropdown, and groups under "—", never disappears from totals
     R6  a group key that differs only by case/whitespace ("Acme " vs "acme") — two groups today
         (the alias map is the tool for that), but never a silently merged or dropped row: the
         sum of all group totals must still equal the sum over every base row
   Method: all sums recomputed from FIN.rows with the app's own public helpers; CSV captured by
   stubbing URL.createObjectURL + the anchor click. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8191; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4000);
  await p.evaluate(() => { current = 'finance'; render(); });
  await p.waitForTimeout(1500);
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };

  // Hostile rows: injection in the group name; null period fields; a case/space-variant client.
  await p.evaluate(() => {
    const base = { integrity_status: 'verified_paid', total_incl_vat_sar: 1150, revenue_sar: 1000, cost_sar: 400, profit_sar: 600, amount_received_sar: 1150, amount_remaining_sar: 0, invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null };
    FIN.rows.push(Object.assign({}, base, { id: 'rb-xss', invoice_no: 'RB-XSS-1', client_group: '<img src=x onerror="window.__pwned=1">Evil Co', customer_raw_name: '<img src=x onerror="window.__pwned=1">Evil Co' }));
    FIN.rows.push(Object.assign({}, base, { id: 'rb-formula', invoice_no: 'RB-FORMULA-1', client_group: '=HYPERLINK("http://x","click")', customer_raw_name: '=HYPERLINK("http://x","click")' }));
    FIN.rows.push(Object.assign({}, base, { id: 'rb-nullq', invoice_no: 'RB-NULLQ-1', client_group: 'Null Period Co', customer_raw_name: 'Null Period Co', quarter: null, month: null, year: null, invoice_date: null }));
    FIN.rows.push(Object.assign({}, base, { id: 'rb-case1', invoice_no: 'RB-CASE-1', client_group: 'Acme Trading', customer_raw_name: 'Acme Trading' }));
    FIN.rows.push(Object.assign({}, base, { id: 'rb-case2', invoice_no: 'RB-CASE-2', client_group: 'acme trading ', customer_raw_name: 'acme trading ' }));
    // CSV capture: stub the download.
    window.__csv = null;
    URL.createObjectURL = function (blob) { blob.text().then(t => { window.__csv = t; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () {};
  });

  const configs = [
    { g1: '__client', g2: '', metrics: { revenue_sar: true, cost_sar: true, profit_sar: true, amount_received_sar: true, amount_remaining_sar: true, _count: true }, verifiedOnly: false, quarter: 'all' },
    { g1: 'month', g2: 'service_type', metrics: { revenue_sar: true, profit_sar: true }, verifiedOnly: true, quarter: 'all' },
    { g1: 'quarter', g2: '__client', metrics: { revenue_sar: true, _count: true }, verifiedOnly: true, quarter: 'all' },
    { g1: 'service_type', g2: '', metrics: { revenue_sar: true, cost_sar: true }, verifiedOnly: false, quarter: 'Q1' },
  ];
  for (const cfg of configs) {
    const label = `${cfg.g1}${cfg.g2 ? '›' + cfg.g2 : ''} · ${Object.keys(cfg.metrics).join('+')} · ${cfg.verifiedOnly ? 'verified' : 'all'} · ${cfg.quarter}`;
    await p.evaluate((cfg) => { FIN.rb = { g1: cfg.g1, g2: cfg.g2, quarter: cfg.quarter, verifiedOnly: cfg.verifiedOnly, metrics: Object.assign({}, cfg.metrics) }; if (window.finGo) finGo('reports'); else render(); }, cfg);
    await settle();
    const r = await p.evaluate(() => {
      const R = FIN._lastReport; if (!R) return null;
      const near = (a, b) => Math.abs(a - b) < 0.006;
      const val = (row, m) => m === '_count' ? 1 : (Number(row[m]) || 0);
      const out = { keys: R.keys.length, bad: [], subBad: [], grandBad: [] };
      let sumGroups = {};
      R.keys.forEach(k => {
        const g = R.g[k];
        R.mets.forEach(m => {
          const fromRows = g.__rows.reduce((a, row) => a + val(row, m), 0);
          if (!near(fromRows, g.__tot[m] || 0)) out.bad.push(`${k}/${m}: total ${g.__tot[m]} vs rows ${fromRows}`);
          sumGroups[m] = (sumGroups[m] || 0) + (g.__tot[m] || 0);
          if (R.g2) {
            const subSum = Object.keys(g.__sub).reduce((a, s) => a + (g.__sub[s][m] || 0), 0);
            if (!near(subSum, g.__tot[m] || 0)) out.subBad.push(`${k}/${m}: sub-groups ${subSum} vs group ${g.__tot[m]}`);
            Object.keys(g.__sub).forEach(s => { const rowsSum = (g.__subRows[s] || []).reduce((a, row) => a + val(row, m), 0); if (!near(rowsSum, g.__sub[s][m] || 0)) out.subBad.push(`${k}›${s}/${m}: sub ${g.__sub[s][m]} vs rows ${rowsSum}`); });
          }
        });
      });
      R.mets.forEach(m => { if (!near(sumGroups[m], R.grand[m] || 0)) out.grandBad.push(`${m}: groups ${sumGroups[m]} vs grand ${R.grand[m]}`); });
      // R6: base set (independent) vs sum of groups — nothing dropped or double counted
      const ex = (typeof window.finExclusionCheck === 'function') ? window.finExclusionCheck : () => false;
      const rb = FIN.rb;
      const baseRows = (FIN.rows || []).filter(x => !x.deleted_at && !(ex(x.client_group) || ex(x.customer_raw_name))).filter(x => !rb.verifiedOnly || x.integrity_status === 'verified_paid').filter(x => rb.quarter === 'all' || x.quarter === rb.quarter);
      out.baseVsGrand = R.mets.map(m => { const s = baseRows.reduce((a, row) => a + val(row, m), 0); return near(s, R.grand[m] || 0) ? null : `${m}: base rows ${s} vs grand ${R.grand[m]}`; }).filter(Boolean);
      out.baseCount = baseRows.length; out.rowsBehind = R.keys.reduce((a, k) => a + R.g[k].__rows.length, 0);
      return out;
    });
    if (!r) { fail(label + ': no report rendered'); continue; }
    if (!r.bad.length) ok(`${label}: every group total = sum of its ${r.rowsBehind} rows behind (${r.keys} groups)`); else fail(`${label}: group totals disagree with rows: ${r.bad.slice(0, 3).join(' | ')}`);
    if (!r.subBad.length) ok(`${label}: sub-group totals sum to group totals and to their rows`); else fail(`${label}: ${r.subBad.slice(0, 3).join(' | ')}`);
    if (!r.grandBad.length && !r.baseVsGrand.length && r.rowsBehind === r.baseCount) ok(`${label}: grand total = sum of groups = sum over all ${r.baseCount} base rows (nothing dropped, nothing double counted)`); else fail(`${label}: grand/base mismatch: ${r.grandBad.concat(r.baseVsGrand).join(' | ')}; rowsBehind=${r.rowsBehind} base=${r.baseCount}`);

    // R3: CSV = table
    await p.evaluate(() => { window.__csv = null; finCSV(); });
    for (let i = 0; i < 20 && !(await p.evaluate(() => window.__csv)); i++) await p.waitForTimeout(100);
    const csvCheck = await p.evaluate(() => {
      const csv = window.__csv; if (!csv) return { err: 'no csv captured' };
      const R = FIN._lastReport;
      const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
      const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
      const rows = lines.map(parse);
      const expectRows = 1 + R.keys.length + (R.g2 ? R.keys.reduce((a, k) => a + Object.keys(R.g[k].__sub).length, 0) : 0) + 1;
      const mism = [];
      let li = 1;
      R.keys.forEach(k => {
        const row = rows[li++]; R.mets.forEach((m, j) => { const v = Number(row[j + 1]); if (Math.abs(v - (R.g[k].__tot[m] || 0)) > 0.006) mism.push(`${k}/${m}: csv ${row[j + 1]} vs table ${R.g[k].__tot[m]}`); });
        if (R.g2) Object.keys(R.g[k].__sub).forEach(s => { const sr = rows[li++]; R.mets.forEach((m, j) => { const v = Number(sr[j + 1]); if (Math.abs(v - (R.g[k].__sub[s][m] || 0)) > 0.006) mism.push(`${k}›${s}/${m}: csv ${sr[j + 1]} vs ${R.g[k].__sub[s][m]}`); }); });
      });
      const total = rows[rows.length - 1];
      R.mets.forEach((m, j) => { if (Math.abs(Number(total[j + 1]) - (R.grand[m] || 0)) > 0.006) mism.push(`TOTAL/${m}: csv ${total[j + 1]} vs ${R.grand[m]}`); });
      const firstCells = rows.slice(1, -1).map(r => r[0]);
      const unguarded = firstCells.filter(c => /^[=+@\-\t\r]/.test(c) && !/^-?\d/.test(c));
      return { lines: rows.length, expectRows, mism, unguarded, hasXssText: csv.includes('<img src=x'), hasFormulaGuarded: firstCells.some(c => /HYPERLINK/.test(c)) };
    });
    if (csvCheck.err) fail(`${label}: ${csvCheck.err}`);
    else {
      if (csvCheck.lines === csvCheck.expectRows && !csvCheck.mism.length) ok(`${label}: CSV export = table (${csvCheck.lines} lines, every number identical)`); else fail(`${label}: CSV differs — lines ${csvCheck.lines}/${csvCheck.expectRows}; ${csvCheck.mism.slice(0, 3).join(' | ')}`);
      if (!csvCheck.unguarded.length) ok(`${label}: no unguarded formula-leading cell in the CSV`); else fail(`${label}: CSV formula injection: ${JSON.stringify(csvCheck.unguarded)}`);
    }
  }

  // R4: injection rendered as text, no element created, no handler fired
  await p.evaluate(() => { FIN.rb = { g1: '__client', g2: '', quarter: 'all', verifiedOnly: false, metrics: { revenue_sar: true } }; if (window.finGo) finGo('reports'); else render(); });
  await settle();
  const xss = await p.evaluate(() => ({ pwned: !!window.__pwned, imgs: document.querySelectorAll('#view img[src="x"]').length, textShown: document.querySelector('#view').textContent.includes('<img src=x onerror='), rowAttr: !!document.querySelector('#view tr[data-rbk*="Evil Co"]') }));
  if (!xss.pwned && xss.imgs === 0 && xss.textShown) ok('R4: hostile client_group renders as literal text — no element created, no handler fired'); else fail('R4: injection not neutralised: ' + JSON.stringify(xss));
  // R5: null quarter never becomes a dropdown option; the row still groups under "—"
  const r5 = await p.evaluate(() => { const sel = [...document.querySelectorAll('#view select')].find(s => [...s.options].some(o => o.value === 'all' && /periods|الفترات/i.test(o.textContent))); const opts = sel ? [...sel.options].map(o => o.value) : []; return { opts, bogus: opts.filter(v => /^(null|undefined|)$/.test(v)), dash: !!(FIN._lastReport && (FIN.rb.g1 === '__client')) }; });
  if (!r5.bogus.length && r5.opts.length > 1) ok(`R5: period dropdown has no null/undefined option (${r5.opts.length} options)`); else fail('R5: bogus period option: ' + JSON.stringify(r5));
  await p.evaluate(() => { FIN.rb = { g1: 'quarter', g2: '', quarter: 'all', verifiedOnly: false, metrics: { revenue_sar: true } }; if (window.finGo) finGo('reports'); else render(); });
  await settle();
  const nullGroup = await p.evaluate(() => { const R = FIN._lastReport; const k = R.keys.find(k => k === '—'); return k ? R.g[k].__rows.map(r => r.invoice_no) : null; });
  if (nullGroup && nullGroup.includes('RB-NULLQ-1')) ok('R5: the null-quarter row groups under "—" and stays in the totals'); else fail('R5: null-quarter row lost from the quarter grouping: ' + JSON.stringify(nullGroup));

  if (errors.length) errors.forEach(e => fail(e));
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
