/* probe-deleted-invoice-attacks.mjs (2026-09-02, overnight cycle) — what the importer does with
   an invoice the owner has DELETED here.

   The shape being guarded: `finLoad()` selects finance_invoices with no deleted_at filter (on
   purpose — the Ledger offers Restore), so FIN.rows carries soft-deleted rows, and the
   importer's `initState()` indexed every one of them as "already exists". A re-import of a
   deleted invoice therefore matched the deleted row and reported "1 updated" — writing into a
   row that stays invisible everywhere. From the owner's chair: "I deleted it, dropped the file
   again, the importer said it updated, and the invoice never came back."
   Rules under test:
     1. A deleted invoice is neither updated nor silently resurrected: the preview names it and
        says to restore it first, and nothing is written.
     2. The deleted row is untouched — same total, still deleted.
     3. A LIVE invoice with a real change still updates normally in the same drop (the guard
        must not swallow ordinary work).
     4. A brand-new invoice number in the same drop still inserts.
     5. The cost-capture join says "deleted here", not "probably an invoice-import gap", when a
        transaction issues into a deleted invoice — two different problems, two messages.
   Run:  node scripts/qa/probe-deleted-invoice-attacks.mjs      (port 8205)
   Sabotage: let initState() index deleted rows again → checks 1 and 2 go red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8205; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const inv = async (n) => fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(n)).then((r) => r.json());

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.accept());
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
  await p.waitForTimeout(5500);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);

  // pick two real fixture invoices: one to delete, one to leave live
  const picked = await p.evaluate(() => {
    const live = (FIN.rows || []).filter(r => !r.deleted_at);
    return { del: live[0].invoice_no, keep: live[1].invoice_no, delTotal: +live[0].total_incl_vat_sar, keepTotal: +live[1].total_incl_vat_sar, delGroup: live[0].client_group, keepGroup: live[1].client_group };
  });
  // soft-delete the first one exactly as the Ledger's Delete button does
  await fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(picked.del), {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deleted_at: new Date().toISOString() })
  });
  await p.evaluate(() => { FIN.rows = null; finLoad(); }); await p.waitForTimeout(2500);
  const isDeleted = await p.evaluate((no) => { const r = (FIN.rows || []).find(x => x.invoice_no === no); return !!(r && r.deleted_at); }, picked.del);
  if (isDeleted) ok(`fixture ready: invoice ${picked.del} is soft-deleted and still sits in the page's row list (that is why the Ledger can restore it)`); else fail('could not soft-delete the fixture invoice');

  // teach a mapped file and drop one containing: the deleted invoice, the live one (changed), and a new one
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(800);
  const header = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  await p.evaluate((header) => {
    DB.settings = DB.settings || {}; DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map(h => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, header);
  const csv = [
    'Ref,Customer,Date,Total,Cost',
    `${picked.del},${picked.delGroup},2026-06-15,99999,100`,
    `${picked.keep},${picked.keepGroup},2026-06-15,${picked.keepTotal + 1234},50`,
    'DEL-NEW-1,Test Company 1,2026-06-15,4321,20'
  ].join('\n');
  await p.evaluate((t) => window.v65IngestText('deleted-test.csv', t), csv);
  await p.waitForTimeout(2000);
  const preview = await p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');

  /* ---------- 1. the deleted invoice is named and held back ---------- */
  const named = new RegExp(picked.del + '[\\s\\S]{0,160}(deleted|محذوفة)', 'i').test(preview);
  if (named) ok(`the preview names invoice ${picked.del} and says it is deleted here`); else fail('the deleted invoice is not named as deleted in the preview: ' + JSON.stringify(preview.replace(/\n/g, ' | ').slice(0, 400)));
  const m = preview.match(/New\s+(\d+)\s*·\s*Updated\s+(\d+)\s*·\s*Unchanged\s+(\d+)\s*·\s*Excluded by rule\s+(\d+)/);
  if (m && +m[1] === 1 && +m[2] === 1 && +m[4] >= 1) ok(`counts read New 1 · Updated 1 · Excluded ${m[4]} — the deleted invoice is excluded, the live one still updates, the new one still inserts`);
  else fail('preview counts: ' + JSON.stringify(m && m.slice(1)) + ' — expected New 1, Updated 1, Excluded ≥1');

  await p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find(x => /Confirm import|تأكيد/i.test(x.textContent)); if (bt) bt.click(); });
  await p.waitForTimeout(2500);

  /* ---------- 2. the deleted row is untouched ---------- */
  const delRows = await inv(picked.del);
  if (delRows.length === 1 && Math.abs(+delRows[0].total_incl_vat_sar - picked.delTotal) < 0.005 && delRows[0].deleted_at) ok(`the deleted invoice still holds its original total (${picked.delTotal}) and is still deleted — the drop wrote nothing into it`);
  else fail('the deleted invoice was written to: ' + JSON.stringify(delRows.map(r => [r.total_incl_vat_sar, !!r.deleted_at])));
  if (delRows.length === 1) ok('…and no second, live copy of it was created either (no duplicate invoice number)'); else fail(delRows.length + ' rows now carry that invoice number');

  /* ---------- 3 + 4. ordinary work still happens ---------- */
  const keepRows = await inv(picked.keep);
  if (keepRows.length === 1 && Math.abs(+keepRows[0].total_incl_vat_sar - (picked.keepTotal + 1234)) < 0.005) ok('the live invoice in the same drop updated normally — the guard does not swallow ordinary work'); else fail('live invoice not updated: ' + JSON.stringify(keepRows.map(r => r.total_incl_vat_sar)));
  const newRows = await inv('DEL-NEW-1');
  if (newRows.length === 1 && +newRows[0].total_incl_vat_sar === 4321) ok('the brand-new invoice in the same drop inserted normally'); else fail('new invoice not inserted');

  /* ---------- 5. the cost join distinguishes deleted from missing ---------- */
  const joinNote = await p.evaluate(async (delNo) => {
    // one transaction issuing into the DELETED invoice, one into an invoice number that does not exist here
    const lines = 'transaction_ref,amount_sar,expense_status\nTXD-1,100,Approved\nTXM-1,100,Approved';
    const gates = 'transaction_ref,txn_expense_status,invoice_issuing_raw\nTXD-1,Ready,Issued ' + delNo + '\nTXM-1,Ready,Issued NO-SUCH-INVOICE-9';
    window.v65IngestText('lines.csv', lines); await new Promise(r => setTimeout(r, 1200));
    window.v65IngestText('gates.csv', gates); await new Promise(r => setTimeout(r, 2000));
    return (document.getElementById('finImpOut') || {}).innerText || '';
  }, picked.del);
  const delSaid = new RegExp(picked.del + '[\\s\\S]{0,160}(deleted|محذوفة)', 'i').test(joinNote);
  const missSaid = /NO-SUCH-INVOICE-9[\s\S]{0,160}(not a live invoice|import gap|ليست فاتورة)/i.test(joinNote);
  if (delSaid) ok('cost join: a transaction issuing into a DELETED invoice is reported as deleted here'); else fail('cost join did not say "deleted": ' + JSON.stringify(joinNote.replace(/\n/g, ' | ')));
  if (missSaid) ok('…and an invoice number this app has never seen is still reported as a likely import gap — two different problems, two messages'); else fail('cost join lost the "not a live invoice" message: ' + JSON.stringify(joinNote.replace(/\n/g, ' | ').slice(0, 400)));

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  if (realErrors.length) fail(realErrors.length + ' page error(s): ' + JSON.stringify(realErrors.slice(0, 3))); else ok('no page errors through the run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
