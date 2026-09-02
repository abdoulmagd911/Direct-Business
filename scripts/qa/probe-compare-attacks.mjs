/* probe-compare-attacks.mjs (2026-09-02, watch cycle 7) — adversarial pass over "Compare to"
   (blueprint step 5) and the sector scope, on a controlled in-page fixture so every figure can
   be recomputed by hand. Rules under test:
     1. Period arithmetic at EVERY period shape, both modes: a whole year → the year before;
        H1 → the prior year's H2; H2 → the same year's H1; Q1 → the prior year's Q4; Q2..Q4 →
        the previous quarter of the same year; January → December of the prior year; any other
        month → the month before it. "Same period last year" is always the same part, year − 1.
        With "All years" selected there is no previous period — the control says so.
     2. The comparison column equals an independent sum over the comparison period's own rows,
        and the Δ column is current − comparison (money) or percentage POINTS for margin.
     3. **An empty comparison period is never printed as zero.** A period with no invoices at
        all is not "0 SAR of revenue" — showing 0 and a triumphant +100% Δ is a fabricated
        number (M8, same shape as the A1 collections fix). It must say there is nothing to
        compare against.
     4. Degenerate bases stay honest: a comparison period whose revenue is 0 shows the money Δ
        with NO percentage (not ∞, not NaN); a negative comparison base gives a finite, signed
        percentage; margin with zero revenue reads 0.0%, never NaN.
     5. The sector chips scope BOTH sides of the comparison, not just the current period.
     6. The "cost is incomplete" warning names which side is incomplete (this period, the
        comparison period, or both).
   Run:  node scripts/qa/probe-compare-attacks.mjs      (port 8199)
   Sabotage: remove the empty-comparison guard in js/16 → check 3 red; make finCompPeriodOf
   return {year:y-1} for Q1 without wrapping to Q4 → check 1 red; drop `sector:p.sector` from
   finCompPeriodOf → check 5 red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8199; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function main() {
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };

  /* ---------- 1. period arithmetic, every shape ---------- */
  const shapes = [
    ['all part, 2026', { year: 2026, part: 'all' }, { prev: '2025|all', yoy: '2025|all' }],
    ['H1 2026', { year: 2026, part: 'H1' }, { prev: '2025|H2', yoy: '2025|H1' }],
    ['H2 2026', { year: 2026, part: 'H2' }, { prev: '2026|H1', yoy: '2025|H2' }],
    ['Q1 2026', { year: 2026, part: 'Q1' }, { prev: '2025|Q4', yoy: '2025|Q1' }],
    ['Q2 2026', { year: 2026, part: 'Q2' }, { prev: '2026|Q1', yoy: '2025|Q2' }],
    ['Q3 2026', { year: 2026, part: 'Q3' }, { prev: '2026|Q2', yoy: '2025|Q3' }],
    ['Q4 2026', { year: 2026, part: 'Q4' }, { prev: '2026|Q3', yoy: '2025|Q4' }],
    ['January 2026', { year: 2026, part: 'M:January' }, { prev: '2025|M:December', yoy: '2025|M:January' }],
    ['July 2026', { year: 2026, part: 'M:July' }, { prev: '2026|M:June', yoy: '2025|M:July' }],
    ['all years', { year: 'all', part: 'all' }, { prev: null, yoy: null }],
  ];
  const arith = await p.evaluate((shapes) => {
    const out = {}; const keep = JSON.parse(JSON.stringify(FIN.p));
    shapes.forEach(([label, per]) => {
      FIN.p.year = per.year; FIN.p.part = per.part;
      const f = (m) => { const c = window.finCompPeriodOf ? finCompPeriodOf(m) : null; return c ? (c.year + '|' + c.part) : null; };
      out[label] = { prev: f('prev'), yoy: f('yoy') };
    });
    FIN.p = keep; return out;
  }, shapes);
  let arithBad = 0;
  shapes.forEach(([label, , want]) => {
    const got = arith[label];
    if (got && got.prev === want.prev && got.yoy === want.yoy) ok(`${label}: previous → ${want.prev || 'none'} · same period last year → ${want.yoy || 'none'}`);
    else { arithBad++; fail(`${label}: got prev=${got && got.prev} yoy=${got && got.yoy}, expected prev=${want.prev} yoy=${want.yoy}`); }
  });
  if (!arithBad) ok('every period shape shifts correctly in both modes (10 shapes × 2)');

  /* ---------- controlled fixture ---------- */
  const setFixture = async () => p.evaluate(() => {
    const row = (id, date, total, cost, group, extra) => {
      const mo = date ? +date.slice(5, 7) : null;
      const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return Object.assign({
        id, invoice_no: id, client_group: group, customer_raw_name: group, invoice_date: date,
        year: date ? +date.slice(0, 4) : null, month: date ? M[mo - 1] : null, quarter: date ? 'Q' + (Math.floor((mo - 1) / 3) + 1) : null,
        service_type: 'Flights', products: 'Flights', record_type: 'b2b',
        total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: cost, profit_sar: total - cost,
        amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid', deleted_at: null, vat_sar: 0
      }, extra || {});
    };
    // b2b company and a "tender" company (sector comes from the linked business's payment terms)
    DB.businesses = DB.businesses || [];
    const uu = (id) => (window.__bizUuid ? __bizUuid(id) : id);
    DB.businesses.push({ id: 'qa-tender-biz', name: 'Tender Partner', paymentTerms: 'Tender award — net 60' });
    DB.businesses.push({ id: 'qa-b2b-biz', name: 'Plain B2B', paymentTerms: 'Net 30' });
    FIN.linkByGroup = FIN.linkByGroup || {};
    FIN.linkByGroup['Tender Co'] = { business_id: uu('qa-tender-biz'), is_client: true };
    FIN.linkByGroup['B2B Co'] = { business_id: uu('qa-b2b-biz'), is_client: true };
    FIN.rows = [
      row('C-Q1-26', '2026-03-10', 1000, 400, 'B2B Co'),        // current Q1 2026
      row('C-Q1-26-T', '2026-03-11', 600, 200, 'Tender Co'),    // current Q1 2026, tenders
      row('P-Q4-25', '2025-12-10', 500, 100, 'B2B Co'),         // previous period for Q1 2026
      row('P-Q4-25-T', '2025-12-11', 300, 300, 'Tender Co'),    // previous, tenders, cost complete
      row('Y-Q1-25', '2025-03-10', 800, 0, 'B2B Co'),           // same quarter last year, NO cost
      row('Z-Q2-26', '2026-05-10', 0, 0, 'B2B Co'),             // zero-revenue period (Q2 2026)
      row('N-Q3-26', '2026-08-10', -200, 0, 'B2B Co'),          // negative base (Q3 2026)
      row('J-JAN-26', '2026-01-15', 200, 50, 'B2B Co'),         // January 2026, for the month wrap
      row('D-Q4-26', '2026-11-10', 300, 0, 'B2B Co')            // Q4 2026, compared against the negative Q3
    ];
    if (window.clearFinCanon) clearFinCanon();
  });
  await setFixture();
  const show = async (year, part, cmp, sector) => {
    await p.evaluate(({ year, part, cmp, sector }) => { FIN.p = { year: year, part: part, sector: sector || 'all', cmp: cmp }; FIN.tab = 'overview'; if (window.clearFinCanon) clearFinCanon(); renderFinance(document.getElementById('view')); }, { year, part, cmp, sector });
    await settle();
    return p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find(e => /Compare to|المقارنة/.test(e.textContent)); return c ? c.innerText : ''; });
  };

  // Independent recount: this probe's own period matcher and sector rule, never the app's.
  const sums = (year, part, sector) => p.evaluate(({ year, part, sector }) => {
    const inPart = (r) => part === 'all' ? true
      : part === 'H1' ? (r.quarter === 'Q1' || r.quarter === 'Q2')
      : part === 'H2' ? (r.quarter === 'Q3' || r.quarter === 'Q4')
      : /^Q[1-4]$/.test(part) ? r.quarter === part
      : part.indexOf('M:') === 0 ? r.month === part.slice(2) : true;
    const secOf = (r) => {
      if (r.service_type === 'School Commission') return 'academies';
      const l = (FIN.linkByGroup || {})[r.client_group];
      if (l && l.business_id) { const bz = (DB.businesses || []).find(b => (window.__bizUuid ? __bizUuid(b.id) : b.id) === l.business_id); if (bz && /tender/i.test(String(bz.paymentTerms || ''))) return 'tenders'; }
      return 'b2b';
    };
    let n = 0, rev = 0, cost = 0, prof = 0, noCost = 0;
    (FIN.rows || []).forEach(r => {
      if (r.deleted_at || r.integrity_status !== 'verified_paid') return;
      if (String(year) !== 'all' && String(r.year) !== String(year)) return;
      if (!inPart(r)) return;
      if (sector && sector !== 'all' && secOf(r) !== sector) return;
      n++; rev += +r.revenue_sar || 0; cost += +r.cost_sar || 0; prof += +r.profit_sar || 0; if ((+r.cost_sar || 0) === 0) noCost++;
    });
    return { n, rev, cost, prof, noCost, margin: rev > 0 ? prof / rev * 100 : 0 };
  }, { year, part, sector });
  const m0 = (n) => Math.round(n).toLocaleString('en-US');
  const dTxt = (cur, base) => { const d = cur - base; const pct = base !== 0 ? d / Math.abs(base) * 100 : null; return (d >= 0 ? '+' : '') + m0(d) + ' SAR' + (pct === null ? '' : ' (' + (pct >= 0 ? '+' : '') + Math.round(pct) + '%)'); };

  /* ---------- 2. figures + Δ ---------- */
  let card = await show('2026', 'Q1', 'prev');
  const cell = (label, txt) => { const m = (txt || card).match(new RegExp('^' + label + '\\t(.+)$', 'm')); return m ? m[1].split('\t') : null; };
  const cur = await sums(2026, 'Q1'), base = await sums(2025, 'Q4');
  const rev = cell('Revenue'), cost = cell('Cost'), prof = cell('Profit'), marg = cell('Margin');
  if (/2025 · Q4/.test(card)) ok('Q1 2026 vs previous period is labelled 2025 · Q4'); else fail('comparison label wrong: ' + JSON.stringify(card.slice(0, 200)));
  const rowOk = (got, c, b, label) => got && got[0] === m0(c) + ' SAR' && got[1] === m0(b) + ' SAR' && got[2] === dTxt(c, b) ? ok(`${label} ${m0(c)} vs ${m0(b)} → ${dTxt(c, b)} — both columns match an independent recount of their own period`) : fail(`${label} row: ${JSON.stringify(got)}, recount says ${m0(c)} / ${m0(b)} / ${dTxt(c, b)}`);
  rowOk(rev, cur.rev, base.rev, 'Revenue');
  rowOk(cost, cur.cost, base.cost, 'Cost');
  rowOk(prof, cur.prof, base.prof, 'Profit');
  const wantM = [cur.margin.toFixed(1) + '%', base.margin.toFixed(1) + '%', ((cur.margin - base.margin) >= 0 ? '+' : '') + (cur.margin - base.margin).toFixed(1) + ' pts'];
  if (marg && marg[0] === wantM[0] && marg[1] === wantM[1] && marg[2] === wantM[2]) ok(`Margin ${wantM[0]} vs ${wantM[1]} → ${wantM[2]} (percentage POINTS, never a money Δ)`); else fail('Margin row: ' + JSON.stringify(marg) + ' expected ' + JSON.stringify(wantM));
  if (!/NaN|Infinity|undefined/.test(card)) ok('no NaN / Infinity / undefined in the comparison card'); else fail('card carries NaN/Infinity/undefined');

  /* ---------- 3. month wrap with real data on both sides ---------- */
  card = await show('2026', 'M:January', 'prev');   // January 2026 (200) vs December 2025 (500+300)
  if (/2025 · December/i.test(card)) ok('January 2026 vs previous period targets 2025 · December (the year wraps)'); else fail('month wrap label: ' + JSON.stringify(card.slice(0, 200)));
  const rj = cell('Revenue');
  if (rj && /^200 SAR$/.test(rj[0]) && /^800 SAR$/.test(rj[1]) && /^-600 SAR \(-75%\)$/.test(rj[2])) ok('January 200 vs December 800 → -600 SAR (-75%)'); else fail('month wrap figures: ' + JSON.stringify(rj));

  /* ---------- 4. an empty period is never printed as zero (either side) ---------- */
  card = await show('2026', 'Q2', 'yoy');           // Q2 2026 has a row; Q2 2025 has none
  if (/No invoices in the comparison period \(2025 · Q2\)/.test(card)) ok('EMPTY comparison period: says "No invoices in the comparison period (2025 · Q2)" instead of drawing zeros'); else fail('empty comparison period printed as data: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 300)));
  if (!/\bΔ\b/.test(card) && !/\+0 SAR/.test(card)) ok('…and no Δ table is drawn for it (no "+0 SAR (+0%)" against a period that has no data)'); else fail('a Δ table was still drawn against an empty period: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 300)));
  card = await show('2026', 'M:February', 'prev');  // February 2026 has none; January 2026 has a row
  if (/No invoices in this period \(2026 · February\)/.test(card)) ok('EMPTY current period: names this period, so a "-100%" collapse that never happened is never shown'); else fail('empty current period: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 300)));
  card = await show('2024', 'Q2', 'prev');          // both sides empty (no 2024 rows at all)
  if (/No invoices in this period \(2024 · Q2\) or the comparison period \(2024 · Q1\)/.test(card)) ok('both sides empty: both are named'); else fail('both-empty wording: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 300)));

  /* ---------- 4b. degenerate but real bases ---------- */
  card = await show('2026', 'Q3', 'prev');   // Q3 2026 (−200) vs Q2 2026 (one row, 0 revenue)
  const r3 = cell('Revenue');
  if (r3 && /^0 SAR$/.test(r3[1]) && !/%/.test(r3[2])) ok('a comparison period with rows but ZERO revenue shows the money Δ and no percentage (never ∞)'); else fail('zero-base row: ' + JSON.stringify(r3));
  if (!/NaN|Infinity/.test(card)) ok('zero base: no NaN / Infinity'); else fail('zero base produced NaN/Infinity');
  const m3 = cell('Margin');
  if (m3 && /^0\.0%$/.test(m3[1])) ok('margin of a zero-revenue period reads 0.0%, not NaN'); else fail('zero-revenue margin: ' + JSON.stringify(m3));
  card = await show('2026', 'Q4', 'prev');   // Q4 2026 (300) vs Q3 2026 (−200): negative base
  const r4 = cell('Revenue');
  if (r4 && /^-200 SAR$/.test(r4[1]) && /^\+500 SAR \(\+250%\)$/.test(r4[2])) ok('negative comparison base (−200 → 300) gives a finite +500 SAR (+250%)'); else fail('negative base row: ' + JSON.stringify(r4));

  /* ---------- 5. sector scopes both sides ---------- */
  for (const sec of ['tenders', 'b2b']) {
    card = await show('2026', 'Q1', 'prev', sec);
    const c1 = await sums(2026, 'Q1', sec), b1 = await sums(2025, 'Q4', sec);
    const rs = cell('Revenue');
    if (rs && rs[0] === m0(c1.rev) + ' SAR' && rs[1] === m0(b1.rev) + ' SAR') ok(`sector "${sec}": BOTH columns are ${sec}-only (${m0(c1.rev)} vs ${m0(b1.rev)}) — the chip scopes the comparison too`); else fail(`sector ${sec} not applied to both sides: ${JSON.stringify(rs)}, recount ${m0(c1.rev)} / ${m0(b1.rev)}`);
    if (c1.rev !== (await sums(2026, 'Q1')).rev) ok(`…and "${sec}" is a real subset of the unfiltered period, not the whole thing`); else fail(`sector ${sec} filter changed nothing`);
  }

  /* ---------- 6. cost-incomplete warning names the side ---------- */
  card = await show('2026', 'Q1', 'yoy');    // Q1 2025 = one row with NO cost
  if (/2025 · Q1/.test(card)) ok('same period last year targets 2025 · Q1'); else fail('yoy label: ' + JSON.stringify(card.slice(0, 200)));
  if (/Cost is incomplete in the comparison period/.test(card)) ok('the cost warning names the comparison period as the incomplete side'); else fail('cost warning missing/mis-worded: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 300)));
  card = await show('2026', 'Q1', 'prev');
  if (!/Cost is incomplete/.test(card)) ok('…and no cost warning when both periods have their costs recorded'); else fail('cost warning fired with complete costs: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 250)));

  /* ---------- Arabic ---------- */
  await p.evaluate(() => { LANG = 'ar'; });
  card = await show('2026', 'Q2', 'yoy');
  if (/لا توجد فواتير|لا يوجد ما يُقارن/.test(card)) ok('Arabic: the empty-comparison message is translated'); else fail('Arabic empty-period message missing: ' + JSON.stringify(card.replace(/\n/g, ' | ').slice(0, 250)));
  await p.evaluate(() => { LANG = 'en'; });

  if (errors.length) fail(errors.length + ' page error(s): ' + JSON.stringify(errors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
