/* probe-period-disagreement-visible.mjs (2026-09-09, watch cycle 70) — a stored period that does
   not match the invoice date, said out loud. Attack area (am).

   PORT NOTE: 8701–8737 are taken. This is 8738 (cycle 69's probe was written, found unable to
   fail, and deleted, so its port is free again).

   Cycle 65 gave month and quarter the same date-fallback finYearOf has always had, so a row with
   a date and no stored period stopped vanishing from every quarter. It deliberately left the
   other case alone: a row whose stored quarter says Q2 while its date says March is still counted
   as Q2. That is the right call and this cycle does not change it — overruling a stored value on
   the say-so of a date that might itself be the wrong field would move money silently, and which
   of the two is authoritative is the owner's decision, not this code's.

   What was wrong is that nothing said the two disagree. Checked read-only on 8 September: zero
   live invoices disagree today, so this is a watch rather than an alarm — and a fixture is the
   only way to see it, which is why the fixture's values are chosen for exactly that property
   (cycles 63, 64: a benign fixture proves nothing).

   Under test:
     1. Control — rows whose stored month and quarter agree with their date: nothing is claimed.
        (If this fails the probe is misreading the page and nothing below means anything.)
     2. THE DEFECT — a row whose stored quarter contradicts its date: the Finance page says so, and
        says how many.
     3. NOTHING MOVED, which is the whole point of this cycle — the disagreeing invoice is still
        counted under its STORED quarter, not the date's. A fix that quietly re-sorted it would be
        picking a winner, which is the owner's call.
     4. A row with no date at all is not counted as a disagreement — there is nothing to compare,
        and inventing one would be the M8 failure in a new place.

   Run:  node scripts/qa/probe-period-disagreement-visible.mjs        (port 8738)
   Sabotage: remove the notice from rOverview — check 2 goes red. Assert the marker AND that the
   check actually turns red (cycle 66/69: a present but inert marker proves nothing).  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8738;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

const srv = start(PORT, { finance_invoices: [] });
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
  if (!(await p.waitForFunction(() => typeof window.finGo === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('the Finance page never loaded, so nothing below examined anything');

  /* March 2026 is Q1. The disagreeing row stores Q2 against a March date — chosen because the two
     fields must actually contradict for this to be visible at all, and because Q2 is where the row
     must STILL be counted afterwards (check 3). */
  const seed = (withDisagreement, withUndated) => p.evaluate((c) => {
    const base = { integrity_status: 'verified_paid', record_type: 'b2b', deleted_at: null, service_type: 'flights', cost_sar: 0, amount_received_sar: 0, amount_remaining_sar: 0, year: 2026 };
    const mk = (id, date, month, quarter, rev) => Object.assign({}, base, {
      id, invoice_no: id.toUpperCase(), client_group: 'Wexford Trading', customer_raw_name: 'Wexford Trading',
      invoice_date: date, month, quarter, revenue_sar: rev, profit_sar: rev, total_incl_vat_sar: rev,
    });
    const rows = [mk('pd-ok', '2026-03-10', 'March', 'Q1', 100)];
    if (c.dis) rows.push(mk('pd-bad', '2026-03-20', 'June', 'Q2', 200));
    if (c.undated) rows.push(Object.assign(mk('pd-nodate', null, null, null, 400), { invoice_date: null }));
    FIN.rows = rows;
    FIN.p = { year: 'all', part: 'all', sector: 'all' };
    FIN.tab = 'overview';
    if (window.finGo) finGo('overview'); else render();
  }, { dis: withDisagreement, undated: withUndated });

  const pageSays = () => p.evaluate(() => {
    const v = document.getElementById('view');
    const txt = (v ? v.innerText : '').replace(/\s+/g, ' ');
    const m = txt.match(/(\d+)\s+invoices?\s+carr(?:y|ies)\s+a month or quarter that does not match/i);
    return { said: !!m, count: m ? +m[1] : 0, text: (txt.match(/[^.]*does not match its invoice date[^.]*\./i) || [''])[0].trim() };
  });

  /* ---- 1. control ---- */
  await seed(false, false);
  await p.waitForTimeout(1500);
  const ctl = await pageSays();
  if (!ctl.said) ok('control: with every stored month and quarter matching its date, the page claims no disagreement');
  else fail(`control: the page reported ${ctl.count} disagreement(s) with none seeded — "${ctl.text}" — nothing below can be concluded`);

  /* ---- 2. the defect ---- */
  await seed(true, false);
  await p.waitForTimeout(1500);
  const dis = await pageSays();
  note(`with one March invoice stored as Q2/June: "${dis.text || '(nothing said)'}"`);
  if (dis.said && dis.count === 1)
    ok('an invoice whose stored month and quarter contradict its date is reported on the Finance page, with the count');
  else
    fail(`a March invoice stored as June / Q2 is counted under Q2 with nothing on screen saying the two disagree (said: ${dis.said}, count ${dis.count}). Cycle 65 decided deliberately that the stored value wins; what it left open was that nobody is told the fields conflict.`);

  /* ---- 3. NOTHING MOVED — the stored value still decides ---- */
  const where = await p.evaluate(() => {
    const inQ = (q) => { const keep = FIN.p; FIN.p = { year: '2026', part: q, sector: 'all' }; const n = (FIN.rows || []).filter((r) => window.finInPeriod(r)).map((r) => r.id); FIN.p = keep; return n; };
    return { q1: inQ('Q1'), q2: inQ('Q2') };
  });
  if (where.q2.includes('pd-bad') && !where.q1.includes('pd-bad'))
    ok('the disagreeing invoice is still counted in Q2, the quarter it stores — this cycle says the two fields differ and changes nothing about which one decides');
  else
    fail(`the disagreeing invoice moved: Q1 ${JSON.stringify(where.q1)}, Q2 ${JSON.stringify(where.q2)}. Re-sorting it on the date's say-so would be picking the winner, and that is the owner's decision, not this code's.`);

  /* ---- 4. no date, no disagreement ---- */
  await seed(false, true);
  await p.waitForTimeout(1500);
  const und = await pageSays();
  if (!und.said)
    ok('an invoice with no date at all is not counted as a disagreement — there is nothing to compare it with, and inventing one would be M8 in a new place');
  else
    fail(`an undated invoice was reported as disagreeing (${und.count}): "${und.text}". A row with no date has no date to contradict.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nperiod-disagreement-visible OK — when a stored period and an invoice date disagree the page says so, and still counts the row where it always did');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
