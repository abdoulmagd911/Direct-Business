/* probe-ledger-attacks.mjs (2026-09-02, watch cycle 4) — adversarial pass over the Ledger tab
   (finance_transactions). Rules under test, from docs/DIRECT_PAYMENTS_MODEL.md Rounds 7/8/11:
     1. Stage derivation: invoice_no → invoiced; else overdue===true → overdue; else
        expense_status 'ready' → ready; else pending. Seed covers all four.
     2. KPI strip is CONFIRMED ONLY (ready + invoiced). A pending row's estimate is shown
        at row level, tagged "est.", and never reaches the headline totals.
     3. Overdue is a mirror, never invented: null/false shows nothing and counts nothing.
        An INVOICED row that Direct Payments has flagged overdue===true must still count on
        the Overdue tile and be found by the Overdue stage filter — stage precedence is not
        a reason to hide a mirrored fact (real gap found by this probe, fixed same cycle).
     4. Filters (profile type / stage / company) and search compose; search never throws on
        regex specials; a stale business filter (no such company) yields an honest empty state.
     5. Hostile rows never crash the tab or print "NaN": string amounts, null confirmed cost
        on a ready row, unknown business_id, missing client_profile_id, duplicate
        transaction_ref, HTML in a ref.
     6. Ledger CSV == the filtered table: same row count, company + profile + stage on every
        row, csvGuard applied to a formula-looking ref, overdue mirrored as-is.
   Run:  node scripts/qa/probe-ledger-attacks.mjs        (port 8193)
   Sabotage: SABOTAGE=1 makes the injected invoiced+overdue row NOT overdue in the page's
   own view of the fixture (simulates the pre-fix counting) — check 3 must then fail. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8193; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const SABOTAGE = process.env.SABOTAGE || '';
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
  const view = () => p.evaluate(() => document.querySelector('#view').innerHTML);
  const tileNum = async (label) => p.evaluate((label) => {
    const els = [...document.querySelectorAll('#view .card')];
    const el = els.find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    if (!el) return null; const v = el.children[1]; const t = v && v.getAttribute('title');
    return t ? +t.replace(/[^\d.-]/g, '') : (v ? +v.textContent.trim().replace(/[^\d.-]/g, '') : null);
  }, label);
  const setF = async (k, v) => { await p.evaluate(({ k, v }) => finTxnF(k, v), { k, v }); await settle(); };
  const resetF = async () => { await p.evaluate(() => { TXN.f = { q: '', profileType: 'all', business: 'all', stage: 'all' }; TXN.collapsed = {}; render(); }); await settle(); };
  const tableRows = () => p.evaluate(() => [...document.querySelectorAll('#view table tbody tr')].length);
  const csvCapture = async () => p.evaluate(() => {
    let captured = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { captured = blob; return 'blob:qa'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { finTxnCSV(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    // Blob.text() strips a leading BOM by spec, so read the raw bytes and re-attach it for the check.
    return captured ? captured.arrayBuffer().then(ab => { const u8 = new Uint8Array(ab); const bom = u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf; return (bom ? '\ufeff' : '') + new TextDecoder('utf-8').decode(u8); }) : null;
  });
  const parseCsv = (txt) => { // every cell is quoted by finTxnCSV
    const lines = txt.replace(/^\ufeff/, '').split('\n').filter(Boolean);
    const cells = (l) => { const out = []; let cur = '', inq = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (inq) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inq = false; else cur += c; } else if (c === '"') inq = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
    const head = cells(lines[0]); return { head, rows: lines.slice(1).map(l => { const c = cells(l); const o = {}; head.forEach((h, i) => o[h] = c[i]); return o; }) };
  };

  await p.evaluate(() => { current = 'finance'; render(); if (window.finGo) finGo('ledger'); });
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.profiles)); i++) await p.waitForTimeout(250);
  await settle();

  /* ---------- 1. seed stage derivation, no injection yet ---------- */
  const seed = await p.evaluate(() => (TXN.rows || []).map(r => ({ id: r.id, inv: r.invoice_no, od: r.overdue, es: r.expense_status })));
  const seedIds = seed.map(s => s.id).sort().join(',');
  if (seedIds === 'tx0,tx1,tx2,tx3') ok('seed fixture present: tx0 invoiced / tx1 ready / tx2 pending / tx3 overdue'); else fail('unexpected seed fixture: ' + seedIds);
  let v = await view();
  const badgeCount = (label) => (v.match(new RegExp('>' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</span>', 'g')) || []).length;
  if (badgeCount('Invoiced') === 1 && badgeCount('Ready to invoice') === 1 && badgeCount('Expenses pending') === 1 && badgeCount('Overdue') >= 1) ok('one stage badge per seed row: Invoiced / Ready to invoice / Expenses pending / Overdue');
  else fail(`stage badges off: invoiced=${badgeCount('Invoiced')} ready=${badgeCount('Ready to invoice')} pending=${badgeCount('Expenses pending')} overdue=${badgeCount('Overdue')}`);
  // seed KPIs recomputed independently
  const kSeed = { rev: 42000 + 9500, cost: 35000 + 7600, prof: (42000 - 35000) + (9500 - 7600), pend: 2, est: 4800 + 12000, overdue: 1 };
  for (const [lbl, want] of [['Confirmed revenue', kSeed.rev], ['Confirmed cost', kSeed.cost], ['Confirmed profit', kSeed.prof], ['Overdue', kSeed.overdue]]) {
    const got = await tileNum(lbl); if (got === want) ok(`seed KPI "${lbl}" = ${want}`); else fail(`seed KPI "${lbl}" = ${got}, expected ${want}`);
  }
  if (/Pending \(est\. only\)[\s\S]{0,200}?>2 <span[^>]*>· 16\.8K est\./.test(v)) ok('seed KPI "Pending (est. only)" = 2 rows · 16.8K est. — shown apart from the confirmed tiles'); else fail('seed Pending tile text unexpected');
  if (v.indexOf('4,800 est.') >= 0 && v.indexOf('12,000 est.') >= 0) ok('pending rows show their estimate tagged "est." at row level'); else fail('pending rows missing "est." tags');

  /* ---------- 2. inject hostile rows in-page ---------- */
  await p.evaluate((SAB) => {
    const base = { zatca_dpin: null, direct_uuid: null, product: 'Direct Hotels', service_type: 'Hotels', origin: 'booking', proposal_ref: null, source: 'qa', deleted_at: null };
    TXN.rows.push(
      // A. invoiced AND mirrored overdue — must count on the Overdue tile (the gap this probe found)
      Object.assign({}, base, { id: 'qa-inv-od', transaction_ref: 'TXN-QA-INVOD', invoice_no: 'INV-QA-OD1', business_id: 'b4', client_profile_id: 'cp2', amount_sar: 3000, expense_status: null, cost_confirmed_sar: 2000, cost_estimate_sar: null, amount_received_sar: 0, amount_remaining_sar: 3000, overdue: SAB === '1' ? null : true, created_at_source: '2026-06-01T10:00:00Z' }),
      // B. string amounts with thousands separators + null confirmed cost on a ready row
      Object.assign({}, base, { id: 'qa-str', transaction_ref: 'TXN-QA-STR', invoice_no: null, business_id: 'b4', client_profile_id: 'cp1', amount_sar: '1,250', expense_status: 'ready', cost_confirmed_sar: null, cost_estimate_sar: null, amount_received_sar: '0', amount_remaining_sar: '1,250', overdue: false, created_at_source: '2026-06-02T10:00:00Z' }),
      // B2. an amount that is NOT a number in any reading — "n/a". Added 2026-09-03 (watch cycle
      // 20) after a mutation audit: silencing the Ledger's unreadable-amount notice was caught by
      // nothing, because "1,250" now parses correctly and no row was left flagged. A notice with
      // nothing to report is not a guard.
      Object.assign({}, base, { id: 'qa-nan', transaction_ref: 'TXN-QA-NAN', invoice_no: null, business_id: 'b4', client_profile_id: 'cp1', amount_sar: 'n/a', expense_status: 'ready', cost_confirmed_sar: 0, cost_estimate_sar: null, amount_received_sar: 0, amount_remaining_sar: 0, overdue: false, created_at_source: '2026-06-02T11:00:00Z' }),
      // C. unknown business, missing profile, pending
      Object.assign({}, base, { id: 'qa-orphan', transaction_ref: 'TXN-QA-ORPHAN', invoice_no: null, business_id: 'no-such-business', client_profile_id: null, amount_sar: 700, expense_status: 'pending', cost_confirmed_sar: 0, cost_estimate_sar: 500, amount_received_sar: 0, amount_remaining_sar: 0, overdue: null, created_at_source: '2026-06-03T10:00:00Z' }),
      // D. duplicate transaction_ref of the seed's tx1, HTML in the ref, formula-looking ref for the CSV guard
      Object.assign({}, base, { id: 'qa-dup', transaction_ref: 'TXN-QA-002', invoice_no: null, business_id: 'b0', client_profile_id: 'cp0', amount_sar: 100, expense_status: 'pending', cost_confirmed_sar: 0, cost_estimate_sar: 80, amount_received_sar: 0, amount_remaining_sar: 0, overdue: null, created_at_source: '2026-06-04T10:00:00Z' }),
      Object.assign({}, base, { id: 'qa-html', transaction_ref: '<b id="qa-xss">x</b>', invoice_no: null, business_id: 'b0', client_profile_id: 'cp0', amount_sar: 50, expense_status: 'pending', cost_confirmed_sar: 0, cost_estimate_sar: 10, amount_received_sar: 0, amount_remaining_sar: 0, overdue: null, created_at_source: '2026-06-05T10:00:00Z' }),
      Object.assign({}, base, { id: 'qa-formula', transaction_ref: '=HYPERLINK("http://evil")', invoice_no: null, business_id: 'b0', client_profile_id: 'cp0', amount_sar: 20, expense_status: 'ready', cost_confirmed_sar: 5, cost_estimate_sar: null, amount_received_sar: 0, amount_remaining_sar: 20, overdue: null, created_at_source: '2026-06-06T10:00:00Z' })
    );
    TXN.f = { q: '', profileType: 'all', business: 'all', stage: 'all' }; TXN.collapsed = {}; render();
  }, SABOTAGE);
  await settle();
  v = await view();
  const N = 11;   // seed 4 + 7 hostile (an unreadable-amount row added in watch cycle 20)
  const shown = await tableRows();
  if (shown === N) ok(`all ${N} rows render (seed 4 + 7 hostile) — nothing crashed the tab`); else fail(`table shows ${shown} rows, expected ${N}`);
  if (v.indexOf('NaN') < 0) ok('no "NaN" anywhere in the rendered Ledger'); else fail('rendered Ledger contains "NaN"');
  if (!(await p.evaluate(() => !!document.querySelector('#qa-xss')))) ok('HTML in a transaction_ref is escaped, not rendered'); else fail('HTML in transaction_ref rendered as an element');
  if (v.indexOf('no-such-business') >= 0 && shown === N) ok('unknown business_id falls back to the raw id in the company header (no crash, no blank group)'); else fail('orphan row lost or company header blank');
  if (/TXN-QA-ORPHAN[\s\S]{0,400}?—/.test(v)) ok('missing client_profile_id renders the profile cell as "—"'); else fail('orphan profile cell not "—"');

  /* 2026-09-03 (watch cycle 19) — this recount used to mirror `Number(x)||0`, which turns
     "1,250" into a clean ZERO, and the check below asserted that zero was correct. It was not:
     the Performance tab has sanitised the same string into 1250 since watch cycle 2, so one page
     was reading one amount two different ways and this probe was defending the disagreement. The
     Ledger now reads every amount through its own chokepoint, and the recount follows it. */
  const exp = await p.evaluate(() => {
    const st = (r) => r.invoice_no ? 'invoiced' : r.overdue === true ? 'overdue' : r.expense_status === 'ready' ? 'ready' : 'pending';
    const n = (x) => { if (x == null || x === '') return 0; if (typeof x === 'number') return isFinite(x) ? x : 0; const v = parseFloat(String(x).replace(/[,\s]/g, '')); return (isFinite(v) && /^-?[\d.,\s]+$/.test(String(x).trim())) ? v : 0; };
    let rev = 0, cost = 0, prof = 0, pend = 0, est = 0, od = 0;
    (TXN.rows || []).forEach(r => { if (st(r) === 'ready' || st(r) === 'invoiced') { rev += n(r.amount_sar); cost += n(r.cost_confirmed_sar); prof += n(r.amount_sar) - n(r.cost_confirmed_sar); } else { pend++; est += n(r.cost_estimate_sar); } if (r.overdue === true) od++; });
    return { rev, cost, prof, pend, est, od };
  });
  for (const [lbl, want] of [['Confirmed revenue', exp.rev], ['Confirmed cost', exp.cost], ['Confirmed profit', exp.prof]]) {
    const got = await tileNum(lbl); if (got === want) ok(`KPI "${lbl}" = ${want} under hostile rows (string amounts count as 0, never NaN; pending never blends in)`); else fail(`KPI "${lbl}" = ${got}, expected ${want}`);
  }
  /* ---------- an amount nobody can read is counted as 0 AND said out loud (watch cycle 20) ---------- */
  const badMoney = await p.evaluate(() => {
    const html = document.querySelector('#view').innerHTML;
    const flagged = (TXN.rows || []).filter(r => r._badMoney).length;
    return { flagged, said: /row[\s\S]{0,80}unreadable amount[\s\S]{0,40}counted as 0/i.test(html) };
  });
  if (badMoney.flagged >= 1) ok(`an amount that is not a number in any reading is flagged on its row (${badMoney.flagged} row) rather than quietly becoming a zero nobody questions`);
  else fail('no row was flagged as carrying an unreadable amount, though the fixture contains one');
  if (badMoney.said) ok('…and the Ledger says how many such rows there are, the way the Overview has since watch cycle 2');
  else fail('the Ledger counted an unreadable amount as 0 and said nothing about it');

  /* ---------- duplicate transaction reference: marked, never merged (watch cycle 19) ---------- */
  const dup = await p.evaluate(() => {
    const html = document.querySelector('#view').innerHTML;
    const refs = {}; (TXN.rows || []).forEach(r => { if (r.transaction_ref) refs[r.transaction_ref] = (refs[r.transaction_ref] || 0) + 1; });
    const dupes = Object.keys(refs).filter(k => refs[k] > 1);
    return { dupes, marks: (html.match(/\u00d7 same ref/g) || []).length, banner: /transaction reference[\s\S]{0,60}(appear|appears) on more than one row/.test(html) };
  });
  if (dup.dupes.length) {
    if (dup.marks >= 2) ok('both rows carrying the same transaction reference are marked on the row itself (' + dup.marks + ' marks for ' + dup.dupes.length + ' repeated ref) — shown, never silently merged');
    else fail('a repeated transaction ref exists but only ' + dup.marks + ' row(s) are marked');
    if (dup.banner) ok('…and the ledger says so once above the table, so it is visible without scanning every row'); else fail('no duplicate-reference notice above the table');
  } else fail('the fixture no longer contains a repeated transaction_ref — this check would prove nothing');

  if (exp.rev === 42000 + 9500 + 3000 + 1250 + 20) ok('independent recount confirms: a "1,250" string amount now contributes 1,250 to confirmed revenue — the same number the Performance tab reads from the same string, instead of a silent 0 on one tab and 1,250 on the other'); else fail('recount drifted: ' + JSON.stringify(exp));

  /* ---------- 3. overdue mirror ---------- */
  const odTile = await tileNum('Overdue');
  if (odTile === exp.od) ok(`Overdue tile = ${exp.od} = every row with overdue===true, INCLUDING the invoiced one (mirror wins over stage precedence)`); else fail(`Overdue tile = ${odTile}, but ${exp.od} rows carry overdue===true — an invoiced+overdue row is being hidden`);
  await setF('stage', 'overdue');
  const odRows = await tableRows();
  if (odRows === exp.od) ok(`stage filter "Overdue" lists ${exp.od} rows (tx3 + the invoiced INV-QA-OD1)`); else fail(`stage filter "Overdue" lists ${odRows} rows, expected ${exp.od}`);
  v = await view();
  if (SABOTAGE !== '1' && v.indexOf('INV-QA-OD1') >= 0) ok('the invoiced+overdue row keeps its invoice link and stage "Invoiced" but carries an Overdue marker'); else if (SABOTAGE !== '1') fail('invoiced+overdue row missing from the Overdue filter view');
  if (SABOTAGE !== '1') {
    const marker = /INV-QA-OD1[\s\S]{0,900}?>Invoiced<\/span>[\s\S]{0,300}?>Overdue<\/span>/.test(v);
    if (marker) ok('row shows BOTH badges: Invoiced + Overdue (stage precedence untouched, mirrored fact visible)'); else fail('invoiced+overdue row has no visible Overdue marker next to its Invoiced badge');
  }
  await resetF(); v = await view();
  // null / false show nothing: count "Overdue" badges = rows with overdue===true only
  const odBadges = (v.match(/>Overdue<\/span>/g) || []).length;
  if (odBadges === exp.od) ok(`exactly ${exp.od} Overdue badges on screen — overdue null/false rows show nothing (never "not overdue")`); else fail(`${odBadges} Overdue badges on screen for ${exp.od} overdue rows`);
  if (v.indexOf('Not overdue') < 0 && v.indexOf('not overdue') < 0) ok('no invented "not overdue" wording anywhere'); else fail('"not overdue" wording present — overdue is a mirror, never invented');

  /* ---------- 4. filters + search ---------- */
  await setF('profileType', 'tender');
  let got = await tableRows(); let want = await p.evaluate(() => TXN.rows.filter(r => { const pr = TXN.profiles[r.client_profile_id]; return pr && pr.profile_type === 'tender'; }).length);
  if (got === want && want > 0) ok(`profile filter Tender → ${want} rows (orphan with no profile excluded)`); else fail(`Tender filter ${got} vs ${want}`);
  await setF('stage', 'pending'); got = await tableRows(); want = await p.evaluate(() => TXN.rows.filter(r => { const pr = TXN.profiles[r.client_profile_id]; return pr && pr.profile_type === 'tender' && !r.invoice_no && r.overdue !== true && r.expense_status !== 'ready'; }).length);
  if (got === want) ok(`Tender + Expenses pending compose → ${want} rows`); else fail(`Tender+pending ${got} vs ${want}`);
  await resetF();
  await setF('business', 'b4'); got = await tableRows(); want = await p.evaluate(() => TXN.rows.filter(r => r.business_id === 'b4').length);
  if (got === want) ok(`company filter → ${want} rows for one company`); else fail(`company filter ${got} vs ${want}`);
  await setF('business', 'gone-company'); v = await view();
  if ((await tableRows()) === 0 && v.indexOf('No transactions match.') >= 0) ok('stale company filter (company no longer present) → honest empty state, no crash'); else fail('stale company filter did not give the empty state');
  await resetF();
  for (const q of ['(', '[', '\\', '*', 'INV-QA-001', 'txn-qa-002', 'ZZZ-NOTHING']) {
    await setF('q', q); const n = await tableRows();
    const w = await p.evaluate((q) => { const bn = (id) => { try { return (DB.businesses.find(b => (window.__bizUuid ? __bizUuid(b.id) : b.id) === id) || {}).name || ''; } catch (_) { return ''; } }; const lq = q.toLowerCase(); return TXN.rows.filter(r => ((bn(r.business_id) || '') + ' ' + (r.transaction_ref || '') + ' ' + (r.invoice_no || '') + ' ' + (r.zatca_dpin || '') + ' ' + (r.product || '')).toLowerCase().indexOf(lq) >= 0).length; }, q);
    if (n === w) ok(`search ${JSON.stringify(q)} → ${n} rows (plain substring, no regex throw)`); else fail(`search ${JSON.stringify(q)} → ${n}, expected ${w}`);
  }
  await setF('q', 'txn-qa-002'); v = await view();
  if ((await tableRows()) === 2) ok('duplicate transaction_ref: both rows stay visible (a data fault is shown, never silently collapsed)'); else fail('duplicate transaction_ref rows collapsed or lost');
  await resetF();
  if (errors.length === 0) ok('no page errors through every filter / search / render');

  /* ---------- 5. company grouping ---------- */
  v = await view();
  const groups = await p.evaluate(() => [...document.querySelectorAll('#view .card[style*="padding:0"]')].length);
  const wantGroups = await p.evaluate(() => new Set(TXN.rows.map(r => r.business_id)).size);
  if (groups === wantGroups) ok(`${groups} company groups = distinct business_id count (orphan gets its own group)`); else fail(`${groups} groups vs ${wantGroups} distinct companies`);
  const hdr = await p.evaluate(() => { const h = [...document.querySelectorAll('#view .card[style*="padding:0"] > div:first-child')].map(e => e.textContent); return h; });
  const b4hdr = hdr.find(h => /TXN|rev/.test(h) && /prepaid|Prepaid|b4|Madar|Rawasi|Capital|Milestone|Summits|Tulip|Kanaf|Ministry/.test(h)) || hdr[0];
  const b4 = await p.evaluate(() => { const n = (x) => Number(x) || 0; const st = (r) => r.invoice_no ? 'invoiced' : r.overdue === true ? 'overdue' : r.expense_status === 'ready' ? 'ready' : 'pending'; let rev = 0; TXN.rows.filter(r => r.business_id === 'b4').forEach(r => { if (st(r) === 'ready' || st(r) === 'invoiced') rev += n(r.amount_sar); }); return rev; });
  if (hdr.some(h => h.indexOf(b4.toLocaleString('en-US')) >= 0 && h.indexOf('confirmed only') >= 0)) ok(`company header total ${b4.toLocaleString('en-US')} = confirmed rows only, labelled "(confirmed only)"`); else fail('company header total not confirmed-only or unlabelled: ' + JSON.stringify(hdr));
  await p.evaluate(() => txnToggleCo('b4')); await settle();
  const afterCollapse = await tableRows();
  if (afterCollapse === N - (await p.evaluate(() => TXN.rows.filter(r => r.business_id === 'b4').length))) ok('collapsing a company hides only its rows; KPI strip unchanged'); else fail('collapse changed the wrong rows');
  if ((await tileNum('Confirmed revenue')) === exp.rev) ok('KPI strip ignores collapse state (totals are about the filter, not what is unfolded)'); else fail('KPI changed on collapse');
  await resetF();

  /* ---------- 6. CSV == table ---------- */
  await setF('profileType', 'postpaid');
  const csvTxt = await csvCapture();
  if (!csvTxt) fail('CSV export produced nothing'); else {
    const csv = parseCsv(csvTxt); const tRows = await tableRows();
    if (csv.rows.length === tRows && tRows > 0) ok(`CSV rows (${csv.rows.length}) == filtered table rows (${tRows}) — export follows the filter`); else fail(`CSV ${csv.rows.length} rows vs table ${tRows}`);
    if (['company', 'profile_type', 'stage', 'overdue', 'amount_sar'].every(c => csv.head.includes(c))) ok('CSV carries company, profile_type, stage and overdue columns on every row (owner ruling)'); else fail('CSV header missing columns: ' + csv.head.join(','));
    const od = csv.rows.find(r => r.invoice_no === 'INV-QA-OD1');
    if (od && od.stage === 'invoiced' && od.overdue === 'true' && od.profile_type === 'postpaid') ok('CSV: invoiced+overdue row exports stage=invoiced AND overdue=true — the mirror is not lost in the export'); else fail('CSV invoiced+overdue row wrong: ' + JSON.stringify(od));
    if (csv.rows.every(r => r.profile_type === 'postpaid')) ok('every exported row is the filtered profile type'); else fail('CSV leaked rows outside the filter');
  }
  await resetF(); await setF('business', 'b0');
  const csv2 = parseCsv(await csvCapture());
  const f = csv2.rows.find(r => r.transaction_ref && r.transaction_ref.indexOf('HYPERLINK') >= 0);
  if (f && f.transaction_ref.charAt(0) === "'") ok('CSV: formula-looking ref is neutralised with a leading apostrophe (csvGuard)'); else fail('CSV formula guard missing: ' + JSON.stringify(f));
  const h = csv2.rows.find(r => r.transaction_ref && r.transaction_ref.indexOf('qa-xss') >= 0);
  if (h && h.transaction_ref === '<b id="qa-xss">x</b>') ok('CSV: HTML ref exported verbatim (a spreadsheet is not a browser — no double-escaping)'); else fail('CSV HTML ref altered: ' + JSON.stringify(h));
  if (csvTxt.charCodeAt(0) === 0xfeff) ok('CSV starts with a BOM so Excel opens Arabic names correctly'); else fail('CSV has no BOM');
  await resetF();

  if (errors.length) errors.forEach(e => fail(e));
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
