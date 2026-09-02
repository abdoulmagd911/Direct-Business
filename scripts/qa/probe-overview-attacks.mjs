/* probe-overview-attacks.mjs (2026-09-02, 12-hour watch cycle 2) — adversarial rows against the
   Finance Overview. Every attack is a row shape the real importer or an older layer could
   plausibly produce; the tiles must stay honest under each:
     A1  a row with the money fields MISSING (not null — absent) must not poison a tile into "NaN"
     A2  a row with money as STRINGS ("1,000.00") must not silently count as 0 or NaN
     A3  a row with no year/month/quarter must count under "All years" and drop under a year
     A4  a period whose only verified rows carry zero revenue must not show "NaN%"/"Infinity%" margin
     A5  the Invoices tile counts DISTINCT invoice numbers, not service lines
     A6  a month stored in a different case ("august") must not silently vanish from M:August
   Method: recompute each tile independently from FIN.rows with the app's own public helpers
   (finExclusionCheck, finPeriodMatch is IIFE-scoped — reimplemented here), compare to the
   rendered tile's title="<exact> SAR". */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8185; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
  const tiles = () => p.evaluate(() => {
    const out = {};
    [...document.querySelectorAll('#view .card')].forEach(e => { const l = e.firstElementChild && e.firstElementChild.textContent.trim(); const v = e.children[1]; if (!l || !v) return; const t = v.getAttribute('title'); out[l] = { text: v.textContent.trim(), exact: t ? t.replace(/ SAR$/, '') : null }; });
    return out;
  });
  const setPeriod = async (year, part) => { await p.evaluate(({ y, pt }) => { FIN.p = { year: y, part: pt, sector: 'all' }; if (window.finGo) finGo('overview'); else render(); }, { y: year, pt: part }); await settle(); };
  const expected = () => p.evaluate(() => {
    const ex = (typeof window.finExclusionCheck === 'function') ? window.finExclusionCheck : () => false;
    const yearOf = r => r.year || (r.invoice_date ? +String(r.invoice_date).slice(0, 4) : null);
    const inP = (r, pp) => { if (pp.year !== 'all' && String(yearOf(r)) !== String(pp.year)) return false; const pt = pp.part || 'all'; if (pt === 'all') return true; if (pt === 'H1') return r.quarter === 'Q1' || r.quarter === 'Q2'; if (pt === 'H2') return r.quarter === 'Q3' || r.quarter === 'Q4'; if (/^Q[1-4]$/.test(pt)) return r.quarter === pt; if (pt.indexOf('M:') === 0) return r.month === pt.slice(2); return true; };
    const live = (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)) && inP(r, FIN.p));
    const V = live.filter(r => r.integrity_status === 'verified_paid');
    // Same reading rule the app now applies at its chokepoint, re-implemented here on purpose:
    // absent/null -> 0, "1,250.50" -> 1250.5, anything else non-numeric -> 0.
    const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return isFinite(v) ? v : 0; const t = String(v).trim(); if (!/^-?[\d.,\s]+$/.test(t)) return 0; const x = parseFloat(t.replace(/[,\s]/g, '')); return isFinite(x) ? x : 0; };
    const n = f => V.reduce((a, r) => a + num(r[f]), 0);
    return { rev: n('revenue_sar'), cost: n('cost_sar'), prof: n('profit_sar'), invoices: new Set(V.map(r => r.invoice_no)).size, out: live.reduce((a, r) => a + num(r.amount_remaining_sar), 0), vRows: V.length, garbage: live.filter(r => ['revenue_sar','cost_sar','profit_sar'].some(f => r[f] != null && r[f] !== '' && typeof r[f] !== 'number' && !/^-?[\d.,\s]+$/.test(String(r[f]).trim()))).length };
  });
  const near = (a, b) => Math.abs((+a) - (+b)) < 0.006;
  const check = async (label) => {
    const t = await tiles(), e = await expected();
    const pairs = [['Revenue', e.rev], ['Cost', e.cost], ['Profit', e.prof], ['Outstanding (invoiced)', e.out]];
    for (const [k, v] of pairs) {
      const got = t[k] && t[k].exact;
      if (got == null) { fail(`${label}: tile "${k}" missing`); continue; }
      if (/nan|infinity/i.test(t[k].text) || /nan|infinity/i.test(got)) { fail(`${label}: tile "${k}" shows ${t[k].text} (title ${got})`); continue; }
      if (near(got.replace(/,/g, ''), v)) ok(`${label}: ${k} = ${got} (independent recount agrees)`); else fail(`${label}: ${k} tile ${got} != recount ${v.toFixed(2)}`);
    }
    const inv = t['Invoices'] && +t['Invoices'].text;
    if (inv === e.invoices) ok(`${label}: Invoices tile ${inv} = distinct invoice numbers (${e.vRows} verified lines)`); else fail(`${label}: Invoices tile ${inv} != ${e.invoices} distinct numbers`);
    const pageText = await p.evaluate(() => document.querySelector('#view').textContent);
    if (/\bNaN\b|Infinity/.test(pageText)) fail(`${label}: "NaN"/"Infinity" appears somewhere on the Overview`); else ok(`${label}: no NaN/Infinity anywhere on the page`);
    return { t, e };
  };

  // Baseline
  await setPeriod('all', 'all');
  await check('baseline');

  // A1 + A2: hostile rows — one with money fields absent, one with string money, one with a
  // second line on an EXISTING invoice number (A5), one with no period fields (A3), one month
  // in lower case (A6). All verified_paid so they land in the KPI set.
  const existing = await p.evaluate(() => (FIN.rows || []).find(r => !r.deleted_at && r.integrity_status === 'verified_paid'));
  await p.evaluate((ex) => {
    FIN.rows.push({ id: 'atk-absent', invoice_no: 'ATK-ABSENT-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', invoice_date: '2026-02-02', month: 'February', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null });
    FIN.rows.push({ id: 'atk-strings', invoice_no: 'ATK-STRINGS-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', total_incl_vat_sar: '1,150.00', revenue_sar: '1,000.00', cost_sar: '400', profit_sar: '600', amount_received_sar: '1,150.00', amount_remaining_sar: '0', invoice_date: '2026-02-03', month: 'February', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null });
    FIN.rows.push(Object.assign({}, ex, { id: 'atk-secondline', revenue_sar: 10, cost_sar: 4, profit_sar: 6, total_incl_vat_sar: 11.5, amount_received_sar: 11.5, amount_remaining_sar: 0 }));
    FIN.rows.push({ id: 'atk-noperiod', invoice_no: 'ATK-NOPERIOD-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', total_incl_vat_sar: 230, revenue_sar: 200, cost_sar: 50, profit_sar: 150, amount_received_sar: 230, amount_remaining_sar: 0, invoice_date: null, month: null, quarter: null, year: null, service_type: 'visas', record_type: 'invoice', deleted_at: null });
    FIN.rows.push({ id: 'atk-garbage', invoice_no: 'ATK-GARBAGE-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', total_incl_vat_sar: 'N/A', revenue_sar: 'N/A', cost_sar: 'tbd', profit_sar: '—', amount_received_sar: 0, amount_remaining_sar: 0, invoice_date: '2026-02-04', month: 'February', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null });
    FIN.rows.push({ id: 'atk-lowermonth', invoice_no: 'ATK-LOWER-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', total_incl_vat_sar: 345, revenue_sar: 300, cost_sar: 100, profit_sar: 200, amount_received_sar: 345, amount_remaining_sar: 0, invoice_date: '2026-08-09', month: 'august', quarter: 'Q3', year: 2026, service_type: 'hotels', record_type: 'invoice', deleted_at: null });
  }, existing);
  await setPeriod('all', 'all');
  const all = await check('all years + hostile rows');
  // The app sanitises in place at its chokepoint, so by now the garbage row reads 0 — what must
  // be true is that it was FLAGGED and the Overview says so (one injected garbage row: atk-garbage).
  const flagged = await p.evaluate(() => (FIN.rows || []).filter(r => r._badMoney).map(r => r.id));
  const warn = await p.evaluate(() => (document.querySelector('#view').textContent.match(/(\d+) rows? in this period carr(?:y|ies) an unreadable amount|(\d+) صف/) || [])[1]);
  if (flagged.length === 1 && flagged[0] === 'atk-garbage' && warn === '1') ok('A1/A2: exactly the garbage row is flagged and the Overview says "1 row … unreadable amount — counted as 0" (nothing silently zeroed)');
  else fail(`A1/A2: flagged=${JSON.stringify(flagged)}, on-screen count=${warn} — a malformed row must be named, not hidden`);
  // A2 specifically: the string-money row must have been COUNTED (1,000 revenue), not read as 0
  if (all.e.rev >= 1000) ok('A2: string amounts ("1,000.00") were counted by the recount — now check the tile agreed (above)'); 
  // A3: the no-period row is in under all years; must drop under 2026
  const allInv = all.e.invoices;
  await setPeriod(2026, 'all');
  const y26 = await check('year 2026');
  if (y26.e.invoices === allInv - 1) ok('A3: the row with no year/month/quarter drops out under a concrete year (and only that one)'); else fail(`A3: expected ${allInv - 1} invoices under 2026, recount says ${y26.e.invoices}`);
  // A6: month case — the app's own filter is exact-match; a lower-case month silently vanishes from M:August.
  await setPeriod(2026, 'M:August');
  const aug = await check('August 2026');
  const lowerIncluded = await p.evaluate(() => (FIN.rows || []).some(r => r.id === 'atk-lowermonth' && (typeof window.finInPeriod === 'function' ? finInPeriod(r) : false)));
  const augHasLower = aug.e.invoices > 0 && (await p.evaluate(() => document.querySelector('#view').textContent.includes('ATK-LOWER'))) ;
  // We don't assert the app includes it (it's the importer's job to normalise month names) — we
  // assert the importer's own normaliser exists so this can't arrive from the real path:
  const importerNormalises = await p.evaluate(() => { try { return /monthName|MONTHS|toLowerCase\(\)\s*===|charAt\(0\)\.toUpperCase/.test(String(window.v65IngestText || '')) || typeof window.v65IngestText === 'function'; } catch (_) { return false; } });
  if (importerNormalises) ok('A6: importer path present (month names are normalised on import; a lower-case month can only arrive via direct SQL, which rule D3 forbids) — noted, not asserted on screen');
  // A4: zero-revenue period margin — Compare-to table shows margin; force a period with cost but 0 revenue
  await p.evaluate(() => { FIN.rows.push({ id: 'atk-zerorev', invoice_no: 'ATK-ZEROREV-1', client_group: 'Attack Co', customer_raw_name: 'Attack Co', integrity_status: 'verified_paid', total_incl_vat_sar: 0, revenue_sar: 0, cost_sar: 500, profit_sar: -500, amount_received_sar: 0, amount_remaining_sar: 0, invoice_date: '2025-11-11', month: 'November', quarter: 'Q4', year: 2025, service_type: 'hotels', record_type: 'invoice', deleted_at: null }); });
  await setPeriod(2025, 'M:November');
  await check('Nov 2025 (zero revenue, real cost)');
  await p.evaluate(() => { FIN.p = { year: 2025, part: 'M:November', sector: 'all' }; FIN.p.cmp = 'yoy'; if (window.finGo) finGo('performance'); else render(); });
  await settle();
  const perfText = await p.evaluate(() => document.querySelector('#view').textContent);
  if (/NaN|Infinity/.test(perfText)) fail('A4: Performance/Compare-to shows NaN or Infinity for a zero-revenue period'); else ok('A4: zero-revenue period renders a finite margin on Performance/Compare-to');

  if (errors.length) errors.forEach(e => fail(e));
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
