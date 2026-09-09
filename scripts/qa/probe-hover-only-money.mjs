/* probe-hover-only-money.mjs (2026-09-08, watch cycle 50) — money the file itself decided needed
   an exact figure, put somewhere a phone cannot reach. Attack area (tt).

   PORT NOTE: this session's block 8701–8720 is full and 8721 went to cycle 49. This is 8722,
   verified free by scanning every PORT= in scripts/qa.

   Cycle 49 fixed the Collections & ageing buckets, which rounded money with no exact figure
   anywhere. Its brief for this cycle was to ask the remaining moneyS() callers ONE AT A TIME
   rather than sweep them — is this number acted on, or glanced at? Reading them that way turned
   up a sharper question than "which ones matter", because the file has already answered it.

   Five of the remaining callers carry title="…exact…" on the element:

       Client credit (held)      title=money(credit)
       the summary cards row     title=money(c[1])
       Confirmed revenue         title=money(cRev)
       Confirmed cost            title=money(cCost)
       Confirmed profit          title=money(cProf)

   Somebody looked at each of those and decided the rounded form was not enough. That judgement
   is already made; it is simply delivered through a mechanism that does not exist on a phone.
   A title is a hover, and the owner reads Finance on a phone — so on the device he actually uses,
   "8.76M" is the whole answer and the exact figure he asked for is unreachable.

   The rule this probe holds, which needs no per-tile argument: IF A NUMBER WAS JUDGED TO NEED ITS
   EXACT VALUE, IT NEEDS IT ON A PHONE TOO. Anything the file puts in a money title must also be
   readable as text.

   Under test, at 390x844 and at desktop width, across the Finance tabs that carry these tiles:
     1. Control — the tiles render and the fixture's own money is on screen, so the checks below
        are measured against a page that drew. (If this fails, nothing below means anything.)
     2. Every element carrying a money title also shows that exact figure as visible text.
     3. The short form survives — the tiles still read at a glance.
     4. The rule is enforced by SCANNING the DOM, not by naming five tiles: a sixth added later
        with a title and no text is caught without anyone remembering to update this probe.

   2026-09-08 (watch cycle 51): the three Confirmed tiles are EXERCISED now. Cycle 50 left them
   unproven and said so — its sabotage on them reddened nothing because they sum
   finance_TRANSACTIONS, and the mock's default rows total 51,500 / 42,600 / 8,900, every one
   exact when abbreviated. This probe seeds its own transactions with awkward amounts, and
   removing finExactUnder from the Confirmed revenue tile now fails the run by name
   ("7,222,221.00 SAR"). The REPORT that named the gap is kept, not deleted: it stays silent
   while every tile rounds and speaks again the moment a fixture stops exercising one.

   Run:  node scripts/qa/probe-hover-only-money.mjs        (port 8722)
   Sabotage: remove the exact line from one of the tiles in js/16 — check 2 goes red and names
   the tile. Assert the sabotage APPLIED before believing a green run (cycle 49), and restore
   from a POST-fix baseline verified by grepping the fix's own comment (cycle 44).            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8722;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

/* money at sizes that force moneyS() to round: millions and hundreds of thousands. */
const inv = (id, total, cost) => ({
  id, invoice_no: 'HV-' + id, line_no: 1, client_group: 'Hover Co ' + id, customer_raw_name: 'Hover Co ' + id,
  invoice_date: '2026-05-04', month: 'May', quarter: 'Q2', products: 'Flights', service_type: 'Flights',
  record_type: 'b2b', total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total,
  cost_sar: cost, profit_sar: total - cost, amount_received_sar: total, amount_remaining_sar: 0,
  integrity_status: 'verified_paid', revenue_way: 'invoice', deleted_at: null, source_batch: 'qa-hover', vat_sar: 0,
});
/* 2026-09-08 (watch cycle 51): the Confirmed revenue/cost/profit tiles sum finance_TRANSACTIONS,
   not invoices, and the mock's default rows total 51,500 / 42,600 / 8,900 — every one of them
   EXACT when abbreviated ("51.5K" is 51,500). So finExactUnder returned nothing for those three
   tiles with or without the fix, and cycle 50's sabotage on them reddened nothing. Cycle 50 said
   so in a REPORT rather than claiming cover it did not have; this seed closes it. The amounts
   below are deliberately awkward, so the short form loses something and the exact line has to be
   there. */
const txn = (id, amount, cost) => ({
  id, transaction_ref: 'TXN-HV-' + id, invoice_no: 'INV-HV-' + id, zatca_dpin: 'DPIN-HV-' + id,
  direct_uuid: null, business_id: 'b0', client_profile_id: 'cp0', product: 'Direct Hotels',
  service_type: 'Hotels', amount_sar: amount, expense_status: null, cost_confirmed_sar: cost,
  cost_estimate_sar: null, amount_received_sar: amount, amount_remaining_sar: 0, overdue: null,
  created_at_source: '2026-07-01T10:00:00Z', origin: 'booking', proposal_ref: null, source: 'qa-hover',
});
const srv = start(PORT, {
  finance_invoices: [inv('a', 8755055, 3211777), inv('b', 1234567, 456789)],
  finance_transactions: [txn('t1', 4444333, 1111222), txn('t2', 2777888, 999111)],
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [label, vp] of [['a phone', { width: 390, height: 844 }], ['desktop', { width: 1500, height: 950 }]]) {
    const ctx = await b.newContext({ viewport: vp });
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
    try { await p.waitForFunction(() => typeof window.finGo === 'function', { timeout: 90000 }); } catch (_) { }

    /* Walk the tabs that carry money tiles. The scan below is the point: it finds every element
       with a money title rather than naming the five that have one today. */
    const found = [];
    for (const tab of ['overview', 'clients', 'ledger']) {
      await p.evaluate((t) => { try { current = 'finance'; FIN.p = { year: 'all', part: 'all', sector: 'all' }; render(); if (window.finGo) finGo(t); } catch (_) { } }, tab);
      await p.waitForTimeout(2000);
      const hits = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('[title]').forEach((el) => {
          const t = (el.getAttribute('title') || '').trim();
          /* a money title: digits with thousands separators and two decimals, e.g. "8,755,055.00 SAR" */
          const m = t.match(/^([\d,]+\.\d{2})\s*SAR$/);
          if (!m) return;
          const exactWithDecimals = m[1];
          const exactRounded = Math.round(Number(exactWithDecimals.replace(/,/g, ''))).toLocaleString('en-US');
          const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
          /* Only figures where the SHORT FORM LOSES SOMETHING are owed an exact line. "51.5K" is
             exactly 51,500 — the title carries ".00" decimals but no information is missing, and
             demanding a second line there would be this probe inventing a defect rather than
             finding one. Judged by round-tripping the abbreviation back to a number, the same
             test the app uses, so the two cannot drift apart. */
          const short = (text.match(/([\d.,]+)\s*([KM])\b/) || [])[0];
          let lossless = false;
          if (short) {
            const back = Number(String(short).replace(/,/g, '').replace(/\s/g, '').replace(/M$/, 'e6').replace(/K$/, 'e3'));
            lossless = isFinite(back) && Math.round(back) === Math.round(Number(exactWithDecimals.replace(/,/g, '')));
          }
          const lbl = (el.previousElementSibling && el.previousElementSibling.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
          out.push({ label: lbl, title: t, exactRounded, text, lossless, hasExactInText: text.includes(exactRounded) || text.includes(exactWithDecimals) });
        });
        return out;
      });
      hits.forEach((h) => found.push(Object.assign({ tab }, h)));
    }

    if (found.length >= 3)
      ok(`${label}: found ${found.length} money figure(s) the file itself marked as needing an exact value (a money title) — the checks below are measured against tiles that actually drew`);
    else { fail(`${label}: only ${found.length} money title(s) found across the Finance tabs, so this run examined almost nothing. Either the tiles did not render or the title format changed — the scan looks for "1,234.00 SAR".`); await ctx.close(); continue; }

    const hidden = found.filter((h) => !h.hasExactInText && !h.lossless);
    if (!hidden.length)
      ok(`${label}: every figure whose short form loses something also shows its exact value as visible text — the judgement that this number needs to be exact now survives on a device with no hover (${found.filter((h) => h.lossless).length} of the ${found.length} lose nothing when abbreviated and are already exact as shown)`);
    else
      fail(`${label}: ${hidden.length} money figure(s) keep their exact value in a title and nowhere else, so on a phone the rounded form is the whole answer: ${JSON.stringify(hidden.map((h) => h.tab + ' · shows "' + h.text.slice(0, 24) + '" · title says ' + h.title))}. Somebody already decided each of these needed to be exact — that decision is simply delivered through a hover, which this device does not have.`);

    const short = found.filter((h) => /[KM]\b/.test(h.text));
    if (short.length)
      ok(`${label}: and ${short.length} of them still carry the short form, so the tiles read at a glance as well as exactly`);
    else
      console.log(`  · REPORT: no abbreviated form left on any of these tiles at this width — not a failure (the fixture may be small enough to print in full), but if the short form has been replaced rather than added to, that is a different regression.`);

    /* WHAT THIS RUN CANNOT PROVE — said out loud, rather than left for a green line to imply.
       Sabotage on the "Confirmed revenue" tile (removing its exact line) changed nothing here.
       The first explanation written down was that the tile never rendered; that was wrong, and
       checking rather than believing it is what caught it — the tile IS on screen. It is inert
       for a duller reason: the values these tiles carry in this fixture are LOSSLESS (51.5K is
       exactly 51,500), so finExactUnder returns nothing for them with or without the fix. The
       edit on those three tiles is therefore real but unexercised, and this probe says so every
       run until a fixture makes them round. */
    const LOSSY = found.filter((h) => !h.lossless).map((h) => h.label).join(' | ');
    const inertTiles = found.filter((h) => h.lossless).map((h) => h.label + ' (' + h.text.slice(0, 14) + ')');
    if (inertTiles.length)
      console.log(`  · REPORT (a gap in THIS probe, not a defect): ${inertTiles.length} money tile(s) carry a title but abbreviate losslessly in this fixture, so the exact-figure fix on them is UNEXERCISED — sabotaging it there reddens nothing: ${JSON.stringify(inertTiles)}. Tiles this run does prove: ${JSON.stringify(LOSSY.slice(0, 160))}`);

    await ctx.close();
  }
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nhover-only-money OK — no money figure in Finance keeps its exact value only in a tooltip');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
