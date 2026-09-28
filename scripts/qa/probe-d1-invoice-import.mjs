/* probe-d1-invoice-import.mjs (2026-09-28) — D1, the Payments invoice export through the real importer (js/41 + js/65) into
   the stand-in, which models scripts/sql/d1-money-model.sql (DECISIONS D21). Made-up companies and numbers only (rule 7).

   What it holds:
     1. revenue is the invoice total; a sale PAID from the wallet is a full sale; a "Wallet Balance" line inside a sale is the
        only part taken off (1,890 → 1,888); a top-up-only invoice is STORED, never counted;
     2. cost is never read from the item lines — every imported row's cost is empty, so Performance says it is waiting for
        its cost and leaves it out of profit (no 100% profit); the lines themselves are kept, once, however often the file
        comes in;
     3. Payments' statuses: Fully Paid counts; "Fully Paid (Audit Required)" counts and is flagged; Pending Payment, Void,
        Cancelled and Draft are stored and never count; a status nobody has named is held back and named in the preview;
     4. no VAT figure is written (D18);
     5. a billing invoice whose total is exactly two earlier transactions of the same customer is PROPOSED in the preview,
        nothing is linked until a person ticks it; ticked, the invoice is a link (zero revenue) and both transactions carry it;
     6. the item-name list moves "pass-through on the invoice" and never cost or profit;
     7. FILL, NEVER WIPE, IN ANY ORDER: the same two files imported A→B and B→A end identical (a later status wins, an
        earlier one cannot roll it back, a blank never erases); the same file twice changes nothing and writes no second line;
     8. a row entered by hand is left as it is when an import brings the same number, and the preview says so;
     9. Performance: "Needs attention" names what waits, is flagged, or is held apart; the Month-by switch is there;
    10. no JS error, no native dialog.
   Sabotage (both run 28 Sep): make js/41 toRows set cost_sar from the untaxed item lines again → 4 checks red (2, 6, 9);
   let an older Payments status overwrite a newer one in the commit (the stand-in's mirror of fn_commit_finance_import) →
   2 checks red (7). The database side of "fill, never wipe" is held by scripts/qa/phase3 D1-03.
   PORTS 9721 … 9724. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0, seq = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* ---------- the made-up export ---------- */
const HDR = ['Type', 'Invoice Reference #', 'Invoice Number', 'Customer Name', 'Customer Email', 'Invoice Create Date', 'Invoice Generate Date',
  'Last Payment Date', 'Invoice Status', 'Last Status At', 'Invoice Total', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Sale Branch', 'Salesman'];
const q = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function inv(ref, o) {
  const rows = [['invoice', ref, o.dpin || '', o.cust, o.email || '', o.created, o.gen || '', o.paid || '', o.status, o.statusAt || (o.created + ' 10:00:00 AM'), o.total, '', '', '', '', '', 'Riyadh', 'QA Seller']];
  (o.items || []).forEach((it) => rows.push(['item', ref, '', '', '', '', '', '', '', '', '', it.product || 'Direct Flights', it.name, it.tax ? 'Yes' : 'No', 0, it.total, '', '']));
  return rows;
}
const csv = (rows) => [HDR].concat(rows).map((r) => r.map(q).join(',')).join('\n');
const A = inv('QA-D1-A', { cust: 'QA Paper Co', email: 'ap@qa-paper.example', created: '10/03/2026 09:00:00 AM', gen: '10/03/2026', paid: '12/03/2026', status: 'Fully Paid', total: 1000,
  items: [{ name: 'Flight Booking - Flight Booking', total: 900 }, { name: 'Flight Booking - Service Fees', total: 100, tax: true }] });
const B = inv('QA-D1-B', { cust: 'QA Paper Co', created: '11/03/2026 09:00:00 AM', paid: '11/03/2026', status: 'Fully Paid (Audit Required)', total: 500, items: [{ name: 'Hotel Booking - 3rd Party Fee', total: 450 }, { name: 'Hotel Booking - Service Fee', total: 50, tax: true }] });
const C = inv('QA-D1-C', { cust: 'QA Wallet Co', created: '12/03/2026 09:00:00 AM', paid: '12/03/2026', status: 'Fully Paid', total: 5000, items: [{ product: 'Direct Wallet', name: 'Wallet Balance | رصيد المحفظة', total: 5000 }] });
const D = inv('QA-D1-D', { cust: 'QA Visa Co', created: '13/03/2026 09:00:00 AM', paid: '13/03/2026', status: 'Fully Paid', total: 1890,
  items: [{ product: 'Direct Visa', name: 'Visa - Embassy Fee', total: 1888 }, { product: 'Direct Wallet', name: 'Wallet Balance | رصيد المحفظة', total: 2 }] });
const E0 = inv('QA-D1-E', { cust: 'QA Pending Co', created: '14/03/2026 09:00:00 AM', status: 'Pending Payment', statusAt: '14/03/2026 10:00:00 AM', total: 700, items: [{ name: 'Flight Booking - Flight Booking', total: 700 }] });
const E1 = inv('QA-D1-E', { cust: 'QA Pending Co', created: '14/03/2026 09:00:00 AM', paid: '20/03/2026', status: 'Fully Paid', statusAt: '20/03/2026 10:00:00 AM', total: 700, items: [{ name: 'Flight Booking - Flight Booking', total: 700 }] });
const F = inv('QA-D1-F', { cust: 'QA Pending Co', created: '15/03/2026 09:00:00 AM', status: 'Void', total: 300 });
const G = inv('QA-D1-G', { cust: 'QA Pending Co', created: '15/03/2026 09:00:00 AM', status: 'Cancelled', total: 200 });
const H = inv('QA-D1-H', { cust: 'QA Pending Co', created: '15/03/2026 09:00:00 AM', status: 'Draft', total: 100 });
const I = inv('QA-D1-I', { cust: 'QA Pending Co', created: '15/03/2026 09:00:00 AM', status: 'On Hold', total: 999 });
const T1 = inv('QA-D1-T1', { cust: 'QA Billing Co', created: '01/03/2026 09:00:00 AM', paid: '02/03/2026', status: 'Fully Paid', total: 600, items: [{ name: 'Flight Booking - Flight Booking', total: 600 }] });
const T2 = inv('QA-D1-T2', { cust: 'QA Billing Co', created: '03/03/2026 09:00:00 AM', paid: '04/03/2026', status: 'Fully Paid', total: 400, items: [{ name: 'Flight Booking - Flight Booking', total: 400 }] });
const X = inv('QA-D1-X', { dpin: 'DPIN-QA-9', cust: 'QA Billing Co', created: '25/03/2026 09:00:00 AM', gen: '25/03/2026', paid: '26/03/2026', status: 'Fully Paid', total: 1000, items: [{ name: 'Billing - Service Fee', total: 1000, tax: true }] });
const FILE_1 = csv([].concat(A, B, C, D, E0, F, G, H, I, T1, T2));
const FILE_2 = csv([].concat(E1, X));

async function session(PORT, lang) {
  process.env.MOCK_ROLE = 'admin'; process.env.MOCK_KPI_FROM_MONEY = '1';
  const { start } = await import('./mock-supabase.mjs?run=' + (++seq) + '-' + PORT); const srv = start(PORT, { finance_invoices: [] }); const BASE = 'http://localhost:' + PORT;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errors = [], natives = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang || 'en');
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  const ready = await p.waitForFunction(() => window.__roleKnown === true && window.FIN && FIN.rows && FIN.m && typeof window.v65IngestText === 'function', null, { timeout: 150000 }).then(() => true).catch(() => false);
  if (!ready) { console.log('NOT READY', await p.evaluate(() => JSON.stringify({ role: window.__roleKnown, fin: !!window.FIN, rows: !!(window.FIN && FIN.rows), m: !!(window.FIN && FIN.m), mErr: window.FIN && FIN.mErr, loadErr: window.FIN && FIN.loadErr, ingest: typeof window.v65IngestText, cur: typeof current !== 'undefined' ? current : '?' })), errors.slice(0, 3)); throw new Error('not ready'); }
  await p.evaluate(() => { current = 'finance'; finGo('import'); }); await p.waitForTimeout(900);
  return { p, b, srv, BASE, errors, natives };
}
const done = async (s) => { await s.b.close(); try { s.srv.close(); } catch (_) { } };
const rows = async (s) => (await fetch(s.BASE + '/rest/v1/finance_invoices?select=*').then((r) => r.json())).filter((r) => /^QA-D1-/.test(r.invoice_no)).sort((a, b) => a.invoice_no.localeCompare(b.invoice_no));
async function ingest(s, name, text, tickAll) {
  await s.p.evaluate(({ n, t }) => window.v65IngestText(n, t), { n: name, t: text });
  await s.p.waitForFunction(() => { const o = document.getElementById('finImpOut'); return o && /Confirm import|تأكيد الاستيراد|Nothing new|no rows/i.test(o.innerText); }, null, { timeout: 60000 }).catch(() => {});
  await s.p.waitForTimeout(600);
  const pv = await s.p.evaluate(() => { const o = document.getElementById('finImpOut'); const card = o && o.querySelector('[data-v65-billing]');
    return { text: o ? o.innerText : '', d1: o && o.querySelector('[data-v65-d1]') ? o.querySelector('[data-v65-d1]').innerText : '', proposals: card ? +card.getAttribute('data-v65-billing') : 0,
      ticked: [...document.querySelectorAll('[data-v65-bl]')].filter((x) => x.checked).length }; });
  if (tickAll) await s.p.evaluate(() => window.v65BlTickAll(true));
  const hasBtn = await s.p.evaluate(() => typeof window.v65Commit === 'function' && /Confirm import|تأكيد الاستيراد/.test((document.getElementById('finImpOut') || {}).innerText || ''));
  if (hasBtn) { await s.p.evaluate(() => window.v65Commit()); await s.p.waitForFunction(() => /Done\.|تم\.|FAILED|فشل/.test((document.getElementById('finImpOut') || {}).innerText || ''), null, { timeout: 60000 }).catch(() => {}); }
  await s.p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }).catch(() => {}); await s.p.waitForTimeout(700);
  return Object.assign(pv, { done: await s.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || ''), committed: hasBtn });
}
const shape = (list) => list.map((r) => [r.invoice_no, r.row_kind, r.integrity_status, r.payments_status, String(r.revenue_sar), r.cost_sar == null ? '∅' : r.cost_sar, r.billed_by_ref || '', r.paid_at || '', r.audit_required ? 'A' : ''].join('|')).join('\n');

(async () => {
  /* ---- A → B, with the billing link ticked ---- */
  console.log('\nFile 1 then file 2 (billing link ticked)');
  let s = await session(9721, 'en');
  const pv1 = await ingest(s, 'qa-d1-part1.csv', FILE_1, false);
  check(/Wallet top-ups.*1/.test(pv1.d1) && /Not paid yet/.test(pv1.d1) && /Pending Payment/.test(pv1.d1) && /Void/.test(pv1.d1) && /Cancelled/.test(pv1.d1) && /Draft/.test(pv1.d1),
    '3. the preview names top-ups and every unpaid status, stored and not counted', pv1.d1.replace(/\n/g, ' | '));
  check(/Audit Required.*1/.test(pv1.d1), '3. the preview counts "Fully Paid (Audit Required)" as counted and flagged', pv1.d1.replace(/\n/g, ' | '));
  check(/Held back/.test(pv1.d1) && /QA-D1-I/.test(pv1.d1) && /On Hold/.test(pv1.d1), '3. a status nobody has named is held back and named', pv1.d1.replace(/\n/g, ' | '));
  let R = await rows(s);
  const by = (n) => R.find((r) => r.invoice_no === n) || {};
  check(by('QA-D1-A').revenue_sar === 1000 && by('QA-D1-A').integrity_status === 'verified_paid' && by('QA-D1-A').paid_at === '2026-03-12' && by('QA-D1-A').invoice_date === '2026-03-12' && by('QA-D1-A').invoice_created_on === '2026-03-10',
    '1. a paid sale: revenue = its total; the month is its paid date, the created date kept beside it', JSON.stringify(by('QA-D1-A')).slice(0, 300));
  check(by('QA-D1-D').revenue_sar === 1888 && by('QA-D1-D').wallet_portion_sar === 2 && by('QA-D1-D').row_kind === 'sale', '1. a "Wallet Balance" line inside a sale is the only part taken off: 1,890 → 1,888', JSON.stringify([by('QA-D1-D').revenue_sar, by('QA-D1-D').wallet_portion_sar]));
  check(by('QA-D1-C').row_kind === 'wallet_topup' && by('QA-D1-C').revenue_sar === 0, '1. a top-up-only invoice is stored, with zero revenue', JSON.stringify([by('QA-D1-C').row_kind, by('QA-D1-C').revenue_sar]));
  check(R.every((r) => r.cost_sar == null) && R.every((r) => r.profit_sar == null || r.revenue_way === 'commission'), '2. cost is never read from the item lines: every imported cost is empty, and so is its profit', JSON.stringify(R.map((r) => r.cost_sar)));
  check(R.every((r) => r.vat_sar == null), '4. no VAT figure is written', JSON.stringify(R.map((r) => r.vat_sar)));
  check(by('QA-D1-B').audit_required === true && by('QA-D1-B').integrity_status === 'verified_paid', '3. Audit Required: counted and flagged');
  check(['QA-D1-E', 'QA-D1-F', 'QA-D1-G', 'QA-D1-H'].every((n) => by(n).integrity_status === 'pending') && !by('QA-D1-I').invoice_no, '3. Pending / Void / Cancelled / Draft stored as not paid; the unknown status not written',
    JSON.stringify(['QA-D1-E', 'QA-D1-F', 'QA-D1-G', 'QA-D1-H', 'QA-D1-I'].map((n) => by(n).payments_status || '—')));
  const lines1 = await fetch(s.BASE + '/rest/v1/finance_invoice_lines?select=*').then((r) => r.json());
  // the same file again: nothing new, no second copy of any line
  const again = await ingest(s, 'qa-d1-part1-again.csv', FILE_1, false);
  const lines2 = await fetch(s.BASE + '/rest/v1/finance_invoice_lines?select=*').then((r) => r.json());
  const R1b = await rows(s);
  check(shape(R1b) === shape(R) && lines2.length === lines1.length && lines1.length > 0, '7. the same file twice changes nothing and keeps each line once', `rows same=${shape(R1b) === shape(R)} · lines ${lines1.length} → ${lines2.length}`);
  const pv2 = await ingest(s, 'qa-d1-part2.csv', FILE_2, false);
  check(pv2.proposals === 1 && pv2.ticked === 0 && /QA-D1-X/.test(pv2.text) && /QA-D1-T1/.test(pv2.text) && /QA-D1-T2/.test(pv2.text),
    '5. the billing invoice is PROPOSED (X = T1 + T2), nothing ticked by itself', JSON.stringify({ proposals: pv2.proposals, ticked: pv2.ticked }));
  R = await rows(s);
  check(by('QA-D1-X').row_kind === 'sale' && !by('QA-D1-T1').billed_by_ref, '5. unticked, nothing is linked (the invoice imports as a sale)', JSON.stringify([by('QA-D1-X').row_kind, by('QA-D1-T1').billed_by_ref]));
  check(by('QA-D1-E').integrity_status === 'verified_paid' && by('QA-D1-E').paid_at === '2026-03-20', '7. the later file\'s newer status wins (Pending → Fully Paid)', JSON.stringify([by('QA-D1-E').payments_status, by('QA-D1-E').paid_at]));
  await done(s);

  console.log('\nFile 2 then file 1, the billing link ticked');
  s = await session(9722, 'en');
  const pvx = await ingest(s, 'qa-d1-part2.csv', FILE_2, false);
  await ingest(s, 'qa-d1-part1.csv', FILE_1, true);
  const RB = await rows(s);
  const byB = (n) => RB.find((r) => r.invoice_no === n) || {};
  check(byB('QA-D1-E').integrity_status === 'verified_paid' && +byB('QA-D1-E').amount_received_sar === 700 && +byB('QA-D1-E').amount_remaining_sar === 0 && byB('QA-D1-E').invoice_date === '2026-03-20', '7. an EARLIER file arriving later cannot roll back the newer status — nor the amounts received and outstanding, nor the date that sets the month', JSON.stringify([byB('QA-D1-E').payments_status, byB('QA-D1-E').amount_received_sar, byB('QA-D1-E').amount_remaining_sar, byB('QA-D1-E').invoice_date]));
  check(byB('QA-D1-X').row_kind === 'billing_link' && byB('QA-D1-X').revenue_sar === 0 && byB('QA-D1-T1').billed_by_ref === 'QA-D1-X' && byB('QA-D1-T2').billed_by_ref === 'QA-D1-X',
    '5. ticked: the invoice is a link (zero revenue) and both transactions carry it', JSON.stringify([byB('QA-D1-X').row_kind, byB('QA-D1-X').revenue_sar, byB('QA-D1-T1').billed_by_ref, byB('QA-D1-T2').billed_by_ref]));
  const noLink = (list) => shape(list.map((r) => Object.assign({}, r, { row_kind: r.row_kind === 'billing_link' ? 'sale' : r.row_kind, revenue_sar: r.invoice_no === 'QA-D1-X' ? 1000 : r.revenue_sar, billed_by_ref: '' })));
  check(noLink(RB) === noLink(R), '7. A→B and B→A end identical (apart from the link a person ticked)', noLink(RB) === noLink(R) ? '' : '\n' + noLink(R) + '\n--- vs ---\n' + noLink(RB));

  /* 5b. re-dropping file 2 (which says "sale") keeps the link a person ticked, reports nothing changed, proposes nothing again */
  const pvRe = await ingest(s, 'qa-d1-part2-again.csv', FILE_2, false);
  const RB2 = await rows(s); const byB2 = (n) => RB2.find((r) => r.invoice_no === n) || {};
  check(byB2('QA-D1-X').row_kind === 'billing_link' && byB2('QA-D1-X').revenue_sar === 0 && byB2('QA-D1-T1').billed_by_ref === 'QA-D1-X' && pvRe.proposals === 0 && !/QA-D1-X[^\n]*updated|Updated\s*[1-9]/i.test(pvRe.text.split('Cost —')[0]),
    '5. re-importing the file keeps a ticked billing link (no undo, no "updated", no second proposal)', JSON.stringify({ kind: byB2('QA-D1-X').row_kind, rev: byB2('QA-D1-X').revenue_sar, t1: byB2('QA-D1-T1').billed_by_ref, proposals: pvRe.proposals, text: pvRe.text.slice(0, 200) }));

  /* 6. the item-name list moves pass-through, never cost or profit */
  await s.p.evaluate(async () => { for (const [n, c] of [['Flight Booking', 'pass_through'], ['Service Fees', 'fee']]) await fc().from('money_item_classes').insert({ name: n, class: c }).select('id');
    FIN.rows = null; finLoad(); });
  await s.p.waitForFunction(() => FIN.rows && FIN.m && !FIN.loading, null, { timeout: 30000 }); await s.p.waitForTimeout(500);
  const m6 = await s.p.evaluate(() => { const r = FIN.rows.find((x) => x.invoice_no === 'QA-D1-A'); const m = FIN.m[r.id] || {}; return { pt: m.pass_through_sar, fee: m.fee_sar, cost: r.cost_sar, profit: r.profit_sar }; });
  check(m6.pt === 900 && m6.fee === 100 && m6.cost == null && m6.profit == null, '6. the item-name list moves "pass-through on the invoice" (900) and never cost or profit', JSON.stringify(m6));

  /* 6b. the list on the Rules tab: shown, and a removal asks in the app's own box, naming the item, Cancel first (D19) */
  await s.p.evaluate(() => { current = 'finance'; finGo('rules'); }); await s.p.waitForTimeout(1500);
  const rt = await s.p.evaluate(() => { const c = document.querySelector('.v119-items'); const n = c ? c.querySelectorAll('[data-v119-item]').length : -1;
    const id = c && c.querySelector('[data-v119-item]') ? c.querySelector('[data-v119-item]').getAttribute('data-v119-item') : null; if (id) v119RemoveItem(id);
    const box = document.getElementById('pfConfirmBox'); const out = { n, box: box ? box.innerText : null, focus: document.activeElement && document.activeElement.id, yes: box ? document.getElementById('pfConfirmYes').textContent : null };
    if (box) document.getElementById('pfConfirmNo').click(); return out; });
  await s.p.waitForTimeout(400);
  const stillTwo = await s.p.evaluate(() => document.querySelectorAll('.v119-items [data-v119-item]').length);
  check(rt.n === 2 && /Flight Booking|Service Fees/.test(rt.box || '') && rt.focus === 'pfConfirmNo' && rt.yes === 'Remove' && stillTwo === 2,
    '6. the Rules tab lists the item names; removing one asks in the app\'s box, naming it, Cancel first — and Cancel keeps it', JSON.stringify(Object.assign(rt, { stillTwo })));

  /* 9. Performance */
  await s.p.evaluate(() => { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; finGo('overview'); }); await s.p.waitForTimeout(900);
  const perf = await s.p.evaluate(() => { const c = document.querySelector('.v119-attention'); const w = document.querySelector('[data-fin-nocost]');
    return { card: c ? c.innerText : '', keys: c ? [...c.querySelectorAll('[data-v119-k]')].map((x) => x.getAttribute('data-v119-k')) : [], basis: !!document.querySelector('[data-v119-basis]'), warn: w ? w.innerText : '', mismatch: (document.getElementById('ov-mismatch') || {}).innerText || '' }; });
  check(['nocost', 'audit', 'topup', 'billing', 'unpaid'].every((k) => perf.keys.includes(k)), '9. "Needs attention" names waiting-for-cost, audit, top-ups, billing links and unpaid', JSON.stringify(perf.keys));
  check(perf.basis, '9. the Month-by switch is on Performance');
  check(!perf.mismatch, '2. an invoice waiting for its cost is not called "stored figures that disagree" (Profit = Revenue − Cost over the invoices whose cost is known)', perf.mismatch);
  check(/waiting for their cost/.test(perf.warn) && /left out of cost and profit/.test(perf.warn) && !/pure profit/.test(perf.warn), '2. Performance says the cost is awaited and leaves it out — never "pure profit"', perf.warn);

  /* 8. a hand-entered row is left alone */
  await s.p.evaluate(async () => { await fc().rpc('fn_commit_finance_import', { p_insert: [{ invoice_no: 'QA-D1-M', client_group: 'QA Manual Co', invoice_date: '2026-03-05', total_incl_vat_sar: 250, integrity_status: 'verified_paid', source: 'manual' }] }); FIN.rows = null; finLoad(); });
  await s.p.waitForFunction(() => FIN.rows && !FIN.loading, null, { timeout: 30000 }); await s.p.evaluate(() => { current = 'finance'; finGo('import'); }); await s.p.waitForTimeout(600);
  const pvM = await ingest(s, 'qa-d1-manual.csv', csv(inv('QA-D1-M', { cust: 'QA Manual Co', created: '05/03/2026 09:00:00 AM', paid: '06/03/2026', status: 'Fully Paid', total: 9999 })), false);
  const man = (await rows(s)).find((r) => r.invoice_no === 'QA-D1-M');
  check(man && man.total_incl_vat_sar === 250 && /Entered by hand/.test(pvM.d1), '8. a row entered by hand is left as it is, and the preview says so', JSON.stringify({ total: man && man.total_incl_vat_sar, d1: pvM.d1 }));
  check(!s.errors.length && !s.natives.length, '10. no JS error, no native dialog', s.errors.concat(s.natives).slice(0, 3).join(' | '));
  await done(s);

  /* Arabic: the preview's new line reads in Arabic */
  console.log('\nArabic');
  s = await session(9723, 'ar');
  const pvA = await ingest(s, 'qa-d1-part1.csv', FILE_1, false);
  check(/تعبئة المحفظة/.test(pvA.d1) && /غير مدفوعة بعد/.test(pvA.d1) && /محجوزة/.test(pvA.d1), '3. the same lines in Arabic', pvA.d1.replace(/\n/g, ' | '));
  check(!s.errors.length && !s.natives.length, '10. no JS error, no native dialog (AR)', s.errors.concat(s.natives).slice(0, 3).join(' | '));
  await done(s);
  /* 11. two export runs pasted into ONE file (the overlap repeats invoices, one with a newer status) — imports once each */
  console.log('\nTwo runs in one file (overlap)');
  s = await session(9724, 'en');
  const both = FILE_2.replace(/\s+$/, '') + '\n' + FILE_1.split(/\r?\n/).slice(1).join('\n');   // the NEWER run first: the older copy that follows must not win
  const pvO = await ingest(s, 'qa-d1-overlap.csv', both, false);
  const RO = await rows(s); const cnt = {}; RO.forEach((r) => { cnt[r.invoice_no] = (cnt[r.invoice_no] || 0) + 1; });
  const linesO = await fetch(s.BASE + '/rest/v1/finance_invoice_lines?select=*').then((r) => r.json()); const lc = {}; linesO.forEach((l) => { const k = l.invoice_no + '#' + l.line_no; lc[k] = (lc[k] || 0) + 1; });
  const e = RO.find((r) => r.invoice_no === 'QA-D1-E') || {};
  check(pvO.committed && /Done\./.test(pvO.done) && !/FAILED/.test(pvO.done) && Object.values(cnt).every((n) => n === 1) && Object.values(lc).every((n) => n === 1) && e.integrity_status === 'verified_paid',
    '7. an invoice repeated inside one file lands once (and each of its lines once), with the newer status — the import is not refused',
    JSON.stringify({ done: pvO.done.slice(0, 160), dupRows: Object.keys(cnt).filter((k) => cnt[k] > 1), dupLines: Object.keys(lc).filter((k) => lc[k] > 1), e: e.payments_status }));
  /* 12. a heavy customer (300 transactions, 300 invoices no combination can match) — the billing-link search is capped, so the
     preview still arrives in seconds and says how many invoices were not checked; nothing is proposed by guesswork */
  const heavy = [];
  for (let k = 0; k < 300; k++) heavy.push(...inv('QA-D1-HT' + k, { cust: 'QA Heavy Co', created: '01/04/2026 09:00:00 AM', paid: '01/04/2026', status: 'Fully Paid', total: 100 + k, items: [{ name: 'Flight Booking - Flight Booking', total: 100 + k }] }));
  for (let k = 0; k < 300; k++) heavy.push(...inv('QA-D1-HI' + k, { dpin: 'DPIN-QA-H' + k, cust: 'QA Heavy Co', created: '20/04/2026 09:00:00 AM', paid: '20/04/2026', status: 'Fully Paid', total: 2000 + k + 0.5, items: [{ name: 'Billing - Service Fee', total: 2000 + k + 0.5, tax: true }] }));
  const t0 = Date.now();
  await s.p.evaluate((t) => window.v65IngestText('qa-d1-heavy.csv', t), csv(heavy));
  await s.p.waitForFunction(() => /Confirm import|تأكيد الاستيراد/.test((document.getElementById('finImpOut') || {}).innerText || ''), null, { timeout: 60000 }).catch(() => {});
  const secs = (Date.now() - t0) / 1000;
  const hv = await s.p.evaluate(() => { const n = document.querySelector('[data-v65-bl-skipped]'); return { skipped: n ? +n.getAttribute('data-v65-bl-skipped') : 0, proposals: document.querySelectorAll('[data-v65-bl]').length, confirm: /Confirm import/.test((document.getElementById('finImpOut') || {}).innerText || '') }; });
  check(hv.confirm && secs < 30 && hv.skipped > 0 && hv.proposals === 0, '5. a heavy customer cannot freeze the preview: the billing-link search is capped, the invoices it could not check are counted on screen, none is guessed',
    JSON.stringify(Object.assign(hv, { secs })));
  await done(s);

  console.log(failures ? `\nFAILED — ${failures} check(s)` : '\nPASS — D1: the invoice export imports as Payments records it, fills and never wipes');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
