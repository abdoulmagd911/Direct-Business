/* probe-drilldown-printed-arithmetic.mjs (2026-09-08, watch cycle 59) — the drill-down's promise,
   checked against the screen instead of against the data. Attack area (ac).

   PORT NOTE: 8701–8728 are taken. This is 8729, verified free by scanning every PORT= in
   scripts/qa.

   js/25 opens the invoices behind a Report Builder total, and its whole reason for existing is
   that "what a row expands to adds up to the row it expanded from". It guards that with a
   reconcile loop, and probe-drilldown-attacks proves the guard works — but both of them compare
   `src.reduce(...)` against `tot[m]`, which are the RAW numbers held in FIN._lastReport. Nobody
   has ever compared the numbers a person can actually see.

   They are not the same numbers. The group row prints money0(total) and each detail line prints
   m0(value) — both `Math.round(n).toLocaleString()`, rounded independently. Three invoices of
   100.40 print as 100, 100, 100 under a total that prints as 301. The internal check passes to
   the hallala; the visible arithmetic is out by a riyal. This matters here more than anywhere
   else in the app, because the ONE thing a person does with this feature is add the lines up.

   Costs on this system carry real fractions — the approved expense lines total 1,935,461.74 —
   and profit is revenue minus cost, so this is not a contrived case.

   Under test:
     1. Control — with whole-riyal invoices the printed lines sum exactly to the printed total.
        (If this fails the probe is misreading the screen and nothing below means anything.)
     2. THE DEFECT — with fractional invoices, the printed lines must either still add up, or the
        detail must say on screen why they cannot and give the exact figure.
     3. The underlying total is untouched: whatever the fix does to the display, FIN._lastReport's
        own figure and the number printed on the group row stay exactly what they were.
     4. The existing reconcile refusal still fires when the rows genuinely do not belong to the
        total — a "fix" that silenced that guard to make the arithmetic look tidy would be far
        worse than the defect.

   Run:  node scripts/qa/probe-drilldown-printed-arithmetic.mjs        (port 8729)
   Sabotage: remove the rounding note from js/25 — check 2 goes red. Assert the sabotage APPLIED
   with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8729;
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
  if (!(await p.waitForFunction(() => typeof window.s1Toggle === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('s1Toggle / FIN.rows never appeared, so nothing below examined anything');

  /* Two clients: one billing whole riyals, one billing fractions. Deliberately NOT named with any
     word this probe later searches the screen for (cycle 57: a fixture called "Metric Co" made a
     text search pass under sabotage). */
  await p.evaluate(() => {
    const base = { integrity_status: 'verified_paid', amount_received_sar: 0, amount_remaining_sar: 0, invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, service_type: 'flights', record_type: 'invoice', deleted_at: null };
    FIN.rows = FIN.rows || [];
    const push = (id, group, rev) => FIN.rows.push(Object.assign({}, base, {
      id, invoice_no: id.toUpperCase(), client_group: group, customer_raw_name: group,
      revenue_sar: rev, cost_sar: 0, profit_sar: rev, total_incl_vat_sar: rev,
    }));
    push('pa-w1', 'Zephyr Holdings', 1000); push('pa-w2', 'Zephyr Holdings', 250); push('pa-w3', 'Zephyr Holdings', 25);
    push('pa-f1', 'Quill Partners', 100.40); push('pa-f2', 'Quill Partners', 100.40); push('pa-f3', 'Quill Partners', 100.40);
    FIN.rb = { g1: '__client', g2: '', quarter: 'all', verifiedOnly: false, metrics: { revenue_sar: true } };
    if (window.finGo) finGo('reports'); else render();
  });
  await p.waitForTimeout(1500);

  /* Read ONLY what a person can see: the group row's printed figure, and the printed figures on
     the detail lines under it. No FIN internals in this reading. */
  const openAndRead = (group) => p.evaluate((g) => {
    const num = (t) => Number(String(t || '').replace(/[^0-9.\-]/g, ''));
    const view = document.getElementById('view');
    const row = [].slice.call(view.querySelectorAll('tr[data-rbk]')).find((tr) => tr.getAttribute('data-rbk') === g && !tr.getAttribute('data-rbs'));
    if (!row) return { err: 'no group row for ' + g };
    if (!/▾/.test(row.textContent)) row.click();
    return new Promise((res) => setTimeout(() => {
      const printedTotal = num(row.cells[1] && row.cells[1].textContent);
      const kids = []; let n = row.nextElementSibling;
      const noteText = [];
      while (n && n.classList && n.classList.contains('s1-kid')) {
        if (n.cells.length > 1) kids.push(num(n.cells[1].textContent));
        else noteText.push((n.textContent || '').trim());
        n = n.nextElementSibling;
      }
      res({ printedTotal, kids, printedSum: kids.reduce((a, x) => a + x, 0), notes: noteText.join(' ⏐ ') });
    }, 400));
  }, group);

  /* ---- 1. control: whole riyals ---- */
  const whole = await openAndRead('Zephyr Holdings');
  if (!whole.err && whole.kids.length === 3 && whole.printedSum === whole.printedTotal && whole.printedTotal === 1275)
    ok(`control: three whole-riyal invoices print 1,000 + 250 + 25 and the row above prints 1,275 — the screen adds up, and this probe can read it`);
  else
    fail(`control: could not read a clean drill-down (${JSON.stringify(whole)}) — nothing below can be concluded`);

  /* ---- 2. THE DEFECT: fractions ---- */
  const frac = await openAndRead('Quill Partners');
  const exactShown = /301\.2/.test(frac.notes || '');
  if (!frac.err && frac.printedSum === frac.printedTotal)
    ok(`fractional invoices still add up on screen: lines ${frac.kids.join(' + ')} = ${frac.printedSum}, row above ${frac.printedTotal}`);
  else if (!frac.err && exactShown)
    ok(`the printed lines cannot add up (${frac.kids.join(' + ')} = ${frac.printedSum} under ${frac.printedTotal}) and the detail says so, giving the exact figure: "${frac.notes}"`);
  else
    fail(`three invoices of 100.40 print as ${frac.kids.join(', ')} — ${frac.printedSum} — under a total printed as ${frac.printedTotal}, and nothing on screen accounts for the difference (notes: ${JSON.stringify(frac.notes)}). js/25's reconcile loop compares the RAW numbers and passes to the hallala, so the guard is satisfied while the only arithmetic a person can actually do is wrong. Adding these lines up is the one thing this feature exists for.`);

  /* ---- 3. the number itself is untouched ---- */
  const raw = await p.evaluate(() => {
    const R = FIN._lastReport; const k = 'Quill Partners';
    return { tot: R && R.g[k] ? R.g[k].__tot.revenue_sar : null, rows: R && R.g[k] ? R.g[k].__rows.length : null };
  });
  if (Math.abs((raw.tot || 0) - 301.2) < 0.005 && raw.rows === 3 && frac.printedTotal === 301)
    ok('the figure behind the row is still exactly 301.20 over 3 invoices and the row still prints 301 — this is a display honesty change, not a change to anybody’s money');
  else
    fail(`the underlying total or the printed headline moved: ${JSON.stringify(raw)}, printed ${frac.printedTotal}. Nothing in this cycle may alter a figure.`);

  /* ---- 4. the real reconcile guard still bites ---- */
  const guard = await p.evaluate(() => {
    const R = FIN._lastReport, k = 'Zephyr Holdings';
    if (!R || !R.g[k]) return { err: 'no group' };
    const keep = R.g[k].__tot.revenue_sar;
    R.g[k].__tot.revenue_sar = keep + 5000;          // a total that its own rows do not make
    const view = document.getElementById('view');
    const row = [].slice.call(view.querySelectorAll('tr[data-rbk]')).find((tr) => tr.getAttribute('data-rbk') === k && !tr.getAttribute('data-rbs'));
    row.click(); row.click();                          // close, reopen against the poisoned total
    return new Promise((res) => setTimeout(() => {
      let n = row.nextElementSibling, txt = '';
      while (n && n.classList && n.classList.contains('s1-kid')) { txt += ' ' + (n.textContent || ''); n = n.nextElementSibling; }
      R.g[k].__tot.revenue_sar = keep;
      res({ withheld: /do not add up|withheld/i.test(txt), txt: txt.trim().slice(0, 160) });
    }, 500));
  });
  if (guard.withheld)
    ok('when the rows genuinely do not make the total, the detail is still refused in words — the rounding note did not become a way to explain away a real disagreement');
  else
    fail(`a total inflated by 5,000 still showed its detail (${JSON.stringify(guard)}). A rounding explanation that also covers a genuine mismatch is worse than no explanation.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ndrilldown-printed-arithmetic OK — the lines a person can add up either do add up, or say why not');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
