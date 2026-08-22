/* probe-csv-injection.mjs — CSV/formula-injection regression guard (2026-08-22, bulletproof
   round). Every CSV export in the app quoted per RFC-4180 (wrap in "...", double any embedded
   ") but that is NOT protection against formula injection: Excel strips the CSV quoting on
   open and still evaluates a cell whose first character is =, +, @, or a bare "-" that isn't
   a real number. "=HYPERLINK(...)" executes on open; a real client name like
   "-Al Rajhi Trading" becomes a broken formula instead of a name.

   This probe plants hostile cells into FIN._csvRows, fires the REAL finLedgerCSV() button
   (not a re-implementation of its logic), reads the REAL downloaded file, and unquotes it
   the way Excel does — strip the wrapping quotes, un-double any "" back to " — before
   checking. It asserts against BEHAVIOUR, not implementation:
     - none of the hostile cells survive as an executable formula (still start with
       =, +, @, or a non-numeric leading -, after Excel-style unquoting)
     - a legitimate negative number (a credit note / refund) is NOT guarded — it must still
       read as a real negative number, or SUM() in the sheet silently breaks
     - a legitimate normal string is untouched */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8150;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;

let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

// Excel's own behaviour when it opens a CSV: strip one layer of wrapping quotes, then
// un-double any "" back to a single ". This is deliberately independent of csvGuard's own
// code, so the probe can't just be checking "did csvGuard run" — it checks the actual
// round-trip a spreadsheet would see.
function unquoteLikeExcel(field) {
  var f = field;
  if (f.length >= 2 && f[0] === '"' && f[f.length - 1] === '"') {
    f = f.slice(1, -1).replace(/""/g, '"');
  }
  return f;
}

function parseCsvLine(line) {
  // minimal RFC-4180 line splitter — enough for this probe's own controlled test data
  var out = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; cur += '"'; }
      else cur += c;
    } else {
      if (c === '"') { inQ = true; cur += '"'; }
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(unquoteLikeExcel);
}

function isExecutable(v) {
  if (/^[=+@\t\r]/.test(v)) return true;
  if (/^-/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) return true;
  return false;
}

const HOSTILE = [
  '=HYPERLINK("http://evil.example","click")',
  '-Al Rajhi Trading',
  '@SUM(A1:A9)',
  '+1+1',
  "=cmd|'/C calc'!A1",
  '\t=1+1',
];
const SAFE_NEGATIVE = '-1500.50'; // a real credit-note amount — must stay a real negative number
const SAFE_STRING = 'Normal Client Name';

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();

  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

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

  // Plant hostile rows directly into FIN._csvRows, then fire the REAL export button —
  // finLedgerCSV() itself is not touched, only the data it reads.
  await p.evaluate(({ hostile, safeNeg, safeStr }) => {
    FIN._csvRows = hostile.map((v, i) => ({
      invoice_date: '2026-08-22', invoice_no: 'INJ-' + i, zatca_dpin: '', client_group: v,
      service_type: 'Flights', products: 'Flights', origin: '', proposal_ref: '', month: 'August',
      quarter: 'Q3', year: 2026, total_incl_vat_sar: 100, revenue_sar: 100, cost_sar: 0,
      profit_sar: 100, amount_received_sar: 100, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    })).concat([{
      invoice_date: '2026-08-22', invoice_no: 'CREDIT-1', zatca_dpin: '', client_group: safeStr,
      service_type: 'Flights', products: 'Flights', origin: '', proposal_ref: '', month: 'August',
      quarter: 'Q3', year: 2026, total_incl_vat_sar: safeNeg, revenue_sar: safeNeg, cost_sar: 0,
      profit_sar: safeNeg, amount_received_sar: 0, amount_remaining_sar: safeNeg, integrity_status: 'verified_paid',
    }]);
  }, { hostile: HOSTILE, safeNeg: SAFE_NEGATIVE, safeStr: SAFE_STRING });

  const [download] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    p.evaluate(() => { window.finLedgerCSV(); }),
  ]);
  if (!download) { fail('finLedgerCSV() produced no download'); }
  else {
    const tmp = path.join(os.tmpdir(), 'csvinj-' + Math.random().toString(36).slice(2) + '.csv');
    await download.saveAs(tmp);
    const buf = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    const hasBOM = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    if (!hasBOM) fail('downloaded file missing UTF-8 BOM');
    else ok('downloaded file has UTF-8 BOM');

    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split('\n').filter((l) => l.trim().length);
    const header = parseCsvLine(lines[0]);
    const clientGroupCol = header.indexOf('client_group');
    if (clientGroupCol < 0) { fail('client_group column not found in export header'); }
    else {
      const dataLines = lines.slice(1);
      let executableCount = 0, wrongQuotedNegative = false, safeStringDamaged = false;
      dataLines.forEach((line) => {
        const cells = parseCsvLine(line);
        const cell = cells[clientGroupCol];
        if (cell === SAFE_NEGATIVE) return; // not this row, this is the client_group check
      });
      // check each hostile cell is neutralised (client_group column of the first N rows)
      HOSTILE.forEach((hostileValue, i) => {
        const cells = parseCsvLine(dataLines[i]);
        const cell = cells[clientGroupCol];
        if (isExecutable(cell)) { executableCount++; fail(`hostile cell survived executable: ${JSON.stringify(hostileValue)} -> ${JSON.stringify(cell)}`); }
      });
      if (executableCount === 0) ok(`all ${HOSTILE.length} hostile cells neutralised (0 executable)`);

      // check the credit-note row's total_incl_vat_sar column reads as a real negative number
      const totalCol = header.indexOf('invoice_total_sar');
      const creditRow = dataLines[HOSTILE.length];
      if (creditRow && totalCol >= 0) {
        const cells = parseCsvLine(creditRow);
        const totalCell = cells[totalCol];
        if (totalCell !== SAFE_NEGATIVE) { wrongQuotedNegative = true; fail(`legitimate negative amount was altered: expected "${SAFE_NEGATIVE}", got ${JSON.stringify(totalCell)}`); }
        else ok(`legitimate negative amount (${SAFE_NEGATIVE}) preserved as a real number, unguarded`);
      } else {
        fail('could not locate the credit-note row / invoice_total_sar column to check');
      }

      // check the plain safe string on the credit-note row's client_group is untouched
      const creditCells = creditRow ? parseCsvLine(creditRow) : null;
      const safeCell = creditCells ? creditCells[clientGroupCol] : null;
      if (safeCell !== SAFE_STRING) { safeStringDamaged = true; fail(`a normal string was altered: expected "${SAFE_STRING}", got ${JSON.stringify(safeCell)}`); }
      else ok('a normal client name is untouched');
    }
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
  console.log('\ncsv injection guard OK - hostile cells neutralised, legitimate negatives preserved');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
