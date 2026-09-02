/* probe-importer-attacks.mjs (2026-09-02, watch cycle 5) — adversarial pass over the Universal
   Importer's teach-once (mapped) path, driven end to end: ingest → five-count preview → Confirm
   → the mock's finance_invoices table, which since this cycle applies the LIVE database trigger
   finance_derive_fields() (revenue = total − wallet, profit = revenue − cost, month/quarter from
   the date) exactly as Postgres does. What the harness stored before was whatever the client
   sent, so a client that derives money differently from the database looked fine here and was
   not on the real table.
   Rules under test:
     1. Money doctrine on a mapped row: what lands equals what the trigger will store — revenue is
        never profit, profit = revenue − cost, VAT never enters any of the three (vat_sar stays 0:
        this path does not know the file's VAT split and never guesses 15%).
     2. Idempotency: re-dropping the SAME file reports 0 new · 0 updated · N unchanged, and Confirm
        is not offered (there is no "importing twice"). Before this cycle every mapped row with a
        cost re-imported as "updated" for ever, because the client sent revenue = profit and the
        database kept revenue = total — a history entry per invoice per re-drop, for nothing.
     3. A real change (one total edited) is exactly 1 updated, the rest unchanged; after Confirm the
        table carries the new total and a re-derived profit.
     4. The exclusion rule holds on the mapped path: the excluded partner's row never lands, and the
        preview names it with the client id and the reason.
     5. A row with no usable date lands with a null date and no month/quarter — never a guessed
        period, never a crash; a row with no reference is skipped and creates nothing.
     6. A binary file renamed .csv is refused with the honest message and no preview counts.
     7. The preview's "Confirm import — N new, M updated" equals what the database then reports.
   Run:  node scripts/qa/probe-importer-attacks.mjs     (port 8195)
   Sabotage: in js/65 buildGenericRow, set revenue_sar back to `profit` → check 1 and 2 go red;
   in mock-supabase.mjs drop deriveFinanceInvoice from the RPC → check 1 goes red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8195; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const inv = async (n) => fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + encodeURIComponent(n)).then((r) => r.json());
const allInv = async () => fetch(BASE + '/rest/v1/finance_invoices').then((r) => r.json());

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
  await p.waitForTimeout(6000);
  await p.evaluate(() => { current = 'finance'; render(); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(800);

  const header = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  await p.evaluate((header) => {
    DB.settings = DB.settings || {}; DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map((h) => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, header);
  const previewText = () => p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  const counts = async () => {
    const t = await previewText();
    const m = t.match(/New\s+(\d+)\s*·\s*Updated\s+(\d+)\s*·\s*Unchanged\s+(\d+)\s*·\s*Excluded by rule\s+([^·]+?)\s*·\s*Needs linking\s+(\d+)/);
    return m ? { isNew: +m[1], updated: +m[2], unchanged: +m[3], excluded: m[4].trim(), needsLinking: +m[5], text: t } : { text: t };
  };
  const confirmBtn = () => p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm import|تأكيد الاستيراد/i.test(x.textContent)); return bt ? bt.textContent.trim() : null; });
  const clickConfirm = async () => { await p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm import|تأكيد الاستيراد/i.test(x.textContent)); if (bt) bt.click(); }); await p.waitForTimeout(2500); return previewText(); };
  const ingest = async (name, csv) => { await p.evaluate(({ name, csv }) => window.v65IngestText(name, csv), { name, csv }); await p.waitForTimeout(1800); };
  const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

  /* ---------- 1. first drop: doctrine on the mapped path ---------- */
  const fileA = [
    'Ref,Customer,Date,Total,Cost',
    'IA-1,Test Company 1,2026-06-15,"1,000.00",100',          // cost → profit 900, revenue must stay 1000
    'IA-2,Test Company 2,2026-06-16,500,0',                    // no cost
    'IA-3,Takamol for Business Services,2026-06-16,300,0',     // excluded partner (seed exclusion list)
    'IA-4,Test Company 2,,250,50',                             // no date at all
    ',Test Company 2,2026-06-17,999,0',                        // no reference → nothing to key
    'IA-5,Test Company 3,2026-06-18,"(200)",0',                // credit-shaped negative stays negative
  ].join('\n');
  await ingest('mapped-a.csv', fileA);
  let c = await counts();
  if (c.isNew === 4 && c.updated === 0 && c.unchanged === 0 && c.needsLinking >= 0) ok(`first drop preview: New 4 · Updated 0 · Unchanged 0 (IA-1, IA-2, IA-4, IA-5)`); else fail('first drop preview counts wrong: ' + JSON.stringify(c));
  if (/Takamol for Business Services \(#7: Takamol/.test(c.text)) ok('excluded partner named in the preview with client id and reason (never silent)'); else fail('exclusion not named in preview: ' + JSON.stringify(c.text.slice(0, 400)));
  if (/Excluded by rule\s+1\b/.test(c.text)) ok('Excluded by rule = 1'); else fail('Excluded by rule count not 1');
  if (!/NaN|undefined|Q5|Invalid Date/.test(c.text)) ok('no NaN / undefined / Q5 in the preview'); else fail('preview carries NaN/undefined/Q5');
  let btn = await confirmBtn();
  if (btn && /4 new, 0 updated/.test(btn)) ok(`confirm button says what will be written — "${btn}"`); else fail('confirm button text: ' + btn);
  let done = await clickConfirm();
  if (/Done\.\s*Imported 4 new, updated 0\./.test(done)) ok('database reported exactly the preview\'s numbers: 4 new, 0 updated (M13)'); else fail('commit message: ' + JSON.stringify(done.slice(0, 200)));

  const r1 = (await inv('IA-1'))[0] || {};
  if (near(r1.total_incl_vat_sar, 1000) && near(r1.revenue_sar, 1000) && near(r1.cost_sar, 100) && near(r1.profit_sar, 900)) ok('IA-1 landed as the database keeps it: total 1000 · revenue 1000 · cost 100 · profit 900 (revenue is never profit)'); else fail(`IA-1 stored total ${r1.total_incl_vat_sar} revenue ${r1.revenue_sar} cost ${r1.cost_sar} profit ${r1.profit_sar}`);
  if (near(r1.vat_sar, 0) && near(r1.wallet_portion_sar, 0)) ok('IA-1: vat_sar 0 and wallet 0 — the mapped path never guesses a VAT split'); else fail(`IA-1 vat ${r1.vat_sar} wallet ${r1.wallet_portion_sar}`);
  if (r1.month === 'June' && r1.quarter === 'Q2' && r1.integrity_status === 'pending' && near(r1.amount_remaining_sar, 1000)) ok('IA-1: June / Q2, pending, fully outstanding until reconciled'); else fail(`IA-1 month ${r1.month} q ${r1.quarter} status ${r1.integrity_status} remaining ${r1.amount_remaining_sar}`);
  const r4 = (await inv('IA-4'))[0] || {};
  if (r4.invoice_no === 'IA-4' && r4.invoice_date == null && r4.month == null && r4.quarter == null) ok('IA-4 (no date) landed with null date and NO month/quarter — never a guessed period'); else fail(`IA-4 date ${r4.invoice_date} month ${r4.month} quarter ${r4.quarter}`);
  const r5 = (await inv('IA-5'))[0] || {};
  if (near(r5.total_incl_vat_sar, -200) && near(r5.revenue_sar, -200) && near(r5.profit_sar, -200)) ok('IA-5 (200) stays a negative 200 through total, revenue and profit'); else fail(`IA-5 total ${r5.total_incl_vat_sar} revenue ${r5.revenue_sar} profit ${r5.profit_sar}`);
  if ((await inv('IA-3')).length === 0) ok('IA-3 (excluded partner) never reached the table'); else fail('excluded partner row was written');
  const blank = (await allInv()).filter((r) => !String(r.invoice_no || '').trim()).length;
  if (blank === 0) ok('the reference-less row created nothing'); else fail(blank + ' blank-reference row(s) written');

  /* ---------- 2. same file again: nothing to do ---------- */
  await p.waitForTimeout(1500); // finLoad() after commit
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(600);
  await ingest('mapped-a.csv', fileA);
  c = await counts();
  if (c.isNew === 0 && c.updated === 0 && c.unchanged === 4) ok('re-dropping the same file: New 0 · Updated 0 · Unchanged 4 — there is no "importing twice"'); else fail('re-drop is not idempotent: ' + JSON.stringify({ isNew: c.isNew, updated: c.updated, unchanged: c.unchanged }));
  btn = await confirmBtn();
  if (!btn) ok('no Confirm button offered when nothing would change'); else fail('Confirm offered on an unchanged re-drop: ' + btn);
  if (/Excluded by rule\s+1\b/.test(c.text)) ok('the excluded partner is still named on the re-drop (exclusion is at import, every time)'); else fail('exclusion count missing on re-drop');

  /* ---------- 3. one real change ---------- */
  const fileB = fileA.replace('IA-2,Test Company 2,2026-06-16,500,0', 'IA-2,Test Company 2,2026-06-16,650,120');
  await ingest('mapped-b.csv', fileB);
  c = await counts();
  if (c.isNew === 0 && c.updated === 1 && c.unchanged === 3) ok('one edited total: New 0 · Updated 1 · Unchanged 3'); else fail('edited-file preview wrong: ' + JSON.stringify({ isNew: c.isNew, updated: c.updated, unchanged: c.unchanged }));
  btn = await confirmBtn();
  if (btn && /0 new, 1 updated/.test(btn)) ok(`confirm button — "${btn}"`); else fail('confirm button text: ' + btn);
  done = await clickConfirm();
  if (/Imported 0 new, updated 1\./.test(done)) ok('database reported 0 new, 1 updated — matches the preview'); else fail('commit message: ' + JSON.stringify(done.slice(0, 200)));
  const r2 = (await inv('IA-2'));
  if (r2.length === 1 && near(r2[0].total_incl_vat_sar, 650) && near(r2[0].revenue_sar, 650) && near(r2[0].cost_sar, 120) && near(r2[0].profit_sar, 530)) ok('IA-2 updated in place: one row, total 650 · revenue 650 · cost 120 · profit 530'); else fail('IA-2 after update: ' + JSON.stringify(r2.map((r) => [r.total_incl_vat_sar, r.revenue_sar, r.cost_sar, r.profit_sar])));
  await p.waitForTimeout(1500);
  await p.evaluate(() => { if (typeof window.finGo === 'function') window.finGo('import'); }); await p.waitForTimeout(600);
  await ingest('mapped-b.csv', fileB);
  c = await counts();
  if (c.isNew === 0 && c.updated === 0 && c.unchanged === 4) ok('and the edited file re-dropped is fully unchanged again'); else fail('edited file not idempotent on second drop: ' + JSON.stringify({ isNew: c.isNew, updated: c.updated, unchanged: c.unchanged }));

  /* ---------- 4. binary renamed .csv ---------- */
  const bin = 'PK\x03\x04\x01\x02binary-not-a-csv\x07\x08Ref,Customer,Date,Total,Cost\nZZ-1,Test Company 1,2026-06-15,10,0';
  await ingest('report.xlsx.csv', bin);
  const t4 = await previewText();
  if (/binary file \(PDF, Excel or zip\)/.test(t4) && /not recognized/.test(t4)) ok('a binary file renamed .csv is refused with the honest message'); else fail('binary file not refused: ' + JSON.stringify(t4.slice(0, 300)));
  if (!/New\s+\d/.test(t4)) ok('no preview counts offered for the binary file'); else fail('binary file produced preview counts');
  if ((await inv('ZZ-1')).length === 0) ok('nothing from the binary file reached the table'); else fail('binary file row written');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  if (realErrors.length) fail(realErrors.length + ' JS error(s)/dialog(s): ' + JSON.stringify(realErrors.slice(0, 3))); else ok('no page errors or dialogs through the whole run');
  console.log(failures === 0 ? '\nALL PASS' : '\n' + failures + ' FAILURE(S)');
  await b.close(); srv.close();
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
