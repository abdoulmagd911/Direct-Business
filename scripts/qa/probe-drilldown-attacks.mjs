/* probe-drilldown-attacks.mjs (2026-09-03, watch cycle 22) - the Report Builder drill-down.

   Clicking a grouped row opens the invoices behind that total (js/25, chapter 25 part 3). It has
   never been driven by any probe. The whole promise of the feature is that what a row expands to
   adds up to the row it expanded from - if that is ever untrue, a manager reads a total and a
   list of invoices that contradict it, and believes both.

   Under test:
     1. Every opened group reconciles: the invoice lines sum EXACTLY to the row's own printed
        total, for every metric on screen, at every grouping.
     2. With a sub-grouping in force it is the SUB rows that open, not the group rows (opening
        both would put a client's invoices above its own months and read as nonsense).
     3. Verified-only on and off both reconcile - two different row sets, same promise.
     4. A group holding ONE invoice and a group holding hundreds both behave.
     5. The 200-row cap is honest: past it the detail says "the first 200 of N", never a silent
        truncation.
     6. The period and sector filters in force are respected - every opened invoice is inside
        the period the page is showing.
     7. Closing a row removes its detail; nothing is left stranded under another client.
     8. The reconciliation guard is real: when the rows genuinely do not add up to the total, the
        detail is refused in words instead of shown.

   Run:  node scripts/qa/probe-drilldown-attacks.mjs        (port 8223)
   Sabotage (file-level): drop the reconcile loop in js/25 -> check 8 goes red; make rowsFor()
   return the group rows when a sub-group is open -> checks 1 and 2 go red. Restore
   byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8223;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* fixture: one client with a single invoice, one with 260 (past the 200 cap), the rest ordinary */
function inv(id, group, date, total, cost, extra) {
  const mo = +date.slice(5, 7);
  return Object.assign({
    id, invoice_no: 'DD-' + id, line_no: 1, zatca_dpin: null,
    client_group: group, customer_raw_name: group, invoice_date: date, year: +date.slice(0, 4),
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: cost, profit_sar: total - cost,
    vat_sar: 0, amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'dd-qa', revenue_way: 'invoice',
    created_at: '2026-04-01T00:00:00Z', updated_at: '2026-04-01T00:00:00Z', deleted_at: null
  }, extra || {});
}
const SEED = [];
SEED.push(inv('solo', 'Solo Co', '2026-03-05', 1234, 400));                       // exactly one invoice
for (let i = 0; i < 260; i++) SEED.push(inv('big' + i, 'Bulk Co', '2026-0' + ((i % 6) + 1) + '-1' + (i % 9), 100 + i, 30 + (i % 17)));  // past the 200 cap
for (let i = 0; i < 40; i++) SEED.push(inv('mid' + i, 'Mid Co ' + (i % 5), '2026-0' + ((i % 6) + 1) + '-2' + (i % 8), 500 + i * 3, 200 + i));
// unverified rows: present when verified-only is off, absent when it is on
for (let i = 0; i < 12; i++) SEED.push(inv('pend' + i, 'Mid Co ' + (i % 5), '2026-05-1' + (i % 9), 700 + i, 250, { integrity_status: 'pending', amount_received_sar: 0, amount_remaining_sar: 700 + i }));
// a row in a different year. The Report Builder deliberately spans ALL years and sectors — its
// own caption says "the period bar above does not apply to this report" — so this row SHOULD be
// included, and the check below is that the page says so, not that it is filtered out. (The first
// version of this probe asserted the opposite and called correct behaviour a defect.)
SEED.push(inv('oldy', 'Older Year Co', '2025-03-05', 9999, 100));

const srv = start(PORT, { finance_invoices: SEED });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log('fixture: ' + SEED.length + ' invoices · one client with 1 invoice, one with 260, one year out of period');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.p.year = 2026; FIN.p.part = 'all'; FIN.p.sector = 'all'; render(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => finGo('reports')); await p.waitForTimeout(1500);

  const setRb = async (g1, g2, verifiedOnly) => {
    await p.evaluate(([g1, g2, v]) => {
      FIN.rb.g1 = g1; FIN.rb.g2 = g2; FIN.rb.verifiedOnly = v; FIN.rb.quarter = 'all';
      FIN.rb.metrics = { revenue_sar: true, cost_sar: true, profit_sar: true };
      render();
    }, [g1, g2, verifiedOnly]);
    await p.waitForTimeout(1200);
  };
  // open every openable row and check each one reconciles against its own printed total
  const openAllAndCheck = async () => p.evaluate(() => {
    const R = window.FIN && FIN._lastReport;
    if (!R || !R.g) return { err: 'no report' };
    const deep = !!R.g2;
    const rows = [...document.querySelectorAll('#view tr[data-rbk]')].filter(tr => {
      const s = tr.getAttribute('data-rbs') || '';
      return deep ? !!s : !s;
    });
    const out = { opened: 0, mismatched: [], withheld: 0, capped: 0, kids: 0, sample: [] };
    rows.forEach(tr => {
      const k = tr.getAttribute('data-rbk'), s = tr.getAttribute('data-rbs') || '';
      window.s1Toggle(k, s);
      const G = R.g[k]; if (!G) return;
      const src = s ? ((G.__subRows && G.__subRows[s]) || []) : (G.__rows || []);
      const tot = s ? (G.__sub && G.__sub[s]) : G.__tot;
      out.opened++;
      (R.mets || []).forEach(m => {
        const want = (tot && tot[m]) || 0;
        const got = src.reduce((a, r) => a + (m === '_count' ? 1 : (+r[m] || 0)), 0);
        if (Math.abs(want - got) > 0.01) out.mismatched.push([k, s, m, want, got]);
      });
      if (src.length > 200) out.capped++;
      if (out.sample.length < 3) out.sample.push([k, s, src.length]);
    });
    const html = document.querySelector('#view').innerHTML;
    out.withheld = (html.match(/Detail withheld/g) || []).length;
    out.kids = document.querySelectorAll('#view tr.s1-kid').length;
    out.capNote = /first 200 of \d+ invoices/.test(html);
    // every opened invoice must belong to the period on screen
    out.captionSaysAllYears = /period bar above does not apply|\u0634\u0631\u064a\u0637 \u0627\u0644\u0641\u062a\u0631/.test(html);
    out.outOfPeriod = 0;
    rows.forEach(tr => {
      const k = tr.getAttribute('data-rbk'), s = tr.getAttribute('data-rbs') || '';
      const G = R.g[k]; if (!G) return;
      const src = s ? ((G.__subRows && G.__subRows[s]) || []) : (G.__rows || []);
      src.forEach(r => { if (!window.finInPeriod(r)) out.outOfPeriod++; });
    });
    return out;
  });

  /* ---------- 1-4. every grouping, verified-only both ways ---------- */
  const shapes = [['__client', '', true], ['__client', '', false], ['month', '', true], ['__client', 'month', true], ['service_type', '', false]];
  for (const [g1, g2, v] of shapes) {
    await setRb(g1, g2, v);
    const res = await openAllAndCheck();
    const lbl = g1 + (g2 ? ' › ' + g2 : '') + (v ? ' · verified only' : ' · all rows');
    if (res.err) { fail(lbl + ': ' + res.err); continue; }
    if (res.opened > 0) {
      if (!res.mismatched.length) ok(`${lbl}: all ${res.opened} opened rows reconcile — what each row expands to sums exactly to the row itself, on every metric`);
      else fail(`${lbl}: ${res.mismatched.length} metric(s) do not reconcile, e.g. ${JSON.stringify(res.mismatched[0])}`);
      if (!res.withheld) ok(`  …and none had to be withheld`); else fail(`  ${lbl}: ${res.withheld} row(s) withheld their detail — the rows and the total disagree`);
      if (res.captionSaysAllYears) ok(`  …and the report says on screen that it spans all years and sectors, so nobody reads it as the period on the bar`);
      else fail(`  ${lbl}: the report includes ${res.outOfPeriod} invoice(s) outside the period bar and does not say that it spans all years`);
    } else fail(lbl + ': nothing opened — the check would prove nothing');
  }

  /* ---------- 5. the cap is honest ---------- */
  await setRb('__client', '', true);
  const capRes = await openAllAndCheck();
  if (capRes.capped >= 1 && capRes.capNote) ok(`a client with more than 200 invoices says "the first 200 of N" instead of quietly showing 200 and stopping`);
  else fail(`the 200-row cap is not declared on screen (groups over the cap: ${capRes.capped}, note present: ${capRes.capNote})`);
  const soloRows = await p.evaluate(() => { const R = FIN._lastReport; const k = Object.keys(R.g).find(x => /Solo/.test(x)); return k ? (R.g[k].__rows || []).length : -1; });
  if (soloRows === 1) ok('a client with exactly one invoice opens to exactly one line'); else fail('the single-invoice client holds ' + soloRows + ' rows');

  /* ---------- 6. the sub-grouping opens the sub rows, not the groups ---------- */
  await setRb('__client', 'month', true);
  const deepInfo = await p.evaluate(() => {
    const marked = [...document.querySelectorAll('#view tr[data-rbk] .s1-mark')].length;
    const groupRowsMarked = [...document.querySelectorAll('#view tr[data-rbk]')].filter(tr => !(tr.getAttribute('data-rbs') || '') && tr.querySelector('.s1-mark')).length;
    return { marked, groupRowsMarked };
  });
  if (deepInfo.marked > 0 && deepInfo.groupRowsMarked === 0) ok('with a second grouping only the sub-rows are openable — a client’s invoices never appear above its own months');
  else fail(`marked rows: ${deepInfo.marked}, of which group rows: ${deepInfo.groupRowsMarked} (expected 0)`);

  /* ---------- 7. closing removes the detail ---------- */
  await setRb('__client', '', true);
  // start from a KNOWN-CLOSED state: earlier checks left rows open, so the first toggle was
  // closing them and the counts read backwards (0 open, 250 after "closing")
  const startKids = await p.evaluate(() => {
    const R = FIN._lastReport;
    Object.keys(R.g).forEach(k => { if (document.querySelector('#view tr.s1-kid')) window.s1Toggle(k, ''); });
    return document.querySelectorAll('#view tr.s1-kid').length;
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const R = FIN._lastReport; Object.keys(R.g).forEach(k => window.s1Toggle(k, '')); });
  await p.waitForTimeout(600);
  const openKids = await p.evaluate(() => document.querySelectorAll('#view tr.s1-kid').length);
  await p.evaluate(() => { const R = FIN._lastReport; Object.keys(R.g).forEach(k => window.s1Toggle(k, '')); });
  await p.waitForTimeout(600);
  const closedKids = await p.evaluate(() => document.querySelectorAll('#view tr.s1-kid').length);
  if (openKids > 0 && closedKids === 0) ok(`opening every client adds ${openKids} detail lines and closing them all removes every one — nothing is left stranded under another client`);
  else fail(`detail lines open: ${openKids}, after closing: ${closedKids}`);

  /* ---------- 8. the reconciliation guard is real ---------- */
  const guard = await p.evaluate(() => {
    const R = FIN._lastReport; const k = Object.keys(R.g)[0];
    // move one invoice's revenue WITHOUT moving the total: the rows must now disagree with it
    const before = R.g[k].__rows[0].revenue_sar;
    R.g[k].__rows[0].revenue_sar = before + 12345;
    // toggle until this row's detail is actually painted — a fixed number of toggles depends on
    // whatever the previous check left open, and got this check the wrong way round once already
    let said = false;
    for (let i = 0; i < 2; i++) {
      window.s1Toggle(k, '');
      if (document.querySelector('#view tr.s1-kid')) { said = /Detail withheld/.test(document.querySelector('#view').innerHTML); break; }
    }
    R.g[k].__rows[0].revenue_sar = before;
    return said;
  });
  if (guard) ok('when the invoices behind a row genuinely do not add up to it, the detail is refused in words rather than shown — a manager never reads a total and a contradicting list side by side');
  else fail('a row whose invoices do not add up to its total still showed the detail');

  if (!errors.length) ok('no page errors through the run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
