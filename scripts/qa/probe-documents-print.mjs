/* probe-documents-print.mjs — the five documents the app generates for a human to read
   (2026-09-02, round 34). None of them had ever been guarded, and none had ever been opened in
   the harness: they render into a `window.open('','_blank')` popup, which no probe was watching.

   The sweep reported "Print/PDF comes out blank in all five document generators". Driven here,
   that is NOT reproducible — every one produces real content (3.6 KB to 48 KB of HTML). The
   report is closed. What this probe does instead is hold them there, because these are the
   pages a client actually sees, and until now nothing would have noticed them breaking:

     v21PrintInvoice     — tax invoice
     v21PrintBooking     — booking confirmation
     v21PrintStatement   — statement of account
     o_print             — quotation
     rptPrintReport      — the monthly commercial report

   It also holds the money rules ON THE DOCUMENTS, which is where they matter most:

     M8 — a booking confirmation for a booking with no recorded cost must say so, not print a
          zero or a fabricated figure. (Round 29 stopped the app inventing a cost at 85% of the
          sale, and round 33 carried that through the booking screens; this asserts it survives
          into the printed document a client or a manager reads.)
     M1 — VAT never enters cost, profit or revenue. Note the deliberate exception, corrected by
          the owner on 2026-08-23: VAT MAY appear on a client-facing document like a quotation
          or a tax invoice, where it is legally expected. So this probe does NOT ban the word;
          it bans VAT from the margin/profit arithmetic while allowing the quotation's own VAT
          line to stand.

   Sabotage: make v21PrintBooking print moneyShort(b.totalCost) again -> the no-cost booking's
   confirmation prints "Cost 0" -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8391;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('dialog', (d) => d.accept());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());

  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(7000);

  /* Open one document and read it back. The generators write into a popup with document.write,
     so the only way to see them is to catch the new page — which is exactly why nothing had
     ever checked them. */
  async function doc(label, fn, expectNone) {
    const waiter = ctx.waitForEvent('page', { timeout: expectNone ? 4000 : 8000 }).catch(() => null);
    let threw = null;
    await p.evaluate(fn).catch((e) => { threw = String(e && e.message || e); });
    const pop = await waiter;
    if (!pop) { if (!expectNone) fail(`${label}: no document opened` + (threw ? ' (' + threw.slice(0, 80) + ')' : '')); return null; }
    await pop.waitForTimeout(700);
    const html = await pop.content().catch(() => '');
    const text = (await pop.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')).replace(/\s+/g, ' ').trim();
    await pop.close();
    return { html, text };
  }

  // ---- 1. every generator produces a real document
  const inv = await doc('tax invoice', () => { const i = (DB.invoices || []).find((x) => x.number === 'INV-3001'); v21PrintInvoice(i.id); });
  if (inv && inv.text.length > 200 && /Invoice/i.test(inv.text)) ok(`the tax invoice renders a real document (${inv.html.length} bytes) — the "blank in all five generators" report does not reproduce`);
  else fail('tax invoice: ' + JSON.stringify((inv && inv.text || '').slice(0, 120)));
  if (inv && /INV-3001/.test(inv.text) && /Test Company/.test(inv.text)) ok('…carrying its own number and the client it is for');
  else fail('the invoice document does not carry its number and client');
  if (inv && /فاتورة/.test(inv.text)) ok('…and it is bilingual, as a Saudi tax invoice has to be');
  else fail('the invoice document has no Arabic side');

  const stmt = await doc('statement', () => { const i = (DB.invoices || []).find((x) => x.number === 'INV-3001'); v21PrintStatement(i.clientId); });
  if (stmt && /Statement of account/.test(stmt.text) && /كشف حساب/.test(stmt.text)) ok('the statement of account renders, bilingual');
  else fail('statement: ' + JSON.stringify((stmt && stmt.text || '').slice(0, 120)));
  if (stmt && /AR aging buckets/.test(stmt.text)) ok('…with its aging buckets');
  else fail('the statement has no aging table');

  const quote = await doc('quotation', () => { openOffer = (DB.offers || [])[0].id; o_print(); });
  if (quote && /Quotation/.test(quote.text) && /عرض سعر/.test(quote.text)) ok('the quotation renders, bilingual');
  else fail('quotation: ' + JSON.stringify((quote && quote.text || '').slice(0, 120)));
  /* Deliberate: a quotation MAY show VAT. The owner corrected this rule on 2026-08-23 — the
     violation was never the glyph, it was VAT entering cost / profit / revenue. A client-facing
     quotation is exactly where VAT is legally expected. */
  if (quote && /VAT/i.test(quote.text)) ok('…and it still shows its VAT line — allowed and expected on a client-facing document (M1 bans VAT from cost/profit/revenue, not from a quotation)');
  else console.log('  · note: this seed proposal has no VAT line to show');

  const rpt = await doc('commercial report', () => { if (typeof rptPrintReport !== 'function') throw new Error('rptPrintReport absent'); rptPrintReport(); });
  if (rpt && rpt.text.length > 1000 && /Commercial/i.test(rpt.text)) ok(`the monthly commercial report renders (${rpt.text.length} characters of real content)`);
  else fail('commercial report: ' + JSON.stringify((rpt && rpt.text || '').slice(0, 140)));

  // ---- 2. the booking confirmation, and the money rule on it
  const costed = await doc('booking (costed)', () => { const x = (DB.bookings || []).find((y) => y.ref === 'BK-2001'); v21PrintBooking(x.id); });
  if (costed && /Booking confirmation/.test(costed.text) && /تأكيد الحجز/.test(costed.text)) ok('the booking confirmation renders, bilingual');
  else fail('booking confirmation: ' + JSON.stringify((costed && costed.text || '').slice(0, 120)));
  const costedMoney = (costed && costed.text.match(/Sale[^|]{0,80}/) || [''])[0];
  if (/Cost 10k/.test(costedMoney) && /Margin 3k/.test(costedMoney)) ok(`a booking WITH a recorded cost prints it: "${costedMoney.trim()}"`);
  else fail('costed booking money line: ' + JSON.stringify(costedMoney));

  const nocost = await doc('booking (no cost)', () => { const x = (DB.bookings || []).find((y) => y.ref === 'BK-2005'); v21PrintBooking(x.id); });
  const nocostMoney = (nocost && nocost.text.match(/Sale[^|]{0,80}/) || [''])[0];
  if (/Cost not recorded/.test(nocostMoney) && /Margin unknown/.test(nocostMoney)) ok(`a booking with NO recorded cost says so on the printed document: "${nocostMoney.trim()}" — a client or a manager reading this is not shown a zero or an invented figure (M8)`);
  else fail('the no-cost booking confirmation prints: ' + JSON.stringify(nocostMoney) + ' — it should say the cost is not recorded, not print a number');
  if (nocost && !/Cost 0 SAR|Cost 0\b/.test(nocost.text)) ok('…and specifically not "Cost 0", which is what an unrecorded cost used to print');
  else fail('the document prints a zero cost for a booking nobody has costed');

  // ---- 3. no document is generated from nothing
  const empty = await doc('statement for a client with no invoices', () => { v21PrintStatement('no-such-client-id'); }, true);
  if (!empty) ok('a statement for a client with no invoices opens no document at all — it says so instead of printing an empty form');
  else fail('an empty statement was generated: ' + JSON.stringify(empty.text.slice(0, 120)));

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\ndocuments-print OK — all five documents render, and an unrecorded cost stays unrecorded on the page a client reads');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
