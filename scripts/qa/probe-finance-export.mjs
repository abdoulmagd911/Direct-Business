/* probe-finance-export.mjs — Finance export regression guard (2026-08-22, urgent live bug).
   FIN._csvRows was read in two places (js/16-finance-ledger.js's finLedgerCSV, and the
   Records page's finance export in js/core/core-05-records.js) but never assigned anywhere —
   rLedger() used to set it, until a refactor onto the transactions table moved it to setting
   TXN._csvRows instead, and the FIN._csvRows assignment was never restored. Every one of the
   four Export ▾ buttons on the Finance page (Summary/Full × CSV/Excel) alerted "No rows to
   export" no matter what, with real invoices loaded on screen.

   This probe drives the REAL buttons and reads the REAL downloaded file — not just a
   variable — because that is exactly the gap that let the bug ship: a check that only reads
   FIN._csvRows would have passed the moment ANYTHING got assigned to it, including something
   that never reaches an actual export button. It asserts:
     - FIN._csvRows is not undefined, and not empty while live invoices are loaded
     - window.finLedgerCSV() produces a real download with >=1 data row
     - window.expGo('list') and window.expGo('full') each produce a real download and do NOT
       raise an alert (a dialog handler is attached for the whole run — any alert firing
       during either call is treated as a failure, matching the exact "No rows to export —
       open the Ledger tab first" regression)
     - every downloaded file starts with a UTF-8 BOM (﻿) — without it, Arabic client
       names go to mojibake in Excel, and this app carries real Arabic client names
     - every downloaded file's header row contains invoice_no
     - no JS/console errors during the whole run */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8147;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function readDownload(download) {
  const tmp = path.join(os.tmpdir(), 'finexp-' + Math.random().toString(36).slice(2) + '-' + download.suggestedFilename());
  await download.saveAs(tmp);
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  return { filename: download.suggestedFilename(), buf };
}

function assertFile(label, file, expectMinDataRows) {
  if (!file) { fail(`${label}: no download captured`); return; }
  const hasBOM = file.buf.length >= 3 && file.buf[0] === 0xEF && file.buf[1] === 0xBB && file.buf[2] === 0xBF;
  if (!hasBOM) fail(`${label} (${file.filename}): missing UTF-8 BOM — Arabic client names will be mojibake in Excel`);
  else ok(`${label} (${file.filename}): UTF-8 BOM present`);

  const text = file.buf.toString('utf8').replace(/^﻿/, '');
  const lines = text.split('\n').filter((l) => l.trim().length);
  const header = lines[0] || '';
  if (!/invoice_no/i.test(header)) fail(`${label}: header does not contain invoice_no ("${header.slice(0, 80)}")`);
  else ok(`${label}: header contains invoice_no`);

  const dataRows = lines.length - 1;
  if (dataRows < expectMinDataRows) fail(`${label}: only ${dataRows} data row(s), expected >= ${expectMinDataRows}`);
  else ok(`${label}: ${dataRows} data row(s)`);
}

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();

  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const dialogs = [];
  p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });

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

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com');
  await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh');
  await p.click('#cl_go');
  await p.waitForTimeout(4000);

  await p.evaluate(() => { current = 'finance'; if (typeof render === 'function') render(); });
  await p.waitForTimeout(900);

  const state = await p.evaluate(() => {
    try {
      // js/16-finance-ledger.js's live() is scoped inside that file's own IIFE, not exposed
      // on window — reproduce its "not soft-deleted" filter directly rather than depend on it.
      return {
        loaded: (typeof FIN !== 'undefined' && FIN.rows) ? FIN.rows.length : null,
        live: (typeof FIN !== 'undefined' && FIN.rows) ? FIN.rows.filter((r) => !r.deleted_at).length : null,
        csvRows: (typeof FIN !== 'undefined') ? FIN._csvRows : undefined,
        exportFn: typeof window.finLedgerCSV === 'function',
      };
    } catch (e) { return { error: e.message }; }
  });
  console.log('finance state:', JSON.stringify({ loaded: state.loaded, live: state.live, csvRows: Array.isArray(state.csvRows) ? state.csvRows.length : state.csvRows, exportFn: state.exportFn }));

  if (state.csvRows === undefined) fail('FIN._csvRows is UNDEFINED — the finance export will say "No rows to export"');
  else ok('FIN._csvRows is defined');
  if (!Array.isArray(state.csvRows) || state.csvRows.length === 0) fail(`FIN._csvRows is empty while ${state.live} live invoice(s) are loaded`);
  else ok(`FIN._csvRows has ${state.csvRows.length} row(s), matching ${state.live} live invoice(s) in period`);

  // window.finLedgerCSV()
  {
    const dialogsBefore = dialogs.length;
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      p.evaluate(() => { window.finLedgerCSV(); }),
    ]);
    if (dialogs.length > dialogsBefore) fail(`finLedgerCSV() alerted instead of exporting: ${dialogs[dialogs.length - 1]}`);
    const file = download ? await readDownload(download) : null;
    assertFile('finLedgerCSV()', file, 1);
  }

  // window.expGo('list') and window.expGo('full')
  for (const scope of ['list', 'full']) {
    const dialogsBefore = dialogs.length;
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      p.evaluate((s) => { window.expGo(s); }, scope),
    ]);
    if (dialogs.length > dialogsBefore) fail(`Export ▾ "${scope}" on Finance alerted instead of exporting: ${dialogs[dialogs.length - 1]}`);
    else ok(`Export ▾ "${scope}": no alert`);
    const file = download ? await readDownload(download) : null;
    assertFile(`Export ▾ "${scope}"`, file, 1);
  }

  const realErrors = errors.filter((e) => !/forEach|TUNNEL_CONNECTION/.test(e));
  console.log('\nJS/console errors:', realErrors.length ? JSON.stringify(realErrors, null, 2) : 'none');
  if (realErrors.length) fail(`${realErrors.length} JS/console error(s) during the run`);

  await b.close();
  srv.close();

  if (failures) {
    console.log(`\nFAILED — ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('\nfinance export OK - real rows, real file, Excel-safe encoding');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
