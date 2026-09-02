/* probe-import-hostile-shapes.mjs — importer premortem #2 (2026-09-02, attack round 14), on the
   teach-once (mapped) path: hostile-but-plausible cell shapes a hand-made spreadsheet brings.
   Before this round: an amount typed with Arabic-Indic digits became 0 (silently), an
   accounting negative "(500)" lost its sign, a European "1.250,50" read as 1.25, a
   "2026/06/15" or "15-06-2026" date became no date at all, a US "06/15/2026" became month 15
   and quarter "Q5", and two rows with one reference number in the same file failed the whole
   commit at the database's unique key with no row named. Drives the REAL ingest → preview →
   confirm and reads the REAL mock table:
     R1 "١٬٢٥٠٫٥٠"  → 1250.50      R2 "(500)"     → -500 (a credit note stays negative)
     R3 "1.250,50"  → 1250.50      R4 "SAR 1,000" → 1000
     R5 date 2026/06/15 → June/Q2  R6 15-06-2026 → June/Q2   R7 06/15/2026 → June/Q2 (never Q5)
     R8 duplicate reference in the file → ONE row stored, the duplicate named for manual review
     R9 a whitespace-only row → skipped, nothing crashes
   Sabotage: revert moneyG/isoDateG or the in-file duplicate check in js/65 → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8331;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const inv = async (n) => fetch(BASE + '/rest/v1/finance_invoices?invoice_no=eq.' + n).then((r) => r.json());

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

  // the file's columns, taught once (the same shape the teach-once dialog stores)
  const header = ['Ref', 'Customer', 'Date', 'Total', 'Cost'];
  await p.evaluate((header) => {
    DB.settings = DB.settings || {}; DB.settings.importSignatureMappings = DB.settings.importSignatureMappings || [];
    DB.settings.importSignatureMappings.push({ key: header.slice().map((h) => h.trim()).sort().join('|'), header, mapping: { invoice_no: 'Ref', customer_raw_name: 'Customer', invoice_date: 'Date', total_incl_vat_sar: 'Total', cost_sar: 'Cost' }, addedBy: 'probe', addedAt: new Date().toISOString() });
  }, header);

  const csv = [
    'Ref,Customer,Date,Total,Cost',
    'HS-1,Test Company 1,2026-06-15,"١٬٢٥٠٫٥٠",100',
    'HS-2,Test Company 1,2026-06-15,(500),0',
    'HS-3,Test Company 1,2026-06-15,"1.250,50",100',
    'HS-4,Test Company 1,2026-06-15,SAR 1,100'.replace('SAR 1,100', '"SAR 1,000",100'),
    'HS-5,Test Company 2,2026/06/15,200,50',
    'HS-6,Test Company 2,15-06-2026,200,50',
    'HS-7,Test Company 2,06/15/2026,200,50',
    'HS-8,Test Company 3,2026-06-15,300,10',
    'HS-8,Test Company 3,2026-06-15,999,10',
    '   ,   ,   ,   ,   ',
    '',
  ].join('\n');
  await p.evaluate((t) => window.v65IngestText('hostile.csv', t), csv);
  await p.waitForTimeout(1800);
  const preview = await p.evaluate(() => (document.getElementById('finImpOut') || {}).innerText || '');
  if (/HS-8/.test(preview) && /more than once in this file|يتكرر في هذا الملف/.test(preview)) ok('R8: the duplicate reference is named in the preview for manual review');
  else fail('R8: the preview does not name the in-file duplicate — ' + JSON.stringify(preview.slice(0, 300)));
  if (/Q5|NaN|undefined/.test(preview)) fail('preview shows Q5/NaN/undefined: ' + JSON.stringify(preview.match(/.{0,40}(Q5|NaN|undefined).{0,40}/)[0]));

  const clicked = await p.evaluate(() => { const bt = [...document.querySelectorAll('#finImpOut button')].find((x) => /Confirm|Save|تأكيد/i.test(x.textContent)); if (bt) { bt.click(); return bt.textContent.trim(); } return null; });
  await p.waitForTimeout(2500);
  if (!clicked) fail('no confirm button appeared on the preview');
  else ok('preview offered a confirm button — "' + clicked + '"');

  const want = { 'HS-1': 1250.5, 'HS-2': -500, 'HS-3': 1250.5, 'HS-4': 1000 };
  for (const [no, exp] of Object.entries(want)) {
    const rows = await inv(no);
    const got = rows[0] ? Number(rows[0].total_incl_vat_sar) : null;
    if (rows.length === 1 && Math.abs(got - exp) < 0.005) ok(`${no}: total stored as ${got}`);
    else fail(`${no}: expected ${exp}, table has ${rows.length} row(s) with total ${got}`);
  }
  for (const no of ['HS-5', 'HS-6', 'HS-7']) {
    const rows = await inv(no); const r = rows[0] || {};
    if (rows.length === 1 && r.invoice_date === '2026-06-15' && r.month === 'June' && r.quarter === 'Q2') ok(`${no}: date read as 2026-06-15 → June / Q2`);
    else fail(`${no}: date "${r.invoice_date}" month "${r.month}" quarter "${r.quarter}" (${rows.length} row(s))`);
  }
  const dup = await inv('HS-8');
  if (dup.length === 1 && Number(dup[0].total_incl_vat_sar) === 300) ok('R8: one row stored for the duplicated reference, the FIRST row (300), not the later one');
  else fail('R8: duplicated reference stored ' + dup.length + ' row(s), totals ' + dup.map((r) => r.total_incl_vat_sar).join(','));
  const blank = await fetch(BASE + '/rest/v1/finance_invoices').then((r) => r.json()).then((a) => a.filter((r) => !String(r.invoice_no || '').trim()).length);
  if (blank === 0) ok('R9: the whitespace-only row created nothing');
  else fail('R9: ' + blank + ' blank-reference row(s) stored');

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors / dialogs:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)/dialog(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nimport-hostile-shapes OK — hostile cells read right or are named for review, never silently zero');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
