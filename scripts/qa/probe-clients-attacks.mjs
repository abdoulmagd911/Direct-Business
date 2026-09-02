/* probe-clients-attacks.mjs (2026-09-02, watch cycle 6) — adversarial pass over Finance →
   Clients & collections (rFinClients in js/16). Rules under test:
     1. "Top clients by revenue": every row's revenue/cost/profit equals an independent sum over
        the verified-paid rows in period that resolve to that client; the Total row equals the
        sum over ALL clients, and when more than 10 clients exist the table says so (a "Total"
        that is larger than the 10 rows above it must be labelled, never left to be misread).
     2. Name folding without double counting: an M14 alias group folds its aliases into ONE row
        whose revenue is the sum of both raw names; a finance_client_links pair folds two raw
        spellings into the linked company's row; the grand total is unchanged either way.
     3. Collections & ageing recomputed independently: Outstanding, % overdue (by
        collection_due_date), the four ageing buckets by invoice_date — and money with NO
        invoice date is never aged as "0–30 days" (an invented age): it is shown apart.
     4. Drill-down honesty: clicking a linked client opens the Ledger filtered to that company;
        clicking an unlinked (raw) client must not silently open the WHOLE ledger — the Ledger
        says which client was asked for and that no company filter applies.
     5. Hostile rows: null client_group → "—" row, HTML in a name escaped, an excluded partner
        never appears, a credit-note-only group never enters the verified table, "Lifetime billed"
        wording never appears (21 Aug ruling), no NaN anywhere.
   Run:  node scripts/qa/probe-clients-attacks.mjs     (port 8197)
   Sabotage: in js/16 rFinClients, put date-less outstanding back into ag.b030 → check 3 red;
   drop the >10 label → check 1 red; drop the Ledger drill banner → check 4 red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8197; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.5;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.accept(); });
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
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };
  const view = () => p.evaluate(() => document.querySelector('#view').innerHTML);
  const text = () => p.evaluate(() => document.querySelector('#view').innerText);
  const goClients = async () => { await p.evaluate(() => { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; render(); if (window.finGo) finGo('clients'); }); await settle(); };
  await goClients();
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await goClients();
  // rows of the "Top clients" table: [name, revenue, cost, profit] numbers parsed from cells
  const tableRows = () => p.evaluate(() => {
    const t = [...document.querySelectorAll('#view table')].find(t => /Client/.test(t.rows[0].textContent) && /Revenue/.test(t.rows[0].textContent));
    if (!t) return null; const n = (s) => +String(s).replace(/[^\d.-]/g, '');
    return [...t.rows].slice(1).map(r => ({ name: r.cells[0].textContent.trim().replace(/\s*#\d+$/, ''), rev: n(r.cells[1].textContent), cost: n(r.cells[2].textContent), prof: n(r.cells[3].textContent), raw: r.cells[0].innerHTML, isTotal: /^Total/.test(r.cells[0].textContent.trim()) }));
  });
  // independent recount: verified-paid live rows in period, resolved through finCanon (the page's own resolver, but
  // summed here by us) — and a raw sum by client_group that ignores every alias/link, to prove folding does not double count
  const recount = () => p.evaluate(() => {
    const ex = window.finExclusionCheck || (() => null);
    const rows = (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)) && r.integrity_status === 'verified_paid');
    const by = {}; let grand = { rev: 0, cost: 0, prof: 0 };
    rows.forEach(r => { const c = window.finCanon(r.client_group); const k = c.name; by[k] = by[k] || { rev: 0, cost: 0, prof: 0, key: c.key }; by[k].rev += +r.revenue_sar || 0; by[k].cost += +r.cost_sar || 0; by[k].prof += +r.profit_sar || 0; grand.rev += +r.revenue_sar || 0; grand.cost += +r.cost_sar || 0; grand.prof += +r.profit_sar || 0; });
    return { by, grand, nClients: Object.keys(by).length };
  });

  /* ---------- 1. baseline: rows == independent sums, seed link fold (Test Company 4 + 5 → b4) ---------- */
  let rows = await tableRows(); let rc = await recount();
  if (!rows) { fail('Top clients table not found'); }
  else {
    const body = rows.filter(r => !r.isTotal), total = rows.find(r => r.isTotal);
    const bad = body.filter(r => !rc.by[r.name] || !near(rc.by[r.name].rev, r.rev) || !near(rc.by[r.name].cost, r.cost) || !near(rc.by[r.name].prof, r.prof));
    if (!bad.length && body.length) ok(`every one of ${body.length} client rows equals an independent sum of its verified-paid invoices (revenue, cost, profit)`); else fail('client rows disagree with recount: ' + JSON.stringify(bad.map(r => r.name)));
    if (total && near(total.rev, rc.grand.rev) && near(total.cost, rc.grand.cost) && near(total.prof, rc.grand.prof)) ok(`Total row = grand total over all ${rc.nClients} clients`); else fail('Total row mismatch: ' + JSON.stringify(total) + ' vs ' + JSON.stringify(rc.grand));
    if (!body.some(r => /^Test Company 5$/.test(r.name)) && body.some(r => r.name === 'Test Company 4')) ok('seed link: "Test Company 5" (a second spelling linked to the same company) is folded into "Test Company 4" — one row, not two'); else fail('link fold missing: rows ' + body.map(r => r.name).join(' | '));
    const rawSum = await p.evaluate(() => { const ex = window.finExclusionCheck || (() => null); let s = 0; (FIN.rows || []).filter(r => !r.deleted_at && !(ex(r.client_group) || ex(r.customer_raw_name)) && r.integrity_status === 'verified_paid' && (r.client_group === 'Test Company 4' || r.client_group === 'Test Company 5')).forEach(r => s += +r.revenue_sar || 0); return s; });
    const folded = body.find(r => r.name === 'Test Company 4');
    if (folded && near(folded.rev, rawSum)) ok(`folded row revenue ${folded.rev} = raw sum of both spellings ${rawSum} (no double count, nothing dropped)`); else fail(`folded row ${folded && folded.rev} vs raw ${rawSum}`);
  }

  /* ---------- 2. inject: alias group, hostile rows, >10 clients, unpaid rows for ageing ---------- */
  await p.evaluate(({ d10, d45, d100, due5ago, dueFuture }) => {
    const base = { record_type: 'b2b', wallet_portion_sar: 0, vat_sar: 0, deleted_at: null, year: 2026, quarter: 'Q2', month: 'May', invoice_date: '2026-05-10', service_type: 'Flights', products: 'Flights', amount_received_sar: 0, amount_remaining_sar: 0, collection_due_date: null };
    const paid = (id, group, rev, cost) => Object.assign({}, base, { id, invoice_no: id, client_group: group, customer_raw_name: group, integrity_status: 'verified_paid', total_incl_vat_sar: rev, revenue_sar: rev, cost_sar: cost, profit_sar: rev - cost, amount_received_sar: rev });
    // alias group: two raw names → one canonical
    DB.settings = DB.settings || {}; DB.settings.financeGroupMap = DB.settings.financeGroupMap || [];
    DB.settings.financeGroupMap.push({ id: 'fg-qa', canonicalName: 'Grouped Holding', aliases: ['Alias Co', 'شركة الاسم البديل'], active: true, addedBy: 'probe', addedAt: new Date().toISOString() });
    FIN.rows.push(paid('QA-AL-1', 'Alias Co', 3000, 1000), paid('QA-AL-2', 'شركة الاسم البديل', 2000, 500));
    // hostile
    FIN.rows.push(paid('QA-NULL-1', null, 400, 100));
    FIN.rows.push(paid('QA-HTML-1', '<img id="qa-xss" src=x onerror="window.__xss=1">', 350, 50));
    FIN.rows.push(paid('QA-EXCL-1', 'Takamol for Business Services', 9999, 0));
    FIN.rows.push(Object.assign(paid('QA-CN-1', 'Credit Only Co', -600, 0), { integrity_status: 'credit_note', amount_received_sar: 0 }));
    // eight more small clients so there are > 10
    for (let i = 1; i <= 8; i++) FIN.rows.push(paid('QA-SM-' + i, 'Small Client ' + i, 100 + i, 10));
    // unpaid rows for ageing: pending (imported as not fully paid)
    const unpaid = (id, group, remaining, date, due) => Object.assign({}, base, { id, invoice_no: id, client_group: group, customer_raw_name: group, integrity_status: 'pending', total_incl_vat_sar: remaining, revenue_sar: remaining, cost_sar: 0, profit_sar: remaining, amount_received_sar: 0, amount_remaining_sar: remaining, invoice_date: date, collection_due_date: due, month: date ? 'May' : null, quarter: date ? 'Q2' : null, year: date ? 2026 : null });
    FIN.rows.push(unpaid('QA-UN-1', 'Test Company 1', 1000, d10, dueFuture));
    FIN.rows.push(unpaid('QA-UN-2', 'Test Company 2', 2000, d45, due5ago));
    FIN.rows.push(unpaid('QA-UN-3', 'Test Company 3', 500, d100, null));
    FIN.rows.push(unpaid('QA-UN-4', 'Test Company 1', 700, null, null));
    if (window.clearFinCanon) clearFinCanon();
  }, { d10: daysAgo(10), d45: daysAgo(45), d100: daysAgo(100), due5ago: daysAgo(5), dueFuture: daysAgo(-20) });
  await goClients();
  let v = await view(); let t = await text();
  rows = await tableRows(); rc = await recount();
  const body = rows.filter(r => !r.isTotal), total = rows.find(r => r.isTotal);
  if (v.indexOf('NaN') < 0) ok('no "NaN" anywhere on the tab under hostile rows'); else fail('NaN rendered');
  if (!(await p.evaluate(() => !!document.querySelector('#qa-xss') || window.__xss === 1))) ok('HTML in a client name is escaped, not rendered'); else fail('HTML client name executed/rendered');
  const g = body.find(r => r.name === 'Grouped Holding');
  if (g && near(g.rev, 5000) && near(g.cost, 1500) && near(g.prof, 3500) && !body.some(r => /Alias Co|الاسم البديل/.test(r.name))) ok('M14 alias group: "Alias Co" + its Arabic spelling → ONE row "Grouped Holding" = 5,000 / 1,500 / 3,500; neither raw name appears'); else fail('alias fold wrong: ' + JSON.stringify(g) + ' rows ' + body.map(r => r.name).join(' | '));
  if (body.length === 10 && rc.nClients > 10) ok(`table shows 10 rows while ${rc.nClients} clients exist`); else fail(`rows ${body.length}, clients ${rc.nClients}`);
  const shownSum = body.reduce((a, r) => a + r.rev, 0);
  if (total && near(total.rev, rc.grand.rev) && total.rev > shownSum + 1) ok(`Total row ${total.rev} = all ${rc.nClients} clients, larger than the 10 rows shown (${shownSum})`); else fail('Total row vs recount: ' + JSON.stringify(total) + ' grand ' + JSON.stringify(rc.grand));
  if (total && new RegExp('all\\s+' + rc.nClients + '\\s+clients', 'i').test(total.raw) && /top 10/i.test(total.raw)) ok('…and the Total row SAYS it covers all clients, top 10 shown — the mismatch is labelled'); else fail('Total row unlabelled when it exceeds the visible rows: ' + JSON.stringify(total && total.raw));
  if (!body.some(r => r.name === 'Takamol for Business Services') && !/9,999/.test(t)) ok('excluded partner never appears on the Clients tab'); else fail('excluded partner leaked into Clients');
  if (!body.some(r => r.name === 'Credit Only Co')) ok('a credit-note-only group is not in the verified table'); else fail('credit-note group in verified table');
  if (!/Lifetime billed|إجمالي الفوترة/i.test(t)) ok('no "Lifetime billed" wording anywhere (21 Aug ruling)'); else fail('"Lifetime billed" present');
  if (/Paid invoices only/.test(t)) ok('period bar says "Paid invoices only"'); else fail('"Paid invoices only" note missing');
  const nullRow = await p.evaluate(() => { const ex = window.finExclusionCheck || (() => null); return (FIN.rows || []).some(r => r.invoice_no === 'QA-NULL-1'); });
  if (nullRow && near(rc.by['—'] ? rc.by['—'].rev : -1, 400)) ok('a null client_group resolves to the "—" client with its own money, not merged into another client'); else fail('null client_group handling: ' + JSON.stringify(rc.by['—']));

  /* ---------- 3. collections & ageing ---------- */
  const exp = { out: 1000 + 2000 + 500 + 700, over: 2000, b030: 1000, b3160: 2000, b6190: 0, b90: 500, nodate: 700 };
  const pct = Math.round(exp.over / exp.out * 100);
  const strip = await p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find(e => /Collections & ageing/.test(e.textContent)); return c ? c.innerText : ''; });
  const num = (lbl) => { const m = strip.match(new RegExp(lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n?\\s*([\\d.,]+K?)')); if (!m) return null; const s = m[1]; return /K$/.test(s) ? Math.round(parseFloat(s) * 1000) : +s.replace(/,/g, ''); };
  const outShown = num('Outstanding');
  if (outShown !== null && Math.abs(outShown - exp.out) <= 50) ok(`Outstanding ${outShown} ≈ ${exp.out} = sum of amount_remaining over live rows (recomputed)`); else fail(`Outstanding shown ${outShown}, expected ${exp.out}`);
  if (new RegExp('% overdue\\s*\\n?\\s*' + pct + '%').test(strip)) ok(`% overdue = ${pct}% — only the row past its collection_due_date counts as overdue`); else fail('% overdue wrong: ' + JSON.stringify(strip.slice(0, 300)));
  const bk = { b030: num('0–30 days'), b3160: num('31–60 days'), b6190: num('61–90 days'), b90: num('90+ days') };
  if (bk.b3160 !== null && Math.abs(bk.b3160 - 2000) <= 50 && bk.b6190 === 0 && Math.abs(bk.b90 - 500) <= 50) ok('ageing buckets 31–60 / 61–90 / 90+ recomputed from invoice_date: 2,000 / 0 / 500'); else fail('ageing buckets: ' + JSON.stringify(bk));
  if (bk.b030 !== null && Math.abs(bk.b030 - 1000) <= 50) ok('0–30 days = 1,000 — money with NO invoice date is not aged as "recent"'); else fail(`0–30 days = ${bk.b030}: date-less outstanding money is being aged as 0–30 (invented age)`);
  const nd = num('No invoice date');
  if (nd !== null && Math.abs(nd - 700) <= 50) ok('date-less outstanding money (700) is shown apart as "No invoice date"'); else fail('date-less outstanding money not shown apart: ' + JSON.stringify(strip.slice(0, 400)));

  /* ---------- 4. drill-down ---------- */
  await p.evaluate(() => finClient('biz:b4', 'Test Company 4')); await settle();
  let st = await p.evaluate(() => ({ tab: FIN.tab, biz: TXN.f.business }));
  if (st.tab === 'ledger' && st.biz === 'b4') ok('linked client → Ledger filtered to that company'); else fail('linked drill-down: ' + JSON.stringify(st));
  await goClients();
  await p.evaluate(() => finClient('raw:Small Client 3', 'Small Client 3')); await settle();
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.profiles)); i++) await p.waitForTimeout(250);
  await settle();
  st = await p.evaluate(() => ({ tab: FIN.tab, biz: TXN.f.business, key: FIN.f.clientKey }));
  t = await text();
  if (st.tab === 'ledger' && st.biz === 'all') ok('unlinked client → Ledger (no company to filter by)'); else fail('raw drill-down state: ' + JSON.stringify(st));
  if (/Small Client 3/.test(t) && /not (yet )?linked|no linked company|all companies/i.test(t)) ok('…and the Ledger SAYS it was asked for "Small Client 3" and is showing all companies because none is linked — never a silent full ledger'); else fail('Ledger opened from an unlinked client with no explanation on screen');
  await p.evaluate(() => finTxnF('business', 'b4')); await settle(); t = await text();
  if (!/Small Client 3/.test(t)) ok('choosing a company in the Ledger clears the stale drill-down note'); else fail('stale drill-down note stays after choosing a company');

  if (errors.length) fail(errors.length + ' page error(s): ' + JSON.stringify(errors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
