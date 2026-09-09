/* probe-overview-cards-printed-arithmetic.mjs (2026-09-08, watch cycle 64) — the Key indicators
   cards, checked by the only sum a person can do across them. Attack area (ah). SIXTH AND LAST
   surface in the printed-arithmetic class.

   PORT NOTE: 8701–8733 are taken. This is 8734, verified free by scanning every PORT= in
   scripts/qa.

   Six cards head the Finance Overview: Revenue, Cost, Profit, Received, Outstanding (invoiced),
   Invoices. They are NOT a column that sums, and this probe must not pretend otherwise — two
   things about them are deliberate, documented in js/16, and would be defects if reported as
   defects:
     · Outstanding is computed over ALL live invoices while the other five are verified-only,
       because an invoice is only verified-paid once nothing is left to pay (a comment in rOverview
       explains this at length, and cycle 4 fixed the opposite bug);
     · Invoices is a count of distinct invoice numbers, not money.

   Exactly ONE relation holds across these cards, and everyone reads it: **Profit = Revenue −
   Cost.** Each of the three is rendered moneyS() + finExactUnder() — shortened, then given an
   exact line only when the short form hides something to the nearest riyal. So the three printed
   figures need not satisfy the one equation the cards exist to show. 1,000.40 revenue against
   400.60 cost prints 1,000 − 401 = 599 beside a Profit printed 600.

   Under test:
     1. Control — whole-riyal money: printed Revenue − printed Cost equals printed Profit.
        (If this fails the probe is misreading the cards and nothing below means anything.)
     2. THE QUESTION — money carrying hallalas: the three printed figures must still satisfy the
        equation, or the screen must say why they cannot.
     3. The deliberate non-relations stay untouched: Outstanding still counts live invoices the
        other cards exclude, and Invoices is still a count. A fix that made everything tie by
        narrowing Outstanding would re-break what cycle 4 fixed.
     4. Nothing moved: the underlying revenue, cost and profit are unchanged.

   Run:  node scripts/qa/probe-overview-cards-printed-arithmetic.mjs        (port 8734)
   Sabotage: remove whatever this cycle adds — check 2 goes red. Assert the sabotage APPLIED with
   a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8734;
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

  /* One verified-paid invoice and one still owing, so Outstanding has something the other cards
     legitimately exclude — check 3 needs that to be true. Values stored as the app stores them. */
  const seed = (rev, cost) => p.evaluate((c) => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const base = { record_type: 'invoice', deleted_at: null, service_type: 'flights', invoice_date: '2026-03-03', month: 'March', quarter: 'Q1', year: 2026, wallet_portion_sar: 0 };
    FIN.rows = [1, 2, 3].map((i) => Object.assign({}, base, {
      id: 'ov-' + i, invoice_no: 'OV-' + i, client_group: 'Harlow Trading', customer_raw_name: 'Harlow Trading',
      integrity_status: 'verified_paid',
      revenue_sar: r2(c.rev), cost_sar: r2(c.cost), profit_sar: r2(c.rev - c.cost),
      total_incl_vat_sar: r2(c.rev), amount_received_sar: r2(c.rev), amount_remaining_sar: 0,
    })).concat([Object.assign({}, base, {
      id: 'ov-open', invoice_no: 'OV-OPEN', client_group: 'Harlow Trading', customer_raw_name: 'Harlow Trading',
      integrity_status: 'partly_paid', revenue_sar: 5000, cost_sar: 0, profit_sar: 5000,
      total_incl_vat_sar: 5000, amount_received_sar: 0, amount_remaining_sar: 5000,
    })]);
    FIN.p = { year: 'all', part: 'all' };
    FIN.tab = 'overview';
    if (window.finGo) finGo('overview'); else render();
  }, { rev, cost });

  /* Printed text only: each card's label and the figure a reader ends up with (the exact line if
     one is printed, otherwise the shortened headline). */
  const readCards = () => p.evaluate(() => {
    const view = document.getElementById('view');
    const unshort = (s) => {
      s = String(s || '').trim().replace(/,/g, '');
      const m = s.match(/^(-?[\d.]+)([KM])?$/);
      return m ? Number(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1) : null;
    };
    const out = {};
    [].slice.call(view.querySelectorAll('.card')).forEach((c) => {
      const lines = (c.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const label = lines[0];
      const exact = lines.find((l) => /^[\d,]+ SAR$/.test(l));
      const headline = lines[1];
      const v = exact ? Number(exact.replace(/[^\d]/g, '')) : unshort(String(headline).replace(/SAR/, ''));
      if (v !== null && !(label in out)) out[label] = { v, used: exact ? 'exact' : 'short', headline };
    });
    return { cards: out, prose: (view.innerText || '').replace(/\s+/g, ' ') };
  });

  const pick = (cards, re) => { const k = Object.keys(cards).find((x) => re.test(x)); return k ? cards[k] : null; };

  const run = async (rev, cost, label) => {
    await seed(rev, cost);
    await p.waitForTimeout(1500);
    const c = await readCards();
    const R = pick(c.cards, /^Revenue$/i), C = pick(c.cards, /^Cost$/i), P = pick(c.cards, /^Profit$/i);
    note(`${label}: Revenue ${R && R.v} (${R && R.used}) − Cost ${C && C.v} (${C && C.used}) = ${R && C ? R.v - C.v : '?'}; Profit printed ${P && P.v}`);
    return { ...c, R, C, P };
  };

  /* ---- 1. control ---- */
  const ctl = await run(1000, 400, 'control');
  if (ctl.R && ctl.C && ctl.P && ctl.R.v - ctl.C.v === ctl.P.v && ctl.R.v === 3000)
    ok('control: three whole-riyal invoices — the printed Revenue minus the printed Cost is exactly the printed Profit, and this probe can read the cards');
  else
    fail(`control: could not read a clean set of cards (${JSON.stringify({ R: ctl.R, C: ctl.C, P: ctl.P })}) — nothing below can be concluded`);

  /* ---- 2. THE QUESTION ---- */
  /* 1000.10 / 400.60 is chosen, not arbitrary. round(x)−round(y) and round(x−y) agree for most
     fractional parts; they part company when the cost's fraction is the larger one and the
     difference lands on a half — here Revenue 3,000.30, Cost 1,201.80, Profit 1,798.50, which
     print 3,000 − 1,202 = 1,798 beside a Profit of 1,799. An earlier draft used 1000.40 / 400.60,
     which the app renders consistently, so the check passed and proved nothing (cycle 48: a check
     that cannot fail is not a check; cycle 63 had to do the same thing deliberately). */
  const frac = await run(1000.10, 400.60, 'with hallalas');
  const exactProfit = ((1000.10 - 400.60) * 3).toFixed(2);
  /* The substantive requirement, not a word (cycles 57, 62): the screen must carry the exact
     profit figure when the three printed cards cannot be made to agree. */
  const statesExact = new RegExp(exactProfit.replace('.', '\\.')).test(frac.prose || '');
  if (frac.R && frac.C && frac.P && frac.R.v - frac.C.v === frac.P.v)
    ok(`money carrying hallalas still satisfies the one equation these cards exist to show: ${frac.R.v} − ${frac.C.v} = ${frac.P.v}`);
  else if (statesExact)
    ok(`the three printed cards cannot satisfy Profit = Revenue − Cost (${frac.R.v} − ${frac.C.v} = ${frac.R.v - frac.C.v}, Profit printed ${frac.P.v}) and the screen states the exact profit`);
  else
    fail(`the Overview prints Revenue ${frac.R && frac.R.v} and Cost ${frac.C && frac.C.v}, which come to ${frac.R && frac.C ? frac.R.v - frac.C.v : '?'}, beside a Profit printed ${frac.P && frac.P.v} — with nothing on screen accounting for it. Profit = Revenue − Cost is the ONE relation across these six cards, and it is the first thing anyone checks. Each figure is shortened by moneyS() and given an exact line only when the short form hides a whole riyal, so all three can be individually defensible and jointly wrong.`);

  /* ---- 3. the deliberate non-relations survive ---- */
  const outC = pick(frac.cards, /Outstanding/i), invC = pick(frac.cards, /^Invoices$/i);
  if (outC && outC.v === 5000 && invC && invC.v === 3)
    ok('Outstanding still reports the 5,000 owed on a live invoice the other five cards exclude, and Invoices is still a count of verified invoices (3) — the two documented non-relations are intact, not tidied away to make the cards tie');
  else
    fail(`the documented non-relations changed: Outstanding ${outC && outC.v} (expected 5,000 from the unpaid live invoice), Invoices ${invC && invC.v} (expected 3 verified). Outstanding is deliberately measured over all live invoices — cycle 4 fixed the opposite bug, and narrowing it to make the cards agree would re-break it.`);

  /* ---- 4. nothing moved ---- */
  const raw = await p.evaluate(() => {
    const V = (FIN.rows || []).filter((r) => r.integrity_status === 'verified_paid');
    return { rev: V.reduce((a, r) => a + (+r.revenue_sar || 0), 0), prof: V.reduce((a, r) => a + (+r.profit_sar || 0), 0) };
  });
  if (Math.abs(raw.rev - 3000.3) < 0.005 && Math.abs(raw.prof - 1798.5) < 0.005)
    ok(`nothing moved: the verified revenue behind the cards is still ${raw.rev.toFixed(2)} and the profit ${raw.prof.toFixed(2)}`);
  else
    fail(`the underlying figures moved: ${JSON.stringify(raw)}. This cycle may change what is said about a number, never the number.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\noverview-cards-printed-arithmetic OK — the one equation these cards exist to show holds as printed, or the screen says why not');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
