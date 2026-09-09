/* probe-import-files-count.mjs (2026-09-09, live test finding F3) — the importer's headline
   counts the files a PERSON dropped, not the results the importer built for itself.
   Attack area (ad).

   PORT NOTE: 8701–8749 are taken. This is 8750, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: one expense file dropped, and the preview read
   "Files dropped: 2 · recognized: 2". The second "file" was the cost-join summary
   ("Expense report ↔ transactions ↔ tax invoices"), a result renderCombinedPreview builds from
   the dropped files — nobody dropped it. A person reads "2" and looks for the second file.

   Under test:
     1. One expense-lines file dropped → "Files dropped: 1 · recognized: 1", and the join is
        named separately ("plus the cost join built from them"), not counted as a file.
     2. The gate file dropped as a second, separate action → the preview is that drop's own
        ("Files dropped: 1 · recognized: 1" — each drop previews its own files; the earlier
        file's capture lives on in the join), the join still named and still not counted.
     3. The join card itself is still on screen (the fix changes the count, not the preview).
     4. An invoice export alone (no join) → "Files dropped: 1 · recognized: 1" with no join
        clause at all — the wording only appears when a join exists.

   Run:  node scripts/qa/probe-import-files-count.mjs        (port 8750)
   Sabotage: in renderCombinedPreview make _fileResults = results (count the join as a file) —
   checks 1 and 2 go red. Assert the sabotage APPLIED with a marker unique to it; confirm the
   restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8750;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
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

  const openImport = async () => {
    await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
    try {
      await p.waitForSelector('#cl_email', { timeout: 8000 });
      await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    } catch (_) { /* already signed in */ }
    await p.waitForFunction(() => window.FIN && typeof finGo === 'function', { timeout: 90000 });
    await p.evaluate(() => { current = 'finance'; finGo('import'); });
    await p.waitForSelector('#finFile', { timeout: 30000 });
    await p.waitForFunction(() => !!document.getElementById('finImpOut'), { timeout: 30000 });
  };
  /* The headline as the person reads it, plus the counts the line carries for the record. */
  const headline = () => p.evaluate(() => {
    const el = document.getElementById('v65-files-line');
    const o = document.getElementById('finImpOut');
    const txt = (o ? o.innerText : '').replace(/\s+/g, ' ').trim();
    const m = txt.match(/Files dropped: (\d+) · recognized: (\d+)/);
    return { files: m ? +m[1] : null, recognized: m ? +m[2] : null, joinClause: /plus the cost join/.test(txt), dataFiles: el && el.getAttribute('data-files'), dataJoins: el && el.getAttribute('data-joins'), joinCard: /Expense report ↔ transactions ↔ tax invoices/.test(txt), text: txt.slice(0, 200) };
  });

  const linesCsv = ['transaction_ref,amount_sar,expense_status', 'T1,750,Approved', 'T2,500,Approved'].join('\n');
  const gateCsv = ['transaction_ref,txn_expense_status,invoice_issuing_raw', 'T1,,Issued 116361000', 'T2,Ready,Issued 116361000'].join('\n');

  /* ---- 1. one expense file ---- */
  await openImport();
  await p.setInputFiles('#finFile', { name: 'expense-lines.csv', mimeType: 'text/csv', buffer: Buffer.from(linesCsv) });
  await p.waitForFunction(() => /Files dropped:/.test((document.getElementById('finImpOut') || {}).innerText || ''), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  let h = await headline();
  if (h.files === 1 && h.recognized === 1 && h.joinClause && h.dataJoins === '1')
    ok(`one expense file dropped → "Files dropped: 1 · recognized: 1", and the join is named, not counted ("${h.text.slice(0, 110)}…")`);
  else fail(`one expense file dropped → files=${h.files} recognized=${h.recognized} joinClause=${h.joinClause} joins=${h.dataJoins} — the live-site defect was "Files dropped: 2" for one file ("${h.text}")`);
  if (h.joinCard) ok('the join card ("Expense report ↔ transactions ↔ tax invoices") is still on screen — the count changed, not the preview');
  else fail(`the join card is missing from the preview: "${h.text}"`);

  /* ---- 2. the gate file as a second drop ---- */
  await p.setInputFiles('#finFile', { name: 'expense-gate.csv', mimeType: 'text/csv', buffer: Buffer.from(gateCsv) });
  await p.waitForFunction(() => /expense-gate\.csv/.test((document.getElementById('finImpOut') || {}).innerText || ''), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  h = await headline();
  if (h.files === 1 && h.recognized === 1 && h.joinClause && h.dataJoins === '1' && /expense-gate\.csv/.test(h.text))
    ok(`the gate file as a separate drop → "Files dropped: 1 · recognized: 1" for that drop, the join still named and still not counted`);
  else fail(`gate file as a second drop → files=${h.files} recognized=${h.recognized} joins=${h.dataJoins} ("${h.text}")`);

  /* ---- 4. an invoice export alone: no join, no clause ---- */
  const invCsv = ['Type,Product,Customer Name,Invoice Reference #,Invoice Number,Invoice Create Date,Invoice Status,Name,Item Is Taxable,Item Discount,Item Total,Invoice Total,Sale Branch,Salesman',
    'invoice,Direct Flights,Client X,REF-1,INV-1,05/08/2026 10:00:00 AM,Fully Paid,,,,,1000,Riyadh,QA',
    'item,Direct Flights,Client X,REF-1,,,,Work,No,0,1000,,,'].join('\n');
  await openImport();
  await p.setInputFiles('#finFile', { name: 'invoices.csv', mimeType: 'text/csv', buffer: Buffer.from(invCsv) });
  await p.waitForFunction(() => /Files dropped:/.test((document.getElementById('finImpOut') || {}).innerText || ''), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  h = await headline();
  if (h.files === 1 && h.recognized === 1 && !h.joinClause && h.dataJoins === '0')
    ok('an invoice export alone → "Files dropped: 1 · recognized: 1" and no join clause — the wording only appears when a join exists');
  else fail(`invoice export alone → files=${h.files} recognized=${h.recognized} joinClause=${h.joinClause} joins=${h.dataJoins} ("${h.text}")`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nimport-files-count OK — the importer counts the files a person dropped, and names the join it built');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
