/* probe-report-table-printed-arithmetic.mjs (2026-09-08, watch cycle 60) — the Report Builder's
   own columns, added up the way a person adds them up. Attack area (ad).

   PORT NOTE: 8701–8729 are taken. This is 8730, verified free by scanning every PORT= in
   scripts/qa.

   Cycle 59 found the drill-down printing 100 + 100 + 100 under a total printed 301, and found it
   only because it read the screen: the dedicated drill-down probe had compared FIN internals
   since cycle 22 and passed throughout. That is a class, not an incident. The same mechanism sits
   one level up, on the surface a manager actually reads.

   rReports() prints every group row with money0(g[k].__tot[m]) and the TOTAL row with
   money0(grand[m]), where grand is the sum of the RAW group totals — rounded independently. Three
   clients billing 100.40 each print as three rows of 100 under a TOTAL of 301. Sub-rows under a
   second grouping have exactly the same shape against their own group row.

   probe-report-builder-attacks proves the arithmetic of the numbers behind this table, to the
   hallala, at four groupings. It has never compared two printed figures to each other. Nothing
   below reads FIN except to prove the fix moved no money.

   Under test:
     1. Control — whole-riyal data: the printed group rows sum exactly to the printed TOTAL.
        (If this fails the probe is misreading the table and nothing below means anything.)
     2. THE DEFECT — fractional data: the printed rows must still sum to the printed TOTAL, or the
        screen must say why they cannot and give the exact figure.
     3. The same question one level in: with a second grouping, the printed sub-rows against their
        own printed group row.
     4. Nothing moved. The underlying grand total is unchanged, and the CSV still carries exact
        unrounded figures — a "fix" that rounded the export to match the screen would put the
        rounding into the file an accountant works from.

   Run:  node scripts/qa/probe-report-table-printed-arithmetic.mjs        (port 8730)
   Sabotage: remove the rounding note from rReports — checks 2 and 3 go red. Assert the sabotage
   APPLIED with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8730;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;

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
  if (!(await p.waitForFunction(() => typeof window.finRB === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finRB / FIN.rows never appeared, so nothing below examined anything');

  /* Only our own rows, so the printed sums are ours to predict. Fixture names carry no word this
     probe later searches the screen for (cycle 57: a fixture called "Metric Co" made a text
     search pass under sabotage). */
  const seed = (rows) => p.evaluate((rows) => {
    const base = { integrity_status: 'verified_paid', amount_received_sar: 0, amount_remaining_sar: 0, service_type: 'flights', record_type: 'invoice', deleted_at: null, quarter: 'Q1', year: 2026 };
    FIN.rows = rows.map((r, i) => Object.assign({}, base, {
      id: 'rt-' + i, invoice_no: 'RT-' + i, client_group: r.g, customer_raw_name: r.g,
      revenue_sar: r.v, cost_sar: 0, profit_sar: r.v, total_incl_vat_sar: r.v,
      invoice_date: r.d, month: r.m,
    }));
    URL.createObjectURL = function (blob) { blob.text().then((t) => { window.__csv = t; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
  }, rows);

  const show = (g1, g2) => p.evaluate((c) => {
    FIN.rb = { g1: c.g1, g2: c.g2, quarter: 'all', verifiedOnly: false, metrics: { revenue_sar: true } };
    if (window.finGo) finGo('reports'); else render();
  }, { g1, g2 });

  /* Printed text only: the group rows, the sub-rows, the TOTAL row, and any prose under them. */
  const readTable = () => p.evaluate(() => {
    const num = (t) => Number(String(t || '').replace(/[^0-9.\-]/g, ''));
    const view = document.getElementById('view');
    const tbl = view.querySelector('table'); if (!tbl) return { err: 'no table' };
    const groups = [], subs = {};
    [].slice.call(tbl.querySelectorAll('tr[data-rbk]')).forEach((tr) => {
      const k = tr.getAttribute('data-rbk'), s = tr.getAttribute('data-rbs');
      const v = num(tr.cells[1] && tr.cells[1].textContent);
      if (s) { (subs[k] = subs[k] || []).push(v); } else groups.push({ k, v });
    });
    const rows = [].slice.call(tbl.querySelectorAll('tbody tr'));
    const totalRow = rows.filter((tr) => !tr.getAttribute('data-rbk')).pop();
    const printedTotal = totalRow ? num(totalRow.cells[1] && totalRow.cells[1].textContent) : null;
    /* the card the table sits in, minus the table itself — where an explanation would live */
    const card = tbl.closest('.card');
    const around = ((view.innerText || '').split('\n').filter((l) => /rounded|riyal|exact|مقر|ريال|دقيق/i.test(l)).join(' ⏐ '));
    return { groups, subs, printedTotal, prose: around, cardFound: !!card };
  });

  /* ---- 1. control: whole riyals ---- */
  await seed([{ g: 'Zephyr Holdings', v: 1000, d: '2026-03-03', m: 'March' }, { g: 'Orchard Freight', v: 250, d: '2026-03-04', m: 'March' }, { g: 'Vellum Group', v: 25, d: '2026-03-05', m: 'March' }]);
  await show('__client', '');
  await p.waitForTimeout(1200);
  const ctl = await readTable();
  const ctlSum = (ctl.groups || []).reduce((a, x) => a + x.v, 0);
  if (!ctl.err && ctl.groups.length === 3 && ctlSum === ctl.printedTotal && ctl.printedTotal === 1275)
    ok('control: three whole-riyal rows print 1,000 + 250 + 25 and the TOTAL row prints 1,275 — the column adds up, and this probe can read it');
  else
    fail(`control: could not read a clean report table (${JSON.stringify(ctl)}) — nothing below can be concluded`);

  /* ---- 2. THE DEFECT: three clients billing 100.40 each ---- */
  await seed([{ g: 'Zephyr Holdings', v: 100.40, d: '2026-03-03', m: 'March' }, { g: 'Orchard Freight', v: 100.40, d: '2026-03-04', m: 'March' }, { g: 'Vellum Group', v: 100.40, d: '2026-03-05', m: 'March' }]);
  await show('__client', '');
  await p.waitForTimeout(1200);
  const frac = await readTable();
  const fracSum = (frac.groups || []).reduce((a, x) => a + x.v, 0);
  const exactShown = /301\.2/.test(frac.prose || '');
  if (!frac.err && fracSum === frac.printedTotal)
    ok(`fractional rows still add up on screen: ${frac.groups.map((x) => x.v).join(' + ')} = ${fracSum}, TOTAL ${frac.printedTotal}`);
  else if (!frac.err && exactShown)
    ok(`the printed column cannot add up (${frac.groups.map((x) => x.v).join(' + ')} = ${fracSum} against a TOTAL of ${frac.printedTotal}) and the report says so, with the exact figure: "${frac.prose}"`);
  else
    fail(`three clients billing 100.40 each print as ${frac.groups.map((x) => x.v).join(', ')} — ${fracSum} — under a TOTAL printed ${frac.printedTotal}, and nothing on screen accounts for it (prose found: ${JSON.stringify(frac.prose)}). money0 rounds each row, and grand sums the RAW values and rounds once, so the column a manager reads down does not reach the number at the bottom of it.`);

  /* ---- 3. one level in: sub-rows against their own group row ---- */
  await seed([{ g: 'Zephyr Holdings', v: 100.40, d: '2026-01-03', m: 'January' }, { g: 'Zephyr Holdings', v: 100.40, d: '2026-02-03', m: 'February' }, { g: 'Zephyr Holdings', v: 100.40, d: '2026-03-03', m: 'March' }]);
  await show('__client', 'month');
  await p.waitForTimeout(1200);
  const deep = await readTable();
  const gRow = (deep.groups || [])[0];
  const subSum = ((deep.subs || {})[gRow && gRow.k] || []).reduce((a, x) => a + x, 0);
  const deepExact = /301\.2/.test(deep.prose || '');
  if (gRow && subSum === gRow.v)
    ok(`sub-rows add up to their group row on screen: ${(deep.subs[gRow.k] || []).join(' + ')} = ${subSum} under ${gRow.v}`);
  else if (gRow && deepExact)
    ok(`the printed sub-rows cannot add up to their group row (${(deep.subs[gRow.k] || []).join(' + ')} = ${subSum} under ${gRow.v}) and the report says so with the exact figure`);
  else
    fail(`with a second grouping, ${gRow ? gRow.k : '(no group)'} prints months of ${((deep.subs || {})[gRow && gRow.k] || []).join(', ')} — ${subSum} — under a group row printing ${gRow && gRow.v}, unexplained. The same independent rounding, one level in, on the view the owner asked for by name ("<client> January total").`);

  /* ---- 4. nothing moved, and the file is still exact ---- */
  await p.evaluate(() => { window.__csv = null; finCSV(); });
  for (let i = 0; i < 20 && !(await p.evaluate(() => window.__csv)); i++) await p.waitForTimeout(100);
  const after = await p.evaluate(() => {
    const R = FIN._lastReport;
    const csv = (window.__csv || '').replace(/^﻿/, '').split('\r\n').filter(Boolean);
    return { grand: R ? R.grand.revenue_sar : null, total: csv.length ? csv[csv.length - 1] : null };
  });
  if (Math.abs((after.grand || 0) - 301.2) < 0.005 && /301\.2/.test(after.total || ''))
    ok(`nothing moved: the report's own grand total is still 301.20 and the exported TOTAL line still reads it exactly (${after.total}) — the file an accountant works from was not rounded to match the screen`);
  else
    fail(`the underlying figure or the export changed: ${JSON.stringify(after)}. This cycle may change what is said about a number, never the number.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nreport-table-printed-arithmetic OK — the column a person reads down reaches the number at the bottom of it, or says why not');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
