/* probe-importer-scale-attacks.mjs (2026-09-03, watch cycle 14) - the importer at scale.

   Cycle 13 made six Finance reads page past the API's 1000-row ceiling, including the two
   expense-capture reads in js/65. That fix could only be proved through the shared helper, not
   through the import flow itself. This probe drives the real flow: a 3,000-row file dropped onto
   a table that already holds 5,200 invoices and 1,500 expense-capture lines, using the app's own
   ingest entry point and its own Confirm button - nothing poked into state.

   Under test:
     1. The preview's New / Updated / Unchanged / Excluded counts at 3,000 rows equal an
        independent recount, and the preview arrives without freezing.
     2. Confirm writes exactly those rows and nothing else - checked against the database.
     3. Dropping the SAME file a second time is a genuine no-op (cycle 5's idempotency, now with
        the existing-invoice index built over 5,200 rows rather than 15).
     4. Cycle 10's guard still holds when the index is that large: an invoice the owner deleted
        here is named, held back, and left byte-identical - not resurrected, not written to.
     5. Cycle 13's paging fix, end to end: a transaction whose expense lines sit PAST the first
        1,000 rows of finance_expense_lines_capture still resolves its cost onto the invoice.
        Before that fix the baseline read stopped at 1,000 and this cost silently never arrived.
     6. The standing exclusion still holds at 3,000 rows, and the binary-file refusal still fires.
     7. Cycle 12's permission guard survives at scale: a viewer pressing Confirm on an armed
        preview writes nothing.

   Run:  node scripts/qa/probe-importer-scale-attacks.mjs        (port 8215)
   Sabotage (file-level - replacing a window.* copy proves nothing, js/65 calls its own local
   functions): revert the two capture reads in js/65 to plain unpaged selects -> check 5 goes red;
   let initState() index deleted rows again -> check 4 goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8215;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

/* ---------------- fixture ---------------- */
const N_MAPPED = 2000;        // rows already in the shape a mapped import produces
const N_NOISE = 3200;         // ordinary verified rows, so the table really is past every page
const N_UNCHANGED = 1177, N_UPDATED = 800, N_NEW = 1000, N_EXCL = 20;
const DELETED = ['SCI-1980', 'SCI-1981', 'SCI-1982'];
const EXCLUDED_GROUP = 'Takamol Scale QA';
const JOIN_TXN = 'ZZZ-LATE-TARGET';          // sorts last, so its lines sit past row 1000
const JOIN_INVOICE = 'SCI-TARGET';
const JOIN_LINES = [100, 150, 200];          // -> cost 450, comfortably under the invoice total
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dateOf = (i) => '2026-' + String((i % 12) + 1).padStart(2, '0') + '-' + String((i % 27) + 1).padStart(2, '0');
const totalOf = (i) => 1000 + (i % 97) * 13;
const costOf = (i) => Math.round(totalOf(i) * 0.6);
const AR_DELETED = 'محذوفة';
const AR_CONFIRM = 'تأكيد';

function mappedShape(no, i, extra) {
  const d = dateOf(i), t = totalOf(i), c = costOf(i), mo = +d.slice(5, 7);
  return Object.assign({
    id: 'mi-' + no, invoice_no: no, zatca_dpin: null,
    client_group: 'Scale Co ' + String(i % 108).padStart(3, '0'), customer_raw_name: 'Scale Co ' + String(i % 108).padStart(3, '0'),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: null, service_type: null, record_type: 'b2b',
    total_incl_vat_sar: t, wallet_portion_sar: 0, revenue_sar: t, cost_sar: c, profit_sar: t - c,
    vat_sar: 0, discount_sar: 0, amount_received_sar: 0, amount_remaining_sar: t,
    integrity_status: 'pending', exclusion_reason: null, notes: null, source_batch: 'prior-drop',
    created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', deleted_at: null
  }, extra || {});
}
const SEED_INV = [];
for (let i = 0; i < N_MAPPED; i++) SEED_INV.push(mappedShape('SCI-' + i, i, DELETED.indexOf('SCI-' + i) >= 0 ? { deleted_at: '2026-08-01T00:00:00Z' } : null));
SEED_INV.push(mappedShape(JOIN_INVOICE, 7, { cost_sar: 0, profit_sar: totalOf(7) }));
for (let i = 0; i < N_NOISE; i++) {
  const d = dateOf(i), t = totalOf(i), c = costOf(i), mo = +d.slice(5, 7);
  SEED_INV.push({
    id: 'nz' + i, invoice_no: 'SC-' + (200000 + i), zatca_dpin: 'TTIN-' + (600000 + i),
    client_group: 'Scale Co ' + String(i % 108).padStart(3, '0'), customer_raw_name: 'Scale Co ' + String(i % 108).padStart(3, '0'),
    invoice_date: d, year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: t, wallet_portion_sar: 0, revenue_sar: t, cost_sar: c, profit_sar: t - c,
    vat_sar: 0, amount_received_sar: t, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'seed', created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z', deleted_at: null
  });
}
// 1,500 baseline expense lines whose refs all sort BEFORE the join target, plus the target's own
// lines at the very end - so the target is only reachable by a read that pages.
const SEED_LINES = [];
for (let i = 0; i < 1500; i++) SEED_LINES.push({ id: 'bl' + i, transaction_ref: 'TXA-' + String(i).padStart(5, '0'), amount_sar: 10, expense_status: 'Approved', captured_at: '2026-08-01T00:00:00Z' });
JOIN_LINES.forEach((a, k) => SEED_LINES.push({ id: 'blz' + k, transaction_ref: JOIN_TXN, amount_sar: a, expense_status: 'Approved', captured_at: '2026-08-01T00:00:00Z' }));

const srv = start(PORT, {
  finance_invoices: SEED_INV,
  finance_expense_lines_capture: SEED_LINES,
  finance_expense_gate_capture: []
});
const BASE = 'http://localhost:' + PORT;
const invRow = async (n) => fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(n)).then(r => r.json());
// The probe's own verification reads have to page too. They did not at first, and counted 1000
// rows in a 6,201-row table — the very mistake this cycle is about, made by the checker.
async function countAll(table) {
  let n = 0, from = 0;
  for (;;) {
    const page = await fetch(BASE + '/rest/v1/' + table + '?select=id&offset=' + from + '&limit=1000').then(r => r.json());
    n += page.length;
    if (page.length < 1000) return n;
    from += 1000;
  }
}

/* ---------------- the 3,000-row file ---------------- */
const HEADER = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
const lines = ['Ref,Customer,Date,Total,Cost'];
for (let i = 0; i < N_UNCHANGED; i++) lines.push(['SCI-' + i, 'Scale Co ' + String(i % 108).padStart(3, '0'), dateOf(i), totalOf(i), costOf(i)].join(','));
for (let i = N_UNCHANGED; i < N_UNCHANGED + N_UPDATED; i++) lines.push(['SCI-' + i, 'Scale Co ' + String(i % 108).padStart(3, '0'), dateOf(i), totalOf(i) + 1000, costOf(i)].join(','));
DELETED.forEach((no, k) => lines.push([no, 'Scale Co 000', dateOf(1980 + k), 99999, 100].join(',')));
for (let i = 1; i <= N_EXCL; i++) lines.push(['SCX-' + i, EXCLUDED_GROUP, '2026-05-05', 5000, 100].join(','));
for (let i = 1; i <= N_NEW; i++) lines.push(['SCN-' + i, 'Scale Co ' + String(i % 108).padStart(3, '0'), '2026-04-04', 2000 + i, 500].join(','));
const CSV = lines.join('\n');

async function main() {
  console.log('fixture: ' + SEED_INV.length + ' invoices · ' + SEED_LINES.length + ' expense lines · a ' + (lines.length - 1) + '-row file');
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate((g) => {
    DB.settings = DB.settings || {};
    DB.settings.financeExclusions = [{ id: 'fx-imp-scale', clientId: 'excl', matchNames: [g], reason: 'QA scale fixture', addedBy: 'probe', addedAt: new Date().toISOString() }];
  }, EXCLUDED_GROUP);
  await p.evaluate((header) => {
    DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, HEADER);
  await p.evaluate(() => { current = 'finance'; render(); });
  for (let i = 0; i < 120 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 5000)); i++) await p.waitForTimeout(250);
  const nLoaded = await p.evaluate(() => FIN.rows.length);
  if (nLoaded === SEED_INV.length) ok('the page holds all ' + SEED_INV.length + ' existing invoices before the drop - the index the importer matches against is complete');
  else fail('the page holds ' + nLoaded + ' of ' + SEED_INV.length + ' invoices before the drop');
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(800);

  const preview = () => p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  const drop = async (name, text, waitMs) => {
    const t0 = Date.now();
    await p.evaluate(([n, t]) => window.v65IngestText(n, t), [name, text]);
    let last = '', same = 0;
    for (let i = 0; i < Math.ceil((waitMs || 40000) / 400); i++) {
      await p.waitForTimeout(400);
      const cur = await preview();
      if (cur && cur === last) { same++; if (same >= 3) break; } else same = 0;
      last = cur;
    }
    return Date.now() - t0;
  };
  const counts = (txt) => { const m = txt.match(/New\s+(\d+)\s*·\s*Updated\s+(\d+)\s*·\s*Unchanged\s+(\d+)\s*·\s*Excluded by rule\s+(\d+)/); return m ? { isNew: +m[1], updated: +m[2], unchanged: +m[3], excluded: +m[4] } : null; };
  const confirmBtn = () => p.evaluate((ar) => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent) || x.textContent.indexOf(ar) >= 0); if (bt) { bt.click(); return true; } return false; }, AR_CONFIRM);

  /* ---------- 1. the preview at 3,000 rows ---------- */
  const tPreview = await drop('scale-import.csv', CSV, 60000);
  const pv1 = await preview();
  const c1 = counts(pv1);
  if (c1) ok('preview after a ' + (lines.length - 1) + '-row drop: New ' + c1.isNew + ' · Updated ' + c1.updated + ' · Unchanged ' + c1.unchanged + ' · Excluded ' + c1.excluded);
  else fail('no preview counts rendered: ' + JSON.stringify(pv1.replace(/\n/g, ' | ').slice(0, 500)));
  if (c1 && c1.isNew === N_NEW) ok(N_NEW + ' brand-new invoice numbers counted as new'); else fail('New = ' + (c1 && c1.isNew) + ', expected ' + N_NEW);
  if (c1 && c1.updated === N_UPDATED) ok(N_UPDATED + ' changed invoices counted as updated'); else fail('Updated = ' + (c1 && c1.updated) + ', expected ' + N_UPDATED);
  if (c1 && c1.unchanged === N_UNCHANGED) ok(N_UNCHANGED + ' identical invoices counted as unchanged - not rewritten for nothing'); else fail('Unchanged = ' + (c1 && c1.unchanged) + ', expected ' + N_UNCHANGED);
  if (c1 && c1.excluded >= N_EXCL) ok('the standing exclusion held ' + c1.excluded + ' rows back at 3,000 rows'); else fail('Excluded by rule = ' + (c1 && c1.excluded) + ', expected at least ' + N_EXCL);
  if (tPreview < 60000) ok('the preview arrived in ' + (tPreview / 1000).toFixed(1) + 's against ' + SEED_INV.length + ' existing invoices'); else fail('the preview took ' + (tPreview / 1000).toFixed(1) + 's');

  /* ---------- 2. cycle 10's guard with a 5,200-row index ---------- */
  const namedDeleted = DELETED.filter(no => new RegExp(no + '[\\s\\S]{0,200}(deleted|' + AR_DELETED + ')', 'i').test(pv1)).length;
  if (namedDeleted === DELETED.length) ok('all ' + DELETED.length + ' invoices deleted here are named in the preview and held back - the guard still finds them with the index built over ' + SEED_INV.length + ' rows');
  else fail(namedDeleted + ' of ' + DELETED.length + ' deleted invoices named in the preview');

  /* ---------- 3. Confirm writes exactly that ---------- */
  const before = await countAll('finance_invoices');
  await confirmBtn();
  await p.waitForTimeout(6000);
  const after = await countAll('finance_invoices');
  if (after - before === N_NEW) ok('Confirm inserted exactly ' + N_NEW + ' rows - no duplicate, no excluded row, no deleted row resurrected');
  else fail('the table grew by ' + (after - before) + ', expected ' + N_NEW);
  const delRows = await invRow(DELETED[0]);
  if (delRows.length === 1 && +delRows[0].total_incl_vat_sar === totalOf(1980) && delRows[0].deleted_at) ok('the deleted invoice still holds its own total and is still deleted - the drop wrote nothing into it');
  else fail('a deleted invoice was written to or duplicated: ' + JSON.stringify(delRows.map(r => [r.total_incl_vat_sar, !!r.deleted_at])));
  const exRows = await invRow('SCX-1');
  if (exRows.length === 0) ok('no excluded-client invoice reached the table'); else fail('an excluded-client invoice was written');
  const updRow = await invRow('SCI-' + N_UNCHANGED);
  if (updRow.length === 1 && +updRow[0].total_incl_vat_sar === totalOf(N_UNCHANGED) + 1000) ok('a changed invoice really updated - the guards do not swallow ordinary work at scale');
  else fail('the changed invoice did not update: ' + JSON.stringify(updRow.map(r => r.total_incl_vat_sar)));

  /* ---------- 4. idempotency at scale ---------- */
  await p.evaluate(() => { FIN.rows = null; finLoad(); });
  for (let i = 0; i < 160 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length >= 6000)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(600);
  await drop('scale-import.csv', CSV, 60000);
  const c2 = counts(await preview());
  if (c2 && c2.isNew === 0 && c2.updated === 0) ok('the same file dropped again is a genuine no-op: New 0 · Updated 0 · Unchanged ' + c2.unchanged + ' - re-importing changes nothing, with the index built over ' + after + ' rows');
  else fail('second drop of the same file reported New ' + (c2 && c2.isNew) + ' · Updated ' + (c2 && c2.updated) + ', expected 0 and 0');

  /* ---------- 5. cycle 13's paging fix, through the real flow ---------- */
  const gates = 'transaction_ref,txn_expense_status,invoice_issuing_raw\n' + JOIN_TXN + ',Ready,Issued ' + JOIN_INVOICE;
  await drop('gates.csv', gates, 40000);
  const joinTxt = await preview();
  if (process.env.DEBUG_JOIN) console.log('--- JOIN PREVIEW ---\n' + joinTxt.slice(0, 1500) + '\n--- END ---');
  await confirmBtn();
  await p.waitForTimeout(4000);
  const seenLines = joinTxt.match(/(\d+) transaction\(s\) have expense lines but no transaction-status row yet/);
  if (seenLines && +seenLines[1] === 1500) ok('the join reads all 1,500 baseline expense-line transactions from the capture table - before cycle 13 this read stopped at 1,000 and the rest were invisible');
  else fail('the join sees ' + (seenLines ? seenLines[1] : 'no') + ' baseline expense-line transactions, the table holds 1500');
  const joinRow = await invRow(JOIN_INVOICE);
  const wantCost = JOIN_LINES.reduce((a, v) => a + v, 0);
  if (joinRow.length === 1 && Math.abs(+joinRow[0].cost_sar - wantCost) < 0.005) ok('a transaction whose expense lines sit past row 1,000 of the capture table still resolved its ' + wantCost + ' cost onto ' + JOIN_INVOICE + " - cycle 13's paging fix, proved through the real import flow");
  else fail(JOIN_INVOICE + ' cost is ' + (joinRow.length ? joinRow[0].cost_sar : 'n/a') + ', expected ' + wantCost + " - the baseline read stopped short of the target's lines");

  /* ---------- 6. the binary refusal still fires ---------- */
  await drop('payload.xlsx', 'PK  binary-ish ', 15000);
  const bin = await preview();
  if (/binary|not a text|Excel|ثنائ/i.test(bin)) ok('a binary file is still refused in words, not parsed as garbage'); else fail('the binary refusal did not fire: ' + JSON.stringify(bin.slice(0, 250)));

  /* ---------- 7. cycle 12's permission guard at scale ---------- */
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(500);
  // a file with genuinely new numbers, so a Confirm button really is offered (a third drop of the
  // same file offers none, correctly - there would be nothing to write)
  const freshCsv = ['Ref,Customer,Date,Total,Cost'].concat(
    [...Array(300)].map((_, i) => ['SCV-' + i, 'Scale Co 001', '2026-04-04', 3000 + i, 500].join(','))
  ).join('\n');
  await drop('viewer-test.csv', freshCsv, 40000);
  const armed = await p.evaluate((ar) => !![...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent) || x.textContent.indexOf(ar) >= 0), AR_CONFIRM);
  const beforeV = await countAll('finance_invoices');
  await p.evaluate(() => { window.__userTier = 'viewer'; window.__userRole = 'viewer'; window.__pageAccess = {}; });
  const pressed = await confirmBtn();
  await p.waitForTimeout(4000);
  const afterV = await countAll('finance_invoices');
  if (armed && pressed && afterV === beforeV) ok('a 300-row preview armed as admin, then confirmed after the role drops to viewer, writes nothing - cycle 12 guard holds at scale');
  else fail('armed=' + armed + ' pressed=' + pressed + ': the table went from ' + beforeV + ' to ' + afterV + ' rows after a viewer pressed Confirm');

  if (!errors.length) ok('no page errors through the whole run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
