/* probe-no-invented-cost.mjs — the two money rules, on the proposal editor, the Today inbox and
   the offer→booking hand-off (2026-09-02, round 29). Found by the eight-area sweep, each one
   confirmed in source before it was touched.

   M1 — VAT never enters cost, profit or revenue.
   M8 — cost is approved expenses only: never fabricate a number to fill a gap; leave it unknown
        and say why.

   Three real breaches, all fixed and locked here:
     1. `offerMargin` was `total − cost`, and o_calc builds total as
        ticket + partner + service + VAT + DIP — so **VAT sat inside the quoted margin**. It is
        now taken net of VAT.
     2. The same margin read a BLANK cost as 0 through onum(), so an unpriced proposal printed
        its whole sale as profit. A margin with no recorded cost is now UNKNOWN and the editor
        says "Cost not recorded" instead of a number.
     3. Today's "low-profit offers" chip used `onum(o.cost)||base*0.85` — with no cost recorded
        it INVENTED one at 85% of base and judged the offer on the invented figure — and it
        OR-ed in `approvalStatus==='Pending'`, so a healthy 60%-margin deal awaiting sign-off was
        reported as low profit. The invented cost is gone; awaiting-approval and no-cost offers
        are counted as their own categories and named on the group, so nothing is lost.
     4. `bookingFromOffer` wrote `totalCost: Math.round(fareTotal*0.85)` — a booking born of a
        proposal carried a fabricated cost that looked researched. It now carries the recorded
        cost, or none at all plus a `costNotRecorded` flag.

   Sabotage: put `||base*0.85` back in core-06 → the no-cost offer is judged low-margin → red.
   Put VAT back into offerMargin → the margin check → red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8395;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.accept());
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

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(6500);

  // ---- 1 & 2: the margin arithmetic, straight from the app's own function
  const m = await p.evaluate(() => {
    // a fully priced proposal: sale 12,520 of which VAT 1,620; cost 9,000
    const priced = { id: 'qa-m1', ref: 'QA-M1', total: '12520', vat: '1620', cost: '9000', currency: 'SAR', options: [] };
    // the same proposal with NO cost recorded
    const nocost = { id: 'qa-m2', ref: 'QA-M2', total: '12520', vat: '1620', cost: '', currency: 'SAR', options: [] };
    return {
      pricedMargin: offerMargin(priced),
      pricedText: offerMarginText(priced),
      noCostMargin: offerMargin(nocost),
      noCostText: offerMarginText(nocost),
      net: offerNet(priced),
    };
  });
  if (m.pricedMargin === 1900) ok('a priced proposal: margin 1,900 = (12,520 sale − 1,620 VAT) − 9,000 cost — VAT is OUT of the margin (M1)');
  else fail('margin with VAT excluded should be 1900, got ' + m.pricedMargin + ' (VAT is still inside it)');
  if (m.net === 10900) ok('the net sale behind it is 10,900, i.e. the quote minus its VAT');
  else fail('offerNet = ' + m.net + ', expected 10900');
  if (m.noCostMargin === null) ok('a proposal with NO cost recorded has an UNKNOWN margin, not a number (M8)');
  else fail('no-cost margin returned ' + m.noCostMargin + ' — a blank cost is being read as zero, so the whole sale prints as profit');
  if (/Cost not recorded/.test(m.noCostText)) ok('…and the editor says "' + m.noCostText + '" instead of printing a figure');
  else fail('no-cost margin text is ' + JSON.stringify(m.noCostText));
  const ar = await p.evaluate(() => { LANG = 'ar'; const r = offerMarginText({ total: '100', vat: '0', cost: '' }); LANG = 'en'; return r; });
  if (/التكلفة غير مسجّلة/.test(ar)) ok('…and it says so in Arabic too: ' + ar); else fail('Arabic no-cost wording: ' + JSON.stringify(ar));

  // ---- 3: Today's low-profit chip
  const today = await p.evaluate(() => {
    DB.offers = [
      // healthy margin, awaiting approval — must NOT be called low profit
      { id: 'qa-o-fat', ref: 'QA-FAT', client: 'Test Company 1', approvalStatus: 'Pending', cost: '4000', options: [{ base: '10000', taxes: '0', anc: '0', fee: '0', items: [], freebies: [] }] },
      // no cost recorded — margin unknown, must NOT be judged on an invented cost
      { id: 'qa-o-nocost', ref: 'QA-NOCOST', client: 'Test Company 2', approvalStatus: 'Not required', cost: '', options: [{ base: '10000', taxes: '0', anc: '0', fee: '0', items: [], freebies: [] }] },
      // genuinely thin: cost 9,900 against a 10,000 sale = 1%
      { id: 'qa-o-thin', ref: 'QA-THIN', client: 'Test Company 3', approvalStatus: 'Not required', cost: '9900', options: [{ base: '10000', taxes: '0', anc: '0', fee: '0', items: [], freebies: [] }] },
      // no cost recorded AND a 1,200 giveaway. This is the one the old code got wrong: it invented
      // a cost of 8,500 (85% of base), added the 1,200 freebie, and reported a 3% margin on a
      // proposal nobody has costed yet. Margin is unknown here, full stop.
      { id: 'qa-o-free', ref: 'QA-FREE', client: 'Test Company 4', approvalStatus: 'Not required', cost: '', options: [{ base: '10000', taxes: '0', anc: '0', fee: '0', items: [], freebies: [{ cost: '1200' }] }] },
    ];
    openLead = null; current = 'today'; render();
    return null;
  });
  await p.waitForTimeout(1200);
  const chip = await p.evaluate(() => {
    // read the chip out of the DOM, not out of innerText — the label sits in .l, the count in .v
    let low = null;
    document.querySelectorAll('#view .chip').forEach((c) => {
      const l = (c.querySelector('.l') || {}).textContent || '';
      if (/low-profit offers/i.test(l)) low = +((c.querySelector('.v') || {}).textContent || '').trim();
    });
    // the "Low-margin offers / approvals" group and its sub-line
    let group = '';
    document.querySelectorAll('#view .v19-today-group').forEach((g) => {
      const h = (g.querySelector('h3') || {}).textContent || '';
      if (/low-margin offers/i.test(h)) group = g.textContent || '';
    });
    return { low, group, hasFat: /QA-FAT/.test(group), hasNoCost: /QA-NOCOST/.test(group), hasThin: /QA-THIN/.test(group), hasFree: /QA-FREE/.test(group), note: /awaiting approval/.test(group), noCostNote: /no cost recorded/.test(group) };
  });
  if (chip.low === 1) ok('"Low-profit offers" counts exactly 1 — only the genuinely thin proposal (1% margin)');
  else fail('low-profit chip reads ' + chip.low + ' (expected 1: the healthy pending one and the no-cost one must not be in it)');
  if (chip.hasThin) ok('the thin proposal QA-THIN is listed as the low-margin one');
  else fail('the genuinely thin proposal is missing from the low-margin group');
  if (!chip.hasFat && !chip.hasNoCost) ok('…and neither the healthy pending-approval one nor the no-cost one is listed there');
  else fail('the low-margin group lists something that is not low margin (QA-FAT=' + chip.hasFat + ', QA-NOCOST=' + chip.hasNoCost + ')');
  if (!chip.hasFree) ok('QA-FREE — no cost recorded, 1,200 given away — is NOT called low-margin: the old code invented 8,500 of cost, added the giveaway and reported 3% on a proposal nobody has costed');
  else fail('QA-FREE is being judged low-margin on an invented cost (M8)');
  if (chip.note && chip.noCostNote) ok('the group names what was split out: "awaiting approval" and "no cost recorded" — nothing is silently dropped');
  else fail('the split-out categories are not named on the group (note=' + chip.note + ', noCost=' + chip.noCostNote + ')');

  // ---- 4: offer → booking never invents a cost
  const bk = await p.evaluate(() => {
    DB.bookings = DB.bookings || [];
    DB.offers.push({ id: 'qa-o-conv', ref: 'QA-CONV', client: 'Test Company 1', total: '27600', vat: '3600', cost: '', currency: 'SAR', options: [{ base: '24000', taxes: '3600', anc: '0', fee: '0', items: [], freebies: [] }] });
    const before = DB.bookings.length;
    bookingFromOffer('qa-o-conv');
    const made = DB.bookings[DB.bookings.length - 1];
    return { grew: DB.bookings.length - before, totalCost: made && made.totalCost, flag: made && made.costNotRecorded, sale: made && made.totalSale };
  });
  if (bk.grew === 1) ok('converting a proposal creates one booking');
  else fail('booking creation: ' + JSON.stringify(bk));
  const inventedish = Number(bk.totalCost);
  if (!bk.totalCost || inventedish === 0) ok('the booking carries NO cost when none was recorded — the old code wrote 85% of the sale (' + Math.round(27600 * 0.85) + ') as if it were real');
  else fail('booking totalCost = ' + JSON.stringify(bk.totalCost) + ' — a cost was invented again');
  if (bk.flag === true) ok('…and it is flagged costNotRecorded, so the gap is visible rather than silent');
  else fail('costNotRecorded flag is ' + JSON.stringify(bk.flag));
  const withCost = await p.evaluate(() => {
    DB.offers.push({ id: 'qa-o-conv2', ref: 'QA-CONV2', client: 'Test Company 1', total: '10000', vat: '0', cost: '6000', currency: 'SAR', options: [{ base: '10000', taxes: '0', anc: '0', fee: '0', items: [], freebies: [] }] });
    bookingFromOffer('qa-o-conv2');
    const made = DB.bookings[DB.bookings.length - 1];
    return { totalCost: made && made.totalCost, flag: made && made.costNotRecorded };
  });
  if (Number(withCost.totalCost) === 6000 && withCost.flag === false) ok('a proposal that DOES record a cost passes its real 6,000 through, unflagged');
  else fail('recorded cost did not carry through: ' + JSON.stringify(withCost));

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nno-invented-cost OK — VAT stays out of margin, and a missing cost stays missing');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
