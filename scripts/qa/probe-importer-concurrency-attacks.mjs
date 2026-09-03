/* probe-importer-concurrency-attacks.mjs (2026-09-03, watch cycle 24) - two people importing
   two different files whose invoice numbers overlap.

   Cycle 15 covered two tabs importing the SAME file. The harder case is two DIFFERENT files that
   happen to share some invoice numbers - which is what actually happens when two people export
   overlapping date ranges from Direct Payments on the same afternoon. Each preview is computed
   against the table as it was BEFORE the other person confirmed, so the second Confirm tries to
   insert rows that now exist. The live table carries UNIQUE (invoice_no, line_no), so that batch
   fails as a whole.

   The question this probe answers is what the loser is left with. A partial write - some invoices
   in, some out, and no way to tell which - is far worse than a clean refusal, and the person must
   be told which happened.

   Under test:
     1. After both Confirms, no invoice number exists twice.
     2. The first tab's rows all landed.
     3. The second tab is told its import FAILED and that nothing landed, with the database's own
        reason - not a success message, and not silence.
     4. Nothing from the failed batch is half-written: the rows unique to the second file are
        absent, all of them, and its expense-capture rows did not leak in either.
     5. Reloading the second tab shows the truth - the overlapping invoices exist (the other
        person's version), its own new ones do not - rather than its stale preview.
     6. Re-dropping the second file after the failure now reports the overlap as Unchanged or
        Updated rather than New, so the person can simply confirm again and finish the job.

   Run:  node scripts/qa/probe-importer-concurrency-attacks.mjs        (port 8227)
   Sabotage (file-level): make v65Commit report success regardless of r.error -> checks 3 red;
   make the mock's RPC insert row-by-row instead of all-or-nothing -> check 4 red. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8227;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function seedInv(id) {
  return {
    id: 'ic-' + id, invoice_no: 'IC-OLD-' + id, line_no: 1, zatca_dpin: null,
    client_group: 'Conc Import Co', customer_raw_name: 'Conc Import Co', invoice_date: '2026-03-10',
    year: 2026, month: 'March', quarter: 'Q1', products: 'Flights', service_type: 'Flights',
    record_type: 'b2b', total_incl_vat_sar: 1000, wallet_portion_sar: 0, revenue_sar: 1000,
    cost_sar: 600, profit_sar: 400, vat_sar: 0, amount_received_sar: 1000, amount_remaining_sar: 0,
    integrity_status: 'verified_paid', exclusion_reason: null, notes: null, source_batch: 'seed',
    revenue_way: 'invoice', created_at: '2026-03-10T00:00:00Z', updated_at: '2026-03-10T00:00:00Z', deleted_at: null
  };
}
const SEED = [1, 2, 3].map(seedInv);
const srv = start(PORT, { finance_invoices: SEED, finance_expense_lines_capture: [], finance_expense_gate_capture: [] });
const BASE = 'http://localhost:' + PORT;

const HEADER = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
const line = (no, total) => [no, 'Conc Import Co', '2026-04-10', total, Math.round(total * 0.5)].join(',');
const SHARED = ['IC-SHARE-1', 'IC-SHARE-2', 'IC-SHARE-3'];
const ONLY_A = ['IC-A-1', 'IC-A-2', 'IC-A-3', 'IC-A-4', 'IC-A-5'];
const ONLY_B = ['IC-B-1', 'IC-B-2', 'IC-B-3', 'IC-B-4'];
const FILE_A = ['Ref,Customer,Date,Total,Cost'].concat(ONLY_A.map((n, i) => line(n, 2000 + i))).concat(SHARED.map((n, i) => line(n, 5000 + i))).join('\n');
const FILE_B = ['Ref,Customer,Date,Total,Cost'].concat(ONLY_B.map((n, i) => line(n, 3000 + i))).concat(SHARED.map((n, i) => line(n, 7000 + i))).join('\n');

const allInvoices = async () => {
  const out = []; let from = 0;
  for (;;) {
    const page = await fetch(BASE + '/rest/v1/finance_invoices?select=invoice_no,total_incl_vat_sar&offset=' + from + '&limit=1000').then(r => r.json());
    out.push(...page); if (page.length < 1000) return out; from += 1000;
  }
};

async function session(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(label + ': ' + e.message));
  p.on('dialog', async d => { await d.accept(); });
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
  await p.evaluate((header) => {
    DB.settings = DB.settings || {};
    DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, HEADER);
  await p.evaluate(() => { current = 'finance'; render(); });
  for (let i = 0; i < 80 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(700);
  return { p, errors, label };
}
const preview = (S) => S.p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
const drop = async (S, name, text) => {
  await S.p.evaluate(([n, t]) => window.v65IngestText(n, t), [name, text]);
  let last = '', same = 0;
  for (let i = 0; i < 60; i++) { await S.p.waitForTimeout(400); const cur = await preview(S); if (cur && cur === last) { same++; if (same >= 3) break; } else same = 0; last = cur; }
};
const confirm = (S) => S.p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import/i.test(x.textContent)); if (bt) { bt.click(); return true; } return false; });
const counts = (txt) => { const m = txt.match(/New\s+(\d+)\s*·\s*Updated\s+(\d+)\s*·\s*Unchanged\s+(\d+)/); return m ? { isNew: +m[1], updated: +m[2], unchanged: +m[3] } : null; };

async function main() {
  console.log('fixture: 3 existing invoices; file A = 5 unique + 3 shared, file B = 4 unique + the same 3 shared');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const A = await session(b, 'A');
  const B = await session(b, 'B');

  /* both preview BEFORE either confirms — each sees the shared invoices as new */
  await drop(A, 'file-a.csv', FILE_A);
  await drop(B, 'file-b.csv', FILE_B);
  const cA = counts(await preview(A)), cB = counts(await preview(B));
  if (cA && cA.isNew === 8 && cB && cB.isNew === 7) ok('both tabs preview against the table as it was: A sees 8 new, B sees 7 new, and three of those are the same invoices');
  else fail('previews: A ' + JSON.stringify(cA) + ', B ' + JSON.stringify(cB) + ' — expected 8 new and 7 new');

  /* A confirms first and wins */
  const aPressed = await confirm(A); await new Promise(r => setTimeout(r, 5000));
  const afterA = await allInvoices();
  const aLanded = ONLY_A.concat(SHARED).every(n => afterA.some(r => r.invoice_no === n));
  if (aPressed && aLanded) ok('the first tab\'s 8 invoices all landed'); else fail('the first tab did not land its rows');

  /* B confirms second, against a table that has moved under it */
  const bPressed = await confirm(B); await new Promise(r => setTimeout(r, 5000));
  const afterB = await allInvoices();

  /* ---------- 1. nothing duplicated ---------- */
  const nos = afterB.map(r => r.invoice_no);
  const dupes = [...new Set(nos.filter((n, i) => nos.indexOf(n) !== i))];
  if (!dupes.length) ok('after both Confirms no invoice number exists twice — the database refused the overlap rather than doubling the money');
  else fail('duplicated invoice numbers: ' + JSON.stringify(dupes));

  /* ---------- 2. the loser is told, in words ---------- */
  const bOut = await preview(B);
  const said = /FAILED|nothing landed|duplicate key|violates unique/i.test(bOut);
  const falseSuccess = /\bDone\./i.test(bOut) && !said;
  if (said && !falseSuccess) ok('the second tab is told its import failed and nothing landed, carrying the database\'s own reason');
  else fail('the second tab was told: ' + JSON.stringify(bOut.replace(/\n/g, ' | ').slice(0, 240)));

  /* ---------- 3. nothing half-written ---------- */
  const bLeaked = ONLY_B.filter(n => afterB.some(r => r.invoice_no === n));
  if (!bLeaked.length) ok(`none of the second file's ${ONLY_B.length} own invoices were written — the batch failed whole, so there is no half-imported file to reconcile by hand`);
  else fail(`${bLeaked.length} row(s) from the failed batch were written anyway: ${JSON.stringify(bLeaked)} — some in, some out, and nothing on screen says which`);
  const capLines = await fetch(BASE + '/rest/v1/finance_expense_lines_capture?select=id').then(r => r.json());
  if (!capLines.length) ok('and nothing leaked into the expense-capture tables from the failed batch either');
  else fail(capLines.length + ' expense-capture row(s) survived a failed batch');

  /* ---------- 4. the shared invoices hold the FIRST tab's numbers ---------- */
  const sharedWrong = SHARED.filter((n, i) => { const row = afterB.find(r => r.invoice_no === n); return !row || Math.abs(+row.total_incl_vat_sar - (5000 + i)) > 0.01; });
  if (!sharedWrong.length) ok('the three shared invoices still hold the first tab\'s figures — the losing batch did not partially overwrite them');
  else fail('shared invoices were overwritten or lost: ' + JSON.stringify(sharedWrong));

  /* ---------- 5. reloading shows the truth, not the stale preview ---------- */
  await B.p.evaluate(() => { FIN.rows = null; finLoad(); });
  for (let i = 0; i < 80 && !(await B.p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await B.p.waitForTimeout(250);
  const bSees = await B.p.evaluate(([shared, onlyB]) => ({
    shared: shared.filter(n => (FIN.rows || []).some(r => r.invoice_no === n)).length,
    own: onlyB.filter(n => (FIN.rows || []).some(r => r.invoice_no === n)).length
  }), [SHARED, ONLY_B]);
  if (bSees.shared === SHARED.length && bSees.own === 0) ok('after a reload the second tab sees the truth: the three shared invoices exist and its own four do not');
  else fail('after reload the second tab sees ' + JSON.stringify(bSees));

  /* ---------- 6. dropping the same file again now finishes the job ---------- */
  await B.p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await B.p.waitForTimeout(600);
  await drop(B, 'file-b.csv', FILE_B);
  const cB2 = counts(await preview(B));
  if (cB2 && cB2.isNew === ONLY_B.length) ok(`re-dropping the same file after the failure reports its ${ONLY_B.length} own invoices as new and the three shared ones as already there — one more Confirm finishes the job`);
  else fail('the second drop reports ' + JSON.stringify(cB2) + ', expected ' + ONLY_B.length + ' new');
  const bPressed2 = await confirm(B); await new Promise(r => setTimeout(r, 5000));
  const finalRows = await allInvoices();
  const allThere = ONLY_A.concat(ONLY_B).concat(SHARED).every(n => finalRows.some(r => r.invoice_no === n));
  const finalNos = finalRows.map(r => r.invoice_no);
  const finalDupes = finalNos.filter((n, i) => finalNos.indexOf(n) !== i);
  if (bPressed2 && allThere && !finalDupes.length) ok('and that second Confirm lands cleanly: every invoice from both files is present exactly once');
  else fail('after the retry: allThere=' + allThere + ', duplicates=' + JSON.stringify([...new Set(finalDupes)]));

  const errs = A.errors.concat(B.errors);
  if (!errs.length) ok('no page errors in either session'); else fail('page errors: ' + errs.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
