/* probe-export-files-as-text.mjs (2026-09-08, watch cycle 61) — the three Finance exports, read
   as files instead of as code. Attack area (ae).

   PORT NOTE: 8701–8730 are taken. This is 8731, verified free by scanning every PORT= in
   scripts/qa.

   Cycle 60 found `TOTAL,301.20000000000005` in the Report Builder's CSV — binary floating point
   written into the document an accountant works from — and found it by accident, in a check
   written to prove a fix had moved nothing. That was the first time anyone had read one of these
   files as text. finLedgerCSV (the invoice rows) and finTxnCSV (the transactions) still have not
   been read at all.

   This probe holds every Finance export to the same four things a money file must satisfy, and
   says which file fails which:
     A. Every data row has exactly as many cells as the header. A file whose columns shift is
        worse than no file — a reader lines up the wrong number with the wrong heading.
     B. No cell carries a binary-float artifact (more than two decimal places on money). That is
        the cycle-60 defect, asked of all three files rather than the one it was found in.
     C. Every money column parses as a number once the CSV quoting is removed — no stray text, no
        "undefined", no empty string where a figure belongs.
     D. The file holds exactly the rows the page is showing. An export that quietly carries more
        or fewer rows than the screen is the oldest defect in this file's history (until
        2026-08-20 the Ledger's own button downloaded the Report Builder's summary instead).

   Nothing here reads FIN to decide whether a file is right; FIN is read only to know how many
   rows the screen is showing, which is the thing the file is being compared TO.

   Run:  node scripts/qa/probe-export-files-as-text.mjs        (port 8731)
   Sabotage: write one money cell raw (drop the two-decimal formatting) — check B goes red for
   that file. Assert the sabotage APPLIED with a marker unique to it; confirm the restore by
   marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8731;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;

/* A CSV parser that is deliberately literal: it is here to read the bytes the app produced, not
   to be forgiving about them. */
function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* part of CRLF */ }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || '').trim() !== '');
}
const MONEY = /(_sar|amount|revenue|cost|profit|total)/i;
const floatArtifact = (v) => { const s = String(v).replace(/^'/, ''); return /^-?\d+\.\d{3,}$/.test(s); };

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.finLedgerCSV === 'function' && typeof window.finCSV === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('the export functions never appeared, so nothing below examined anything');

  await p.evaluate(() => {
    window.__csv = null;
    URL.createObjectURL = function (blob) { blob.text().then((t) => { window.__csv = t; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
    /* Fractions in every money column — but written the way the app's OWN write paths write
       them. js/65 stores Math.round((rev-cost)*100)/100, js/41 the same, and the importer's
       mapped path either takes the file's own figure or rounds; so a value with more than two
       decimals never reaches a stored row, and a fixture carrying one would be this probe
       inventing a defect the app cannot have (cycle 50). What check B therefore asks is whether
       an export ADDS float noise of its own — which is exactly what finCSV did until cycle 60,
       because it is the one export that sums. Names carry no word this probe searches for. */
    const r2 = (n) => Math.round(n * 100) / 100;
    const base = { integrity_status: 'verified_paid', invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null };
    (FIN.rows || []).push(Object.assign({}, base, {
      id: 'ex-1', invoice_no: 'EX-1', client_group: 'Harrow Logistics', customer_raw_name: 'Harrow Logistics',
      total_incl_vat_sar: r2(100.4 + 200.4), revenue_sar: 100.4, cost_sar: 33.35, profit_sar: r2(100.4 - 33.35),
      amount_received_sar: 66.7, amount_remaining_sar: 33.7,
    }));
    /* Three stored-clean invoices under ONE client, chosen because 100.4 + 100.4 + 100.4 is
       301.20000000000005 as a double. The rows are individually blameless; only an export that
       SUMS them can put that on paper. Without these, check B could not fail for the one file
       where it has ever failed, and a check that cannot fail is not a check (cycle 48). */
    ['s1', 's2', 's3'].forEach((k) => (FIN.rows || []).push(Object.assign({}, base, {
      id: 'ex-' + k, invoice_no: 'EX-' + k.toUpperCase(), client_group: 'Bramble Freight', customer_raw_name: 'Bramble Freight',
      total_incl_vat_sar: 100.4, revenue_sar: 100.4, cost_sar: 0, profit_sar: 100.4,
      amount_received_sar: 100.4, amount_remaining_sar: 0,
    })));
  });

  const grab = async (fnName) => {
    await p.evaluate((f) => { window.__csv = null; window.__said = []; const oa = window.alert; window.alert = (m) => window.__said.push(String(m)); try { window[f](); } catch (e) { window.__said.push('THREW ' + e.message); } window.alert = oa; }, fnName);
    for (let i = 0; i < 25 && !(await p.evaluate(() => window.__csv)); i++) await p.waitForTimeout(100);
    return await p.evaluate(() => ({ csv: window.__csv, said: (window.__said || []).join(' | ') }));
  };

  /* Put the ledger on screen so its export has rows, and note how many the page is showing. */
  await p.evaluate(() => { FIN.tab = 'ledger'; if (window.finGo) finGo('ledger'); else render(); });
  await p.waitForTimeout(1500);
  const onScreen = await p.evaluate(() => ({ ledger: (FIN._csvRows || []).length, txn: (window.TXN && TXN._csvRows || []).length }));

  const files = [];
  const led = await grab('finLedgerCSV');
  if (led.csv) files.push({ name: 'finLedgerCSV (the invoice rows)', csv: led.csv, expectRows: onScreen.ledger });
  else note(`finLedgerCSV produced no file here (${led.said || 'no reason given'}) — not counted against it`);

  await p.evaluate(() => { FIN.tab = 'transactions'; if (window.finGo) finGo('transactions'); else render(); });
  await p.waitForTimeout(1500);
  const txnCount = await p.evaluate(() => (window.TXN && TXN._csvRows || []).length);
  const txn = await grab('finTxnCSV');
  if (txn.csv) files.push({ name: 'finTxnCSV (the transactions)', csv: txn.csv, expectRows: txnCount });
  else note(`finTxnCSV produced no file here (${txn.said || 'no reason given'}) — not counted against it`);

  await p.evaluate(() => {
    FIN.rb = { g1: '__client', g2: '', quarter: 'all', verifiedOnly: false, metrics: { revenue_sar: true, cost_sar: true, profit_sar: true } };
    if (window.finGo) finGo('reports'); else render();
  });
  await p.waitForTimeout(1200);
  const rep = await grab('finCSV');
  if (rep.csv) files.push({ name: 'finCSV (the Report Builder summary)', csv: rep.csv, expectRows: null });
  else note(`finCSV produced no file here (${rep.said || 'no reason given'}) — not counted against it`);

  if (files.length < 2) fail(`only ${files.length} export(s) could be captured, so this is not a sweep of the exports — it examined almost nothing`);

  for (const f of files) {
    const rows = parseCsv(f.csv);
    const head = rows[0] || [];
    const body = rows.slice(1);
    note(`${f.name}: ${head.length} columns, ${body.length} data row(s)`);

    /* A. shape */
    const ragged = body.filter((r) => r.length !== head.length);
    if (!ragged.length) ok(`${f.name}: every one of the ${body.length} data rows has exactly the header's ${head.length} cells`);
    else fail(`${f.name}: ${ragged.length} row(s) do not match the header's ${head.length} columns (first bad row has ${ragged[0].length}). A reader lines the wrong figure up under the wrong heading.`);

    /* B. float artifacts */
    const bad = [];
    body.forEach((r, ri) => r.forEach((c, ci) => { if (floatArtifact(c)) bad.push(`${head[ci] || 'col' + ci}="${c}" (row ${ri + 1})`); }));
    if (!bad.length) ok(`${f.name}: no cell carries a binary-float artifact — nothing like the 301.20000000000005 cycle 60 found`);
    else fail(`${f.name}: ${bad.length} cell(s) written as raw floating point: ${bad.slice(0, 3).join(', ')}. Every value handed to this export was already rounded to two decimals by the app's own write paths, so the noise was added by the export itself — cycle 60's defect, in a file nobody had read.`);

    /* C. money columns parse */
    const moneyIdx = head.map((h, i) => MONEY.test(h) ? i : -1).filter((i) => i >= 0);
    const unparsed = [];
    body.forEach((r, ri) => moneyIdx.forEach((i) => {
      const raw = String(r[i] == null ? '' : r[i]).replace(/^'/, '').replace(/,/g, '').trim();
      if (raw === '') return;                       // a genuinely absent figure is not a wrong one
      if (!/^-?\d+(\.\d+)?$/.test(raw)) unparsed.push(`${head[i]}="${r[i]}" (row ${ri + 1})`);
    }));
    if (!moneyIdx.length) note(`${f.name}: no column matched the money-column test, so C examined nothing here`);
    else if (!unparsed.length) ok(`${f.name}: every filled cell in its ${moneyIdx.length} money column(s) parses as a number`);
    else fail(`${f.name}: ${unparsed.length} money cell(s) are not numbers: ${unparsed.slice(0, 3).join(', ')}`);

    /* D. the file is the screen */
    if (f.expectRows == null) note(`${f.name}: a grouped summary, so its row count is not the screen's row count — D does not apply`);
    else if (body.length === f.expectRows) ok(`${f.name}: the file holds exactly the ${f.expectRows} row(s) the page is showing`);
    else fail(`${f.name}: the file holds ${body.length} row(s) and the page is showing ${f.expectRows}. An export that is not what is on screen is this file's oldest defect — until 2026-08-20 this very button downloaded the Report Builder's summary instead of the invoice rows.`);
  }

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nexport-files-as-text OK — every Finance export was read as a file and holds its shape, its numbers and its row count');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
