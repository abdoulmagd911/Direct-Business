/* probe-period-bar-attacks.mjs (2026-09-06, watch cycle 30) - the period bar, driven only by clicking it.

   Cycle 29 found that probe-filter-combination-attacks had been reaching around the controls it
   claimed to test - it set FIN.p.sector directly instead of calling window.finPS, so a finPS that
   also wiped the month walked straight through it. That was fixed by calling the handlers. This
   probe goes one step further and never calls a handler at all: every control is operated the way
   a person operates it - clicking the actual <button>, setting the actual <select> and dispatching
   a real change event - so an onclick wired to the wrong value, or a chip that highlights the
   wrong sibling, is visible too.

   The bar renders more than the three controls cycle 29 exercised: a year select, seven period
   chips (All, Q1-Q4, H1, H2), a month select built only from months that HAVE invoices, four
   sector chips, and its own printed label from finPeriodLabel(). That label is the app's claim
   about what is on screen, so after every control this probe checks four things agree: the state,
   the label, which controls show themselves as active, and the rows actually in scope.

   Under test:
     1. Each of the seven period chips sets its own part, highlights itself and no other period
        chip, is named by the label, and leaves exactly the rows an independent recount expects.
     2. Same for every month the dropdown offers, every year it offers, and every sector chip.
     3. After each one, the label, the chips, BOTH selects and the row set all agree with the
        state - the four can never drift apart.
     4. The cross-control case the bar is built to fall into: the month dropdown lists only months
        that HAVE invoices, so choosing a month and then changing to a year without that month
        leaves the state filtering by a month the dropdown can no longer show. Whatever the app
        does there, it must not display a control that contradicts the filter actually in force.

   Run:  node scripts/qa/probe-period-bar-attacks.mjs        (port 8707)
   Sabotage (file-level): wire a chip's onclick to the wrong value; make finPeriodLabel print the
   part without the month name. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8707;
let failures = 0;
const fail = (m) => { failures++; console.log('  x ' + m); };
const ok = (m) => console.log('  + ' + m);
const note = (m) => console.log('  . ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (v) => Math.round(v * 100) / 100;

const CLIENTS = [
  { group: 'PB Tender A', biz: 'pb-a', profile: 'tender' },
  { group: 'PB B2B B', biz: 'pb-b', profile: 'postpaid' }
];
/* 2026 carries every month; 2025 deliberately carries only Jan-Jun, so November is in the
   dropdown while 2026 is selected and vanishes from it the moment the year changes to 2025 —
   which is the cross-control case check 4 is built to reach. */
const YEAR_MONTHS = { 2025: [1, 2, 3, 4, 5, 6], 2026: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
function inv(id, c, y, mo, total) {
  const d = y + '-' + String(mo).padStart(2, '0') + '-12';
  return {
    id: id, invoice_no: 'PB-' + id, line_no: 1, zatca_dpin: null,
    client_group: c.group, customer_raw_name: c.group, invoice_date: d, year: y,
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total,
    cost_sar: Math.round(total * 0.7), profit_sar: total - Math.round(total * 0.7), vat_sar: 0,
    amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'pb-qa',
    revenue_way: 'invoice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  };
}
const SEED = [];
let n = 0;
Object.keys(YEAR_MONTHS).forEach(function (y) {
  YEAR_MONTHS[y].forEach(function (mo) {
    CLIENTS.forEach(function (c) { n++; SEED.push(inv('i' + n, c, +y, mo, 1000 + n * 7)); });
  });
});

const srv = start(PORT, {
  finance_invoices: SEED, finance_transactions: [],
  finance_client_links: CLIENTS.map((c, i) => ({ id: 'pbl' + i, client_group: c.group, business_id: c.biz, is_client: true, confirmed_by: 'auto-match' })),
  client_profiles: CLIENTS.map((c, i) => ({ id: 'pbp' + i, business_id: c.biz, direct_client_id: 'PB-' + i, profile_type: c.profile, payment_terms: 'Net 30', billing_cycle: 'monthly', status: 'active' }))
});
const BASE = 'http://localhost:' + PORT;

const sectorOf = (g) => (CLIENTS.find(c => c.group === g) || {}).profile === 'tender' ? 'tenders' : 'b2b';
function want(year, part, sector) {
  return SEED.filter(function (r) {
    if (String(year) !== 'all' && String(r.year) !== String(year)) return false;
    if (part !== 'all') {
      if (part === 'H1') { if (r.quarter !== 'Q1' && r.quarter !== 'Q2') return false; }
      else if (part === 'H2') { if (r.quarter !== 'Q3' && r.quarter !== 'Q4') return false; }
      else if (/^Q[1-4]$/.test(part)) { if (r.quarter !== part) return false; }
      else if (part.indexOf('M:') === 0) { if (r.month !== part.slice(2)) return false; }
    }
    if (sector !== 'all' && sectorOf(r.client_group) !== sector) return false;
    return true;
  });
}
const sum = (rows) => r2(rows.reduce((a, r) => a + r.revenue_sar, 0));
/* what finPeriodLabel() should read, per the app's own rule in js/16 */
const wantLabel = (year, part) => (String(year) === 'all' ? 'All years' : String(year)) + ' · ' +
  (part === 'all' ? 'Full period' : (part.indexOf('M:') === 0 ? part.slice(2) : part));

async function main() {
  console.log('fixture: ' + SEED.length + ' invoices · 2025 has Jan-Jun only, 2026 has all twelve months · 2 clients (1 tender, 1 B2B)');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1200 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate((cs) => { DB.businesses = DB.businesses || []; cs.forEach(c => DB.businesses.push({ id: c.biz, name: c.group, isClient: true, paymentTerms: 'Net 30' })); }, CLIENTS);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length && FIN.profileTypeByBiz)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.tab = 'overview'; render(); });
  await p.waitForTimeout(1200);

  /* Everything below reads or operates the RENDERED bar. Nothing calls finPY/finPP/finPS. */
  const readBar = () => p.evaluate(() => {
    const btns = [...document.querySelectorAll('#view button')];
    const oc = (b) => b.getAttribute('onclick') || '';
    const partBtns = btns.filter(b => /finPP\(/.test(oc(b))).map(b => ({ val: (oc(b).match(/finPP\('([^']*)'\)/) || [])[1], label: b.textContent.trim(), active: /\bpri\b/.test(b.className) }));
    const sectBtns = btns.filter(b => /finPS\(/.test(oc(b))).map(b => ({ val: (oc(b).match(/finPS\('([^']*)'\)/) || [])[1], label: b.textContent.trim(), active: /\bpri\b/.test(b.className) }));
    const sels = [...document.querySelectorAll('#view select')].filter(s => /finPY|finPP/.test(s.getAttribute('onchange') || ''));
    const yearSel = sels.find(s => /finPY/.test(s.getAttribute('onchange') || ''));
    const monthSel = sels.find(s => /finPP/.test(s.getAttribute('onchange') || ''));
    const labelEl = [...document.querySelectorAll('#view span b')].pop();
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod);
    return {
      state: { year: String(FIN.p.year), part: String(FIN.p.part), sector: String(FIN.p.sector || 'all') },
      partBtns, sectBtns,
      yearValue: yearSel ? yearSel.value : null,
      yearOptions: yearSel ? [...yearSel.options].map(o => o.value) : [],
      monthValue: monthSel ? monthSel.value : null,
      monthOptions: monthSel ? [...monthSel.options].map(o => o.value) : [],
      label: labelEl ? labelEl.textContent.trim() : null,
      n: rows.length, rev: Math.round(rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100
    };
  });
  const clickPart = async (val) => { await p.evaluate((v) => { const b = [...document.querySelectorAll('#view button')].find(x => (x.getAttribute('onclick') || '') === "finPP('" + v + "')"); if (!b) throw new Error('no period chip for ' + v); b.click(); }, val); await p.waitForTimeout(700); };
  const clickSector = async (val) => { await p.evaluate((v) => { const b = [...document.querySelectorAll('#view button')].find(x => (x.getAttribute('onclick') || '') === "finPS('" + v + "')"); if (!b) throw new Error('no sector chip for ' + v); b.click(); }, val); await p.waitForTimeout(700); };
  const pickSelect = async (which, val) => {
    await p.evaluate(([w, v]) => {
      const sels = [...document.querySelectorAll('#view select')].filter(s => /finPY|finPP/.test(s.getAttribute('onchange') || ''));
      const s = sels.find(x => (w === 'year' ? /finPY/ : /finPP/).test(x.getAttribute('onchange') || ''));
      if (!s) throw new Error('no ' + w + ' select');
      if (![...s.options].some(o => o.value === v)) throw new Error(w + ' select has no option ' + v + ' (has: ' + [...s.options].map(o => o.value).join(',') + ')');
      s.value = v; s.dispatchEvent(new Event('change', { bubbles: true }));
    }, [which, val]); await p.waitForTimeout(700);
  };
  /* one assertion used after every control: state, label, controls and rows all agree */
  const agree = (bar, year, part, sector, what) => {
    const w = want(year, part, sector);
    const problems = [];
    if (bar.state.year !== String(year)) problems.push(`state.year=${bar.state.year} not ${year}`);
    if (bar.state.part !== part) problems.push(`state.part=${bar.state.part} not ${part}`);
    if (bar.state.sector !== sector) problems.push(`state.sector=${bar.state.sector} not ${sector}`);
    if (bar.label !== wantLabel(year, part)) problems.push(`label "${bar.label}" not "${wantLabel(year, part)}"`);
    const activeParts = bar.partBtns.filter(x => x.active).map(x => x.val);
    const expectChip = /^M:/.test(part) ? [] : [part];
    if (JSON.stringify(activeParts) !== JSON.stringify(expectChip)) problems.push(`highlighted period chips ${JSON.stringify(activeParts)} not ${JSON.stringify(expectChip)}`);
    const activeSect = bar.sectBtns.filter(x => x.active).map(x => x.val);
    if (JSON.stringify(activeSect) !== JSON.stringify([sector])) problems.push(`highlighted sector chips ${JSON.stringify(activeSect)} not ${JSON.stringify([sector])}`);
    if (bar.yearValue !== String(year)) problems.push(`the year select reads "${bar.yearValue}" while the filter is ${year}`);
    const wantMonthValue = /^M:/.test(part) ? part : 'all';
    if (bar.monthValue !== wantMonthValue) problems.push(`the month select reads "${bar.monthValue}" while the filter is "${part}"`);
    if (bar.n !== w.length || Math.abs(bar.rev - sum(w)) > 0.02) problems.push(`${bar.n} rows / ${bar.rev} in scope, an independent recount gives ${w.length} / ${sum(w)}`);
    if (!problems.length) { ok(`${what}: state, label ("${bar.label}"), every control and ${w.length} rows all agree`); return true; }
    fail(`${what}: ` + problems.join(' · ')); return false;
  };

  /* ---------- 1. the seven period chips, each clicked for real ---------- */
  await pickSelect('year', '2026');
  let bad = 0;
  for (const part of ['all', 'Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2']) {
    await clickPart(part);
    if (!agree(await readBar(), 2026, part, 'all', `clicking the "${part}" chip`)) bad++;
  }
  if (!bad) ok('all seven period chips set their own part and nothing else — no chip is wired to a neighbour\'s value');

  /* ---------- 2. every month the dropdown offers ---------- */
  const barNow = await readBar();
  const monthOpts = barNow.monthOptions.filter(v => v !== 'all');
  note(`the month dropdown offers ${monthOpts.length} months: ${monthOpts.map(m => m.slice(2)).join(', ')}`);
  let badM = 0;
  for (const m of monthOpts) {
    await pickSelect('month', m);
    if (!agree(await readBar(), 2026, m, 'all', `choosing ${m.slice(2)} in the month dropdown`)) badM++;
  }
  if (!badM && monthOpts.length === 12) ok(`all ${monthOpts.length} months scope correctly and each is named by the label`);
  else if (!badM) ok(`all ${monthOpts.length} months offered scope correctly`);

  /* ---------- 3. every year, and the sector chips ---------- */
  await pickSelect('month', 'all');
  let badY = 0;
  for (const y of (await readBar()).yearOptions) {
    await pickSelect('year', y);
    if (!agree(await readBar(), y === 'all' ? 'all' : +y, 'all', 'all', `choosing "${y}" in the year dropdown`)) badY++;
  }
  if (!badY) ok('every year the dropdown offers, and "All years", scope correctly');
  await pickSelect('year', '2026');
  let badS = 0;
  for (const s of ['tenders', 'b2b', 'academies', 'all']) {
    await clickSector(s);
    if (!agree(await readBar(), 2026, 'all', s, `clicking the "${s}" sector chip`)) badS++;
  }
  if (!badS) ok('every sector chip highlights itself alone and scopes correctly');

  /* ---------- 4. the cross-control case: a month that the new year does not have ---------- */
  await pickSelect('year', '2026');
  await pickSelect('month', 'M:November');
  const beforeSwitch = await readBar();
  if (beforeSwitch.state.part === 'M:November') ok('control: November is selectable while 2026 is the year, so the switch below really does move to a year without it');
  else fail('control: could not select November under 2026 — the case below is not reached');
  await pickSelect('year', '2025');
  const afterSwitch = await readBar();
  const w4 = want(2025, afterSwitch.state.part, 'all');
  note(`after switching to 2025 with November chosen: state=${JSON.stringify(afterSwitch.state)} · month select reads "${afterSwitch.monthValue}" · label "${afterSwitch.label}" · ${afterSwitch.n} rows in scope · the dropdown now offers ${afterSwitch.monthOptions.filter(v => v !== 'all').length} months`);
  const stillNovember = afterSwitch.state.part === 'M:November';
  const selectSaysAll = afterSwitch.monthValue === 'all';
  if (stillNovember && selectSaysAll)
    fail(`the month dropdown reads "All months" while the filter is still M:November — 2025 has no November, so the option vanished from the list and the browser fell back to the first option. The label ("${afterSwitch.label}") and the rows (${afterSwitch.n}) still follow November, so the one control a person would look at to see the filter is the only thing on the bar that disagrees with it`);
  else if (!stillNovember && selectSaysAll) ok(`switching to a year without November cleared the month rather than leaving a filter no control can show — state ${JSON.stringify(afterSwitch.state)}, dropdown "all", label "${afterSwitch.label}", all three agree`);
  else if (stillNovember && afterSwitch.monthValue === 'M:November') ok('the month dropdown still shows November even though 2025 has none — the control and the filter agree, which is what matters');
  else fail(`unexpected combination: state.part=${afterSwitch.state.part}, month select="${afterSwitch.monthValue}"`);
  if (afterSwitch.n === w4.length && Math.abs(afterSwitch.rev - sum(w4)) < 0.02) ok(`whatever the controls show, the rows in scope (${afterSwitch.n}) match an independent recount of the state actually in force`);
  else fail(`the rows in scope (${afterSwitch.n} / ${afterSwitch.rev}) do not match a recount of the state in force (${w4.length} / ${sum(w4)})`);

  if (!errors.length) ok('no page error across every control on the bar'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures ? 'FAILED - ' + failures + ' check(s)' : 'ALL PASS'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
