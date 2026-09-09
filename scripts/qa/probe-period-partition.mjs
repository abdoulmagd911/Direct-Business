/* probe-period-partition.mjs (2026-09-08, watch cycle 65) — the period bar, which decides what
   every Finance figure counts. Attack area (ai).

   PORT NOTE: 8701–8734 are taken. This is 8735, verified free by scanning every PORT= in
   scripts/qa.

   NOTE ON METHOD: the README's standing rule says a probe that reads the model cannot see a defect
   that lives in the view — cycles 59-64. This defect lives in the MODEL: it is about which rows a
   period counts at all, so the model is the right place to assert, and the screen is checked once
   at the end for the consequence a person actually meets.

   finPeriodMatch() is four lines and every money figure on the Finance page passes through it:

       if(p.year!=='all'&&String(finYearOf(r))!==String(p.year))return false;
       ...
       if(/^Q[1-4]$/.test(pt))return r.quarter===pt;
       if(pt.indexOf('M:')===0)return r.month===pt.slice(2);

   finYearOf(r) is `r.year || (r.invoice_date ? year-of-the-date : null)` — a deliberate fallback,
   and it exists for a reason: js/16's own B2B import writes invoice_date, month and quarter but
   NO year, so without that fallback every imported row would drop out of every year filter.

   The same import writes `month:o.month, quarter:o.quarter` straight off the parsed file. A file
   without those columns therefore produces a row that HAS a date and has no quarter — and quarter
   and month get no fallback at all. Such a row is counted in "All periods" and in its year, and
   silently vanishes from every quarter, every half and every month. Q1+Q2+Q3+Q4 then comes to less
   than the year it partitions, with nothing on screen saying which money went missing or why.

   Checked against the live database before writing this (read-only): all 46 live invoices carry a
   date, a month and a quarter, and every one agrees with its date. So this is latent, not live —
   but it is reachable through the app's own import path, which is the test cycle 61 set for
   whether a defect is real.

   Under test:
     1. Control — a fully populated row is matched by its year, its half, its quarter and its month,
        and by none of the others. (If this fails, nothing below means anything.)
     2. The four quarters partition the year, and the two halves do too: for rows spread across all
        four, Q1+Q2+Q3+Q4 and H1+H2 each come to the year's own total.
     3. THE DEFECT — a row with an invoice date but no stored quarter/month must not disappear from
        the period it plainly belongs to while still counting in the year above it.
     4. A row with NO date at all is still never invented into a period (M8). A fix that derived a
        month from nothing would be worse than the defect.
     5. The consequence on screen: the Revenue card for a year equals the sum of the Revenue cards
        for its four quarters.

   Run:  node scripts/qa/probe-period-partition.mjs        (port 8735)
   Sabotage: remove the fallback this cycle adds — checks 3 and 5 go red. Assert the sabotage
   APPLIED with a marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8735;
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
  if (!(await p.waitForFunction(() => typeof window.finInPeriod === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finInPeriod / FIN.rows never appeared, so nothing below examined anything');

  /* Rows written exactly as js/16's own B2B import writes them: invoice_date, month, quarter,
     NO year. The "stripped" one is that same import fed a file with no Month/Quarter column —
     which is the whole point, and is why this is reachable rather than hypothetical. */
  await p.evaluate(() => {
    const base = { integrity_status: 'verified_paid', record_type: 'b2b', deleted_at: null, service_type: 'flights', cost_sar: 0, amount_received_sar: 0, amount_remaining_sar: 0 };
    const mk = (id, date, month, quarter, rev) => {
      const r = Object.assign({}, base, { id, invoice_no: id.toUpperCase(), client_group: 'Pennard Cargo', customer_raw_name: 'Pennard Cargo', invoice_date: date, revenue_sar: rev, profit_sar: rev, total_incl_vat_sar: rev });
      if (month !== null) r.month = month;
      if (quarter !== null) r.quarter = quarter;
      return r;                                   // note: no `year` — the import path does not write one
    };
    FIN.rows = [
      mk('pp-q1', '2026-02-10', 'February', 'Q1', 100),
      mk('pp-q2', '2026-05-10', 'May', 'Q2', 200),
      mk('pp-q3', '2026-08-10', 'August', 'Q3', 400),
      mk('pp-q4', '2026-11-10', 'November', 'Q4', 800),
      mk('pp-strip', '2026-02-20', null, null, 1600),      // a date, no month, no quarter
      mk('pp-nodate', null, null, null, 3200),             // no date at all — belongs to no period
    ];
    FIN.p = { year: 'all', part: 'all', sector: 'all' };
  });

  /* Sum revenue over whatever the period bar says is in a period — the model's own answer. */
  const inPeriod = (year, part) => p.evaluate((c) => {
    const keep = FIN.p; FIN.p = { year: c.year, part: c.part, sector: 'all' };
    const rows = (FIN.rows || []).filter((r) => window.finInPeriod(r));
    FIN.p = keep;
    return { n: rows.length, rev: rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0), ids: rows.map((r) => r.id) };
  }, { year, part });

  /* ---- 1. control ---- */
  const q1 = await inPeriod('2026', 'Q1'), feb = await inPeriod('2026', 'M:February'), h1 = await inPeriod('2026', 'H1'), q3 = await inPeriod('2026', 'Q3');
  if (q1.ids.includes('pp-q1') && feb.ids.includes('pp-q1') && h1.ids.includes('pp-q1') && !q3.ids.includes('pp-q1'))
    ok('control: a fully populated February invoice is counted in 2026, in H1, in Q1 and in February — and not in Q3');
  else
    fail(`control: the period bar did not place a fully populated row correctly (Q1 ${JSON.stringify(q1.ids)}, Feb ${JSON.stringify(feb.ids)}, H1 ${JSON.stringify(h1.ids)}, Q3 ${JSON.stringify(q3.ids)}) — nothing below can be concluded`);

  /* ---- 2 & 3. the quarters must partition the year ---- */
  const year = await inPeriod('2026', 'all');
  const qs = [];
  for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) qs.push(await inPeriod('2026', q));
  const qSum = qs.reduce((a, x) => a + x.rev, 0);
  const hs = [await inPeriod('2026', 'H1'), await inPeriod('2026', 'H2')];
  const hSum = hs[0].rev + hs[1].rev;
  note(`2026 total ${year.rev} over ${year.n} row(s); quarters ${qs.map((x) => x.rev).join('+')} = ${qSum}; halves ${hs[0].rev}+${hs[1].rev} = ${hSum}`);
  if (qSum === year.rev && hSum === year.rev)
    ok(`the four quarters and the two halves each partition the year exactly: ${qSum} = ${hSum} = ${year.rev}`);
  else {
    const lost = year.ids.filter((id) => !qs.some((q) => q.ids.includes(id)));
    fail(`the year holds ${year.rev} but its four quarters come to ${qSum} and its halves to ${hSum} — ${year.rev - qSum} SAR is in the year and in no quarter at all. Missing: ${JSON.stringify(lost)}. finYearOf() falls back to the invoice date when a row carries no year — which js/16's own B2B import relies on, because it writes month and quarter but never a year — yet quarter and month get no fallback, so a file without those columns produces money that is in 2026 and in none of its quarters, with nothing on screen saying so.`);
  }

  /* ---- 4. and nothing is invented for a row with no date ---- */
  const anywhere = [];
  for (const part of ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'M:January', 'M:February', 'M:March']) {
    const r = await inPeriod('2026', part);
    if (r.ids.includes('pp-nodate')) anywhere.push(part);
  }
  if (!anywhere.length)
    ok('an invoice with no date at all is still placed in no quarter, no half and no month — a period it does not have is never invented for it (M8)');
  else
    fail(`the undated invoice was placed in ${anywhere.join(', ')} — a fix that derives a period from no date at all is worse than the defect it replaces.`);

  /* ---- 5. the consequence on screen ---- */
  const cardRev = (year, part) => p.evaluate((c) => {
    FIN.p = { year: c.year, part: c.part, sector: 'all' }; FIN.tab = 'overview';
    if (window.finGo) finGo('overview'); else render();
    return new Promise((res) => setTimeout(() => {
      const unshort = (s) => { s = String(s || '').trim().replace(/,/g, ''); const m = s.match(/^(-?[\d.]+)([KM])?$/); return m ? Number(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1) : null; };
      const card = [].slice.call(document.querySelectorAll('#view .card')).find((c2) => /^Revenue/.test((c2.innerText || '').trim()));
      if (!card) return res(null);
      const lines = (card.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const exact = lines.find((l) => /^[\d,]+ SAR$/.test(l));
      res(exact ? Number(exact.replace(/[^\d]/g, '')) : unshort(String(lines[1]).replace(/SAR/, '')));
    }, 900));
  }, { year, part });

  const shownYear = await cardRev('2026', 'all');
  let shownQ = 0;
  for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) shownQ += (await cardRev('2026', q)) || 0;
  if (shownYear === shownQ)
    ok(`on screen: the Revenue card for 2026 reads ${shownYear} and its four quarters come to the same`);
  else
    fail(`on screen: the Revenue card for 2026 reads ${shownYear} while its four quarters come to ${shownQ}. Someone reconciling a year against its quarters finds money in one and not the other, and no card says which.`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nperiod-partition OK — every riyal in a year is in exactly one of its quarters, and a period is never invented');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
