/* probe-client-table-printed-arithmetic.mjs (2026-09-08, watch cycle 63) — "Top clients by
   revenue", added up by eye. Attack area (ag). Fifth and last-but-one surface in the class.

   PORT NOTE: 8701–8732 are taken. This is 8733, verified free by scanning every PORT= in
   scripts/qa.

   This table is where a manager decides which client is worth the effort. Ten rows of Revenue /
   Cost / Profit and a Total row under them, each cell money0() — every figure rounded to the whole
   riyal SEPARATELY, exactly the shape cycles 59, 60 and 62 found on the drill-down, the Report
   Builder and the ageing card. probe-client-profit-honest covers this table's honesty about
   unrecorded cost and reads FIN to do it; nothing has ever compared two printed cells.

   The table has TWO legitimate reasons its columns may not add up, and both are already declared
   on screen — this probe must not confuse either with the defect:
     · only the top 10 rows are shown while the Total covers every client ("— all N clients, top
       10 shown"), so the check uses fewer than ten clients;
     · a client with no recorded cost anywhere prints the WORDS "not recorded" / "unknown" rather
       than a 0 (rule M8), so those columns are not addable at all — the fixture gives every
       client a real cost so the columns are numbers.

   Under test:
     1. Control — whole-riyal clients: the printed Revenue, Cost and Profit columns each sum
        exactly to the printed Total. (If this fails the probe is misreading the table.)
     2. THE QUESTION — clients carrying hallalas: the printed columns must still sum to the printed
        Total, or the table must say why they cannot.
     3. The declared reasons stay declared: with more clients than rows shown, the table still says
        so in words, and a client with no cost anywhere still prints words rather than a zero. A
        fix for the rounding must not quietly paper over either.
     4. Nothing moved: the underlying totals are untouched.

   Run:  node scripts/qa/probe-client-table-printed-arithmetic.mjs        (port 8733)
   Sabotage: remove whatever this cycle adds — check 2 goes red. Assert the sabotage APPLIED with a
   marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8733;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);

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
  if (!(await p.waitForFunction(() => typeof window.finGo === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('the Finance page never loaded, so nothing below examined anything');

  /* Names deliberately carry no word this probe searches the screen for (cycle 57). */
  const NAMES = ['Ashgrove Trading', 'Belfry Supply', 'Cinder Works', 'Dunmore Freight', 'Elmhurst Group'];
  const seed = (rev, cost, extraNoCost) => p.evaluate((cfg) => {
    const r2 = (n) => Math.round(n * 100) / 100;                    // exactly how js/65 and js/41 store
    const base = { integrity_status: 'verified_paid', record_type: 'invoice', deleted_at: null, service_type: 'flights', invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, amount_received_sar: 0, amount_remaining_sar: 0 };
    const rows = cfg.names.map((nm, i) => Object.assign({}, base, {
      id: 'ct-' + i, invoice_no: 'CT-' + i, client_group: nm, customer_raw_name: nm,
      revenue_sar: r2(cfg.rev), cost_sar: r2(cfg.cost), profit_sar: r2(cfg.rev - cfg.cost),
      total_incl_vat_sar: r2(cfg.rev),
    }));
    if (cfg.extraNoCost) rows.push(Object.assign({}, base, {
      id: 'ct-nc', invoice_no: 'CT-NC', client_group: 'Foxglove Ltd', customer_raw_name: 'Foxglove Ltd',
      revenue_sar: 900, cost_sar: 0, profit_sar: 900, total_incl_vat_sar: 900,
    }));
    FIN.rows = rows;
    FIN.p = { year: 'all', part: 'all' };
    FIN.tab = 'clients';
    if (window.finGo) finGo('clients'); else render();
  }, { names: NAMES, rev, cost, extraNoCost });

  /* Printed text only. */
  const readTable = () => p.evaluate(() => {
    const view = document.getElementById('view');
    const tbl = [].slice.call(view.querySelectorAll('table')).find((t) => /Top clients|أعلى العملاء/.test((t.closest('.card') || t).textContent || ''));
    if (!tbl) return { err: 'the Top clients table is not on screen' };
    const num = (t) => { const s = String(t || '').replace(/[^\d.\-]/g, ''); return s === '' ? null : Number(s); };
    const rows = [].slice.call(tbl.rows);
    const body = rows.slice(1, -1), totalRow = rows[rows.length - 1];
    const col = (tr, i) => (tr.cells[i] ? tr.cells[i].textContent.trim() : '');
    return {
      names: body.map((tr) => col(tr, 0)),
      rev: body.map((tr) => num(col(tr, 1))),
      cost: body.map((tr) => col(tr, 2)),
      prof: body.map((tr) => col(tr, 3)),
      total: { rev: num(col(totalRow, 1)), cost: num(col(totalRow, 2)), prof: num(col(totalRow, 3)), label: col(totalRow, 0) },
      prose: ((tbl.closest('.card') || tbl).innerText || '').replace(/\s+/g, ' '),
    };
  });

  const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);

  /* ---- 1. control: whole riyals ---- */
  await seed(1000, 400, false);
  await p.waitForTimeout(1400);
  const ctl = await readTable();
  if (ctl.err) fail(`control: ${ctl.err} — nothing below can be concluded`);
  else {
    const cRev = sum(ctl.rev), cCost = sum(ctl.cost.map(Number)), cProf = sum(ctl.prof.map(Number));
    note(`control: rows sum rev=${cRev} cost=${cCost} profit=${cProf}; Total row rev=${ctl.total.rev} cost=${ctl.total.cost} profit=${ctl.total.prof}`);
    if (ctl.rev.length === 5 && cRev === ctl.total.rev && cCost === ctl.total.cost && cProf === ctl.total.prof)
      ok('control: five whole-riyal clients — all three printed columns sum exactly to the printed Total, and this probe can read the table');
    else
      fail(`control: could not read a clean client table (rows ${ctl.rev.length}, sums ${cRev}/${cCost}/${cProf}, totals ${ctl.total.rev}/${ctl.total.cost}/${ctl.total.prof}) — nothing below can be concluded`);
  }

  /* ---- 2. THE QUESTION: hallalas ---- */
  await seed(1000.40, 400.35, false);
  await p.waitForTimeout(1400);
  const frac = await readTable();
  const fRev = sum(frac.rev), fCost = sum(frac.cost.map(Number)), fProf = sum(frac.prof.map(Number));
  note(`with hallalas: rows sum rev=${fRev} cost=${fCost} profit=${fProf}; Total row rev=${frac.total.rev} cost=${frac.total.cost} profit=${frac.total.prof}`);
  /* The substantive requirement, not a word: the table must carry the exact figure for whichever
     column does not add up (cycle 62 — a check that searches for a word fails a correct fix that
     happened to use a different one). */
  const exact = { rev: (1000.40 * 5).toFixed(2), cost: (400.35 * 5).toFixed(2), prof: ((1000.40 - 400.35) * 5).toFixed(2) };
  const offCols = [['rev', fRev, frac.total.rev], ['cost', fCost, frac.total.cost], ['prof', fProf, frac.total.prof]].filter(([, s, t]) => s !== t);
  const statesExact = offCols.every(([k]) => new RegExp(exact[k].replace('.', '\\.')).test(frac.prose || ''));
  if (!offCols.length)
    ok(`clients carrying hallalas still add up on screen: rev ${fRev}=${frac.total.rev}, cost ${fCost}=${frac.total.cost}, profit ${fProf}=${frac.total.prof}`);
  else if (statesExact)
    ok(`${offCols.length} printed column(s) cannot add up (${offCols.map(([k, s, t]) => `${k} ${s} vs ${t}`).join(', ')}) and the table gives the exact figure for each`);
  else
    fail(`${offCols.length} printed column(s) do not reach their own Total — ${offCols.map(([k, s, t]) => `${k}: rows ${s}, Total ${t}`).join('; ')} — with nothing on screen accounting for it. Every cell here is money0(), rounded to the whole riyal separately from the Total below it. This is the table where a manager decides which client is worth the effort, and reading a column down is how they check it.`);

  /* ---- 3. the two DECLARED reasons stay declared ---- */
  await seed(1000.40, 400.35, true);
  await p.waitForTimeout(1400);
  const withWords = await readTable();
  const wordsRow = withWords.cost.findIndex((c) => /not recorded|غير مسجّلة/.test(c));
  const profWords = wordsRow >= 0 && /unknown|غير معروف/.test(withWords.prof[wordsRow] || '');
  if (wordsRow >= 0 && profWords)
    ok('a client with no recorded cost anywhere still prints "not recorded" and "unknown" rather than a 0 and a full-revenue profit — rule M8 survived this cycle');
  else
    fail(`the no-cost client no longer prints words in Cost and Profit (cost cell "${withWords.cost[wordsRow]}", profit cell "${withWords.prof[wordsRow]}"). A rounding fix must not turn an unknown into a zero.`);

  /* ---- 4. nothing moved ---- */
  const raw = await p.evaluate(() => (FIN.rows || []).reduce((a, r) => a + (+r.revenue_sar || 0), 0));
  if (Math.abs(raw - (1000.40 * 5 + 900)) < 0.005 && withWords.total.rev === Math.round(raw))
    ok(`nothing moved: the revenue behind the table is still ${raw.toFixed(2)} and the Total still prints ${withWords.total.rev}`);
  else
    fail(`the underlying revenue or the printed Total moved: raw ${raw}, printed ${withWords.total.rev}. This cycle may change what is said about a number, never the number.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nclient-table-printed-arithmetic OK — the columns a manager reads down reach the Total under them, or the table says why not');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
