/* probe-report-metrics-honesty.mjs (2026-09-08, watch cycle 57) — a report that shows a figure
   nobody asked for, and an export button that says nothing. Attack area (zz).

   PORT NOTE: 8701–8727 are taken. This is 8728, verified free by scanning every PORT= in
   scripts/qa.

   The Report Builder's Metrics row is six checkboxes, each wired to finRBM(). Untick the last
   one and the table does NOT go empty — it shows Revenue, because rReports() does this:

       var mets=Object.keys(rb.metrics).filter(function(k){return rb.metrics[k];});
       if(!mets.length)mets=['revenue_sar'];

   So the screen is in two minds at once: every box is off, and a Revenue column is on. Nothing
   says the report picked that column itself. The same fallback rides into FIN._lastReport, so
   "Export CSV" hands over a file with a Revenue column the person never ticked — and if they
   read the boxes to decide what the file contains, the boxes are wrong about it.

   This is the shape cycles 41–43, 55 and 56 kept finding: the app answering with more confidence
   than its own state supports. Here it is not "not found" for "not loaded" — it is a default
   presented as a choice.

   Second thing in the same square inch: finCSV() opens with

       var R=FIN._lastReport;if(!R)return;

   a button that does nothing at all, silently, when there is no report behind it. Today that is
   nearly unreachable because of the very fallback above; the moment the fallback goes, it is one
   click away. Fixing one without the other would trade a wrong file for a dead button.

   Under test:
     1. Control — with Revenue and Cost ticked, the table shows exactly those two columns and the
        export carries exactly those two. (If this fails, nothing below means anything.)
     2. THE DEFECT — with every box unticked through finRBM (the real UI path), the report must
        not show a money column nobody chose. Either it says no figure is selected, or it says on
        screen that it is falling back. Silence with a Revenue column is the failure.
     3. The export must not hand over a file whose columns nobody currently asks for, and must
        not be a button that does nothing without saying so.
     4. Recovery — tick one box again and exactly that column comes back. A "fix" that switches
        the report off would pass 2 and 3 and be worthless.

   Run:  node scripts/qa/probe-report-metrics-honesty.mjs        (port 8728)
   Sabotage: put the `if(!mets.length)mets=['revenue_sar'];` fallback back — checks 2 and 3 go
   red. Assert the sabotage APPLIED with a marker unique to it; confirm the restore by marker
   count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8728;
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
  if (!(await p.waitForFunction(() => typeof window.finRBM === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finRBM / FIN.rows never appeared, so nothing below examined anything');

  /* Rows of our own, so the report has something to total whatever the mock happens to hold. */
  await p.evaluate(() => {
    const base = { integrity_status: 'verified_paid', total_incl_vat_sar: 1150, revenue_sar: 1000, cost_sar: 400, profit_sar: 600, amount_received_sar: 1150, amount_remaining_sar: 0, invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null };
    FIN.rows = FIN.rows || [];
    FIN.rows.push(Object.assign({}, base, { id: 'rm-1', invoice_no: 'RM-1', client_group: 'Alpha Trading', customer_raw_name: 'Alpha Trading' }));
    FIN.rows.push(Object.assign({}, base, { id: 'rm-2', invoice_no: 'RM-2', client_group: 'Beta Trading', customer_raw_name: 'Beta Trading', revenue_sar: 500, cost_sar: 100, profit_sar: 400 }));
    window.__csv = null;
    URL.createObjectURL = function (blob) { blob.text().then((t) => { window.__csv = t; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { };
  });

  const settle = () => p.waitForTimeout(700);

  /* What the screen actually shows: the metric column headers of the report table, the state of
     the six checkboxes, and any text the card offers about it. Read from the DOM, not from FIN. */
  const screenState = () => p.evaluate(() => {
    const tbl = document.querySelector('table');
    const ths = tbl ? Array.from(tbl.querySelectorAll('thead th')).map((t) => t.textContent.trim()) : [];
    const boxes = Array.from(document.querySelectorAll('input[type=checkbox]')).filter((i) => (i.getAttribute('onchange') || '').indexOf('finRBM') >= 0);
    return {
      cols: ths.slice(1),
      hasTable: !!tbl,
      ticked: boxes.filter((i) => i.checked).length,
      boxes: boxes.length,
      lastReport: FIN._lastReport ? (FIN._lastReport.mets || []).slice() : null,
      text: (document.body.innerText || '').replace(/\s+/g, ' '),
    };
  });

  const exportNow = async () => {
    await p.evaluate(() => {
      window.__csv = null; window.__said = [];
      const oa = window.alert; window.alert = (m) => window.__said.push(String(m));
      window.__restore = () => { window.alert = oa; };
      try { finCSV(); } catch (e) { window.__said.push('THREW ' + e.message); }
    });
    for (let i = 0; i < 20 && !(await p.evaluate(() => window.__csv)); i++) await p.waitForTimeout(100);
    return await p.evaluate(() => {
      try { window.__restore(); } catch (_) { }
      const csv = window.__csv;
      return { header: csv ? csv.replace(/^﻿/, '').split('\r\n')[0] : null, said: (window.__said || []).join(' | ') };
    });
  };

  /* ---- 1. control: two figures ticked, two columns, two columns exported ---- */
  await p.evaluate(() => {
    FIN.rb = { g1: '__client', g2: '', quarter: 'all', verifiedOnly: false, metrics: {} };
    if (window.finGo) finGo('reports'); else render();
  });
  await settle();
  await p.evaluate(() => { finRBM('revenue_sar', true); finRBM('cost_sar', true); });
  await settle();
  const ctl = await screenState();
  const ctlCsv = await exportNow();
  const textOn = ctl.text;
  if (ctl.hasTable && ctl.cols.length === 2 && ctl.ticked === 2 && ctlCsv.header && ctlCsv.header.split(',').length === 3)
    ok(`control: two boxes ticked → two columns on screen (${ctl.cols.join(', ')}) and two in the export (${ctlCsv.header})`);
  else
    fail(`control: ticking Revenue and Cost did not produce a two-column report and export (${JSON.stringify(ctl)} / ${JSON.stringify(ctlCsv)}) — nothing below can be concluded`);

  /* ---- 2. THE DEFECT: every box off, through the real UI path ---- */
  await p.evaluate(() => { ['revenue_sar', 'cost_sar', 'profit_sar', 'amount_received_sar', 'amount_remaining_sar', '_count'].forEach((k) => finRBM(k, false)); });
  await settle();
  const off = await screenState();
  /* An earlier draft of this check just scanned the page for words like "choose" and passed on the
     Finance page's own furniture — a check that could not fail (cycle 48). What matters is that
     something on screen CHANGED to explain the empty selection, so compare the sentences against
     the same page with metrics ticked and require a genuinely new one that is about the metrics. */
  const sent = (t) => (t || '').split(/(?<=[.!?؟۔])\s+|\u00b7/).map((x) => x.trim()).filter(Boolean);
  const onSet = new Set(sent(textOn));
  const added = sent(off.text).filter((x) => !onSet.has(x));
  const saysWhy = added.some((x) => /(figure|metric|\u0642\u064a\u0645|\u0645\u0642\u064a\u0627\u0633)/i.test(x));
  /* The standard here is the app's own promise: the six boxes say which figures the table shows.
     Zero ticked must mean zero money columns — and it must say so, or the person is left staring
     at a report that vanished. An earlier draft also accepted "falls back to Revenue but says so",
     which is a design this cycle rejected; leaving it in the probe made the check pass under
     sabotage, because one of THIS PROBE'S OWN fixture names contained the word "Metric". A probe
     must not hand the app a word the probe is about to search for. */
  if (off.ticked === 0 && off.cols.length === 0 && saysWhy)
    ok(`with every metric box unticked the report shows no money column at all and says why: "${added.find((x) => /(figure|metric|\u0642\u064a\u0645|\u0645\u0642\u064a\u0627\u0633)/i.test(x))}" — the boxes and the table agree`);
  else if (off.ticked === 0 && off.cols.length === 0)
    fail(`with every metric box unticked the table went away and NOTHING on screen said why (new text: ${JSON.stringify(added.slice(0, 3))}). An empty report with no explanation reads as broken, which is the same defect facing the other way.`);
  else
    fail(`every metric box is unticked (${off.ticked} of ${off.boxes} checked) and the table still shows the column(s) [${off.cols.join(', ')}] with nothing on screen saying the report chose that itself. rReports() does \`if(!mets.length)mets=['revenue_sar']\`, so the screen claims a choice the person never made — and FIN._lastReport carries it (${JSON.stringify(off.lastReport)}) straight into the export.`);

  /* ---- 3. and the export must not carry it either, nor die quietly ---- */
  const offCsv = await exportNow();
  if (!offCsv.header && offCsv.said)
    ok(`with nothing ticked, Export CSV produces no file and says why: "${offCsv.said}"`);
  else if (!offCsv.header && !offCsv.said)
    fail('with nothing ticked, Export CSV produced no file AND said nothing — a button that does nothing in silence (finCSV opens `var R=FIN._lastReport;if(!R)return;`). Whatever the report does when no figure is chosen, pressing export must say it.');
  else
    fail(`with nothing ticked, Export CSV still handed over a file headed "${offCsv.header}" — a column nobody asked for, in a file someone will send to an accountant. The person reading the checkboxes to know what is in the file would be wrong about it.`);

  /* ---- 4. recovery: one box back on, exactly that column ---- */
  await p.evaluate(() => { finRBM('profit_sar', true); });
  await settle();
  const back = await screenState();
  const backCsv = await exportNow();
  if (back.hasTable && back.cols.length === 1 && back.ticked === 1 && backCsv.header && backCsv.header.split(',').length === 2)
    ok(`recovery: ticking one box brings back exactly one column (${back.cols.join(', ')}) and a one-figure export — the refusal is a refusal, not the report switched off`);
  else
    fail(`recovery: after ticking Profit the report did not come back as a single-column report (${JSON.stringify(back)} / ${JSON.stringify(backCsv)}) — a fix that leaves the report dead is worse than the defect`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nreport-metrics-honesty OK — the report shows the figures the boxes say it shows, and the export says so too');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
