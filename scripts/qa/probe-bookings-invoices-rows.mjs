/* probe-bookings-invoices-rows.mjs — Bookings / Invoices / Tickets / Archive, driven with rows
   for the first time (2026-09-02, round 33).

   THE HARNESS GAP THAT HID ALL OF THIS: `app_bookings` and `app_invoices` had NO seed in
   mock-supabase.mjs. js/35 lists them in its KEYS, so the empty answer REPLACED whatever the
   blob carried, and four pages — Bookings, Invoices, Tickets and the whole Archive screen —
   had never rendered a single row in any harness run. Same shape of gap as the reference pages
   (round 19) and SOP/SLA (round 20), and like both of those it was hiding real defects.

   What driving them found, and what this probe now holds:

   1. M8 ON THE BOOKINGS PAGE. `bkMargin` was sale − cost through onum(), so a booking with no
      cost recorded reported its ENTIRE SALE as margin — a 15,500 sale showing 15,500 of profit
      on the row, and the page's Margin total carrying it. Round 29 turned this from theory
      into practice: `bookingFromOffer` now deliberately writes NO cost instead of the
      fabricated 85% it used to, so "no cost recorded" is the normal shape of a booking
      converted from a proposal. The margin is now unknown, the row says so, the total counts
      only evidenced margins and names how many it left out.

   2. ARABIC WORDS THAT ONLY APPEAR ON A ROW. The TTL badges carry a number, so no dictionary
      entry could ever reach them — they are built per language now. Booking statuses were
      half-translated: 'Confirmed' was in the main dictionary and 'Ticketed' only in the
      Operations-board one, so a single column showed one row in Arabic and the next in
      English. The payment flag (.fopflag) sat outside every selector the Arabic layer scans.

   Also checked, and NOT a defect: archiving. It really does archive — the record leaves its
   list, appears under Archive, and Restore brings it back. The sweep's "archiving does not
   actually archive" report is not reproducible and is closed here rather than left hanging.

   Sabotage: restore bkMargin to sale − cost -> the no-cost booking's whole sale is margin
   again -> red. Drop the language check in ttlBadge -> the Arabic page shows "TTL in 20h". */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8392;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }
const AR = /[؀-ۿ]/;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
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

  const show = async (v) => { await p.evaluate((x) => { openLead = null; openBooking = null; openInvoice = null; openSup = null; current = x; render(); }, v); await p.waitForTimeout(1000); return p.evaluate(() => (document.getElementById('view') || {}).innerText || ''); };

  // ---- the four pages render rows at all
  const seeded = await p.evaluate(() => ({ bk: (DB.bookings || []).length, inv: (DB.invoices || []).length, tk: (DB.bookings || []).reduce((s, b) => s + (b.tickets || []).length, 0) }));
  if (seeded.bk >= 6 && seeded.inv >= 5) ok(`the harness now has ${seeded.bk} bookings, ${seeded.inv} invoices and ${seeded.tk} tickets — before this round it had none of any, on any run`);
  else fail('seed missing: ' + JSON.stringify(seeded));

  // ---- 1. the booking margin
  const bookings = await show('bookings');
  const rows = await p.evaluate(() => [...document.querySelectorAll('#view tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
  const noCostRow = rows.find((r) => /BK-2005/.test(r));
  if (noCostRow && /unknown/i.test(noCostRow)) ok('the booking with no cost recorded reads "unknown" in the Margin column, not its own sale');
  else fail('BK-2005 (sale 15,500, no cost) row reads: ' + JSON.stringify((noCostRow || '').slice(0, 120)));
  if (noCostRow && /\b16k\b/.test(noCostRow) && !/16k[^0-9]*16k/.test(noCostRow)) ok('…and its 16k sale is shown once, as a sale — the old code printed it again as margin');
  else if (noCostRow && /16k[^0-9]*16k/.test(noCostRow)) fail('the sale is being repeated as the margin: ' + JSON.stringify(noCostRow.slice(0, 120)));
  const costedRow = rows.find((r) => /BK-2001/.test(r));
  if (costedRow && /\b3k\b/.test(costedRow)) ok('a booking that DOES record a cost still shows its real margin (12,000 − 9,500 ≈ 3k)');
  else fail('BK-2001 margin row: ' + JSON.stringify((costedRow || '').slice(0, 120)));

  const totals = await p.evaluate(() => {
    const head = document.querySelector('#view .card[style*="flex-wrap"]');
    return head ? head.innerText.replace(/\s+/g, ' ').trim() : '';
  });
  // evidenced margins: 2500 + 2300 + 5000 + 800 + 800 = 11,400 -> "11k". With the no-cost
  // booking counted as pure profit it was 11,400 + 15,500 = 26,900 -> "27k".
  if (/\b11k\b/.test(totals)) ok('the page Margin total is 11k — the five bookings that have a cost recorded');
  else fail('margin total reads: ' + JSON.stringify(totals.slice(0, 200)));
  if (/\b27k\b/.test(totals)) fail('the total is still 27k — the uncosted booking is being added in as pure profit');
  else ok('…not the 27k the old code showed, which counted an uncosted 15,500 sale as 100% margin');
  /* Assert this by GEOMETRY, not by text. The first version of this note used class "ch-sub",
     and index.html carries `.card .ch-sub{display:none !important}` — a deliberate rule that
     hides grey helper lines inside cards. The note was in the DOM, read fine from textContent,
     and was invisible to every human being. A probe that only reads text cannot tell the
     difference between "we told the user" and "we wrote it into a hidden element". */
  const note = await p.evaluate(() => {
    const head = document.querySelector('#view .card[style*="flex-wrap"]');
    if (!head) return null;
    const hits = [...head.querySelectorAll('*')].filter((el) => /no cost recorded/.test(el.textContent || ''));
    const el = hits.filter((x) => !hits.some((o) => o !== x && x.contains(o)))[0];
    if (!el) return { present: false };
    const r = el.getBoundingClientRect();
    return { present: true, text: (el.textContent || '').trim(), w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (note && note.present && note.w > 0 && note.h > 0) ok(`…and the tile visibly says "${note.text}" (${note.w}×${note.h}px on screen), so what was left out is not dropped`);
  else if (note && note.present) fail('the "no cost recorded" note is in the DOM but renders at 0×0 — it is hidden from the user, which is the same as not saying it');
  else fail('the total does not say what it left out: ' + JSON.stringify(totals.slice(0, 200)));

  // the detail card must agree
  await p.evaluate(() => { const b = (DB.bookings || []).find((x) => x.ref === 'BK-2005'); if (b) openBookingFn(b.id); });
  await p.waitForTimeout(1100);
  const detail = await p.evaluate(() => (document.getElementById('view') || {}).innerText || '');
  if (/not recorded/.test(detail) && /unknown/.test(detail)) ok('the booking\'s own card says cost "not recorded" and margin "unknown" — it does not print a zero cost');
  else fail('the booking card still prints numbers for an unrecorded cost: ' + JSON.stringify(detail.replace(/\s+/g, ' ').slice(0, 220)));

  // ---- 2. Invoices and Tickets render sanely
  const invoices = await show('invoices');
  if (/INV-3001/.test(invoices) && /INV-3003/.test(invoices)) ok('the Invoices list renders its rows');
  else fail('invoices list: ' + JSON.stringify(invoices.slice(0, 200)));
  if (/Test Company/.test(invoices)) ok('…with the client resolved on each row, not a dash');
  else fail('invoice rows show no client name');
  const tickets = await show('tickets');
  if (/PNR200/.test(tickets) && /ADM/.test(tickets)) ok('the Tickets list renders, including the ADM-flagged one');
  else fail('tickets list: ' + JSON.stringify(tickets.slice(0, 200)));

  // ---- 3. archiving really archives (the sweep report said it did not — it does)
  const arch = await p.evaluate(() => {
    const inv = (DB.invoices || []).find((x) => x.number === 'INV-3001');
    softDeleteEntity('invoices', inv.id);
    current = 'invoices'; openInvoice = null; render();
    const gone = !((document.getElementById('view') || {}).innerText || '').includes('INV-3001');
    current = 'archive'; render();
    const inArchive = ((document.getElementById('view') || {}).innerText || '').includes('INV-3001');
    restoreEntity('invoices', inv.id);
    current = 'invoices'; render();
    const back = ((document.getElementById('view') || {}).innerText || '').includes('INV-3001');
    return { gone, inArchive, back };
  });
  if (arch.gone && arch.inArchive && arch.back) ok('archiving works: the invoice leaves its list, appears under Archive, and Restore brings it back — the sweep\'s "archiving does not archive" report does not reproduce');
  else fail('archive round trip: ' + JSON.stringify(arch));

  // ---- 4. Arabic, on rows
  await p.evaluate(() => { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); });
  const arBookings = await show('bookings');
  const leaks = [];
  if (/TTL (in )?\d|TTL expired/.test(arBookings)) leaks.push('TTL badge');
  if (/\bTicketed\b/.test(arBookings)) leaks.push('Ticketed');
  if (/\bCancelled\b/.test(arBookings)) leaks.push('Cancelled');
  if (/\bDraft\b/.test(arBookings)) leaks.push('Draft');
  if (/\bCredit\b/.test(arBookings)) leaks.push('Credit (payment flag)');
  if (!leaks.length) ok('in Arabic the Bookings rows carry no English left: TTL badges, statuses and the payment flag are all translated');
  else fail('English still showing on the Arabic Bookings rows: ' + leaks.join(', '));
  if (/المهلة/.test(arBookings)) ok('…the TTL badge reads «المهلة …» — it carries a number, so it had to be built per language, not looked up');
  else fail('the TTL badge is not in Arabic');
  if (/تم إصدار التذكرة/.test(arBookings) && /مؤكدة/.test(arBookings)) ok('…and Ticketed and Confirmed are BOTH Arabic — they used to be split across two dictionaries, so one column showed one row in each language');
  else fail('booking statuses are still inconsistent in Arabic');
  if (/غير معروف/.test(arBookings)) ok('…and the unknown margin says «غير معروف» rather than a number');
  else fail('the unknown margin is not translated');

  /* Today only shows TTL / overdue / dunning / queue / QC cards when there ARE bookings and
     invoices, so every word on them had gone unrendered in QA too. The QC group is the only
     one that renders conditionally (a ticketed booking with an incomplete checklist), and it
     was the one heading missing from the Arabic dictionary. */
  const arToday = await show('today');
  const todayGroups = await p.evaluate(() => [...document.querySelectorAll('#view .v19-today-group')].map((g) => ({ h: ((g.querySelector('h3') || {}).textContent || '').trim(), t: (g.textContent || '').replace(/\s+/g, ' ') })));
  const englishHeads = todayGroups.filter((g) => /[A-Za-z]{3}/.test(g.h.replace(/TTL|QC|PNR/g, '')));
  if (todayGroups.length >= 5 && !englishHeads.length) ok(`all ${todayGroups.length} Today group headings read Arabic — including the QC one, which only appears when a ticketed booking has an open checklist and so had never been rendered`);
  else fail('Today headings still English: ' + JSON.stringify(englishHeads.map((g) => g.h)));
  const todayText = todayGroups.map((g) => g.t).join(' ');
  const todayLeaks = [];
  if (/\bEXPIRED\b/.test(todayText)) todayLeaks.push('EXPIRED');
  if (/\bdunning:/.test(todayText)) todayLeaks.push('dunning:');
  if (/\bDated /.test(todayText)) todayLeaks.push('Dated');
  if (/\bStage: /.test(todayText)) todayLeaks.push('Stage:');
  if (/ · due /.test(todayText)) todayLeaks.push('due');
  if (/ticketed but quality gate open/.test(todayText)) todayLeaks.push('quality gate line');
  if (/approval: /.test(todayText)) todayLeaks.push('approval:');
  if (!todayLeaks.length) ok('…and the card lines under them are Arabic too (dates, dunning stage, approval, due, the QC sentence)');
  else fail('English left on the Arabic Today cards: ' + todayLeaks.join(', '));

  const arArchive = await show('archive');
  if (AR.test(arArchive)) ok('the Archive page reads Arabic too');
  else fail('the Archive page is still English in Arabic');
  await p.evaluate(() => { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); });

  // ---- 5. phone
  await p.setViewportSize({ width: 390, height: 844 });
  await show('bookings');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow <= 2) ok('on a 390px phone the Bookings page does not push the whole page sideways');
  else fail('the page scrolls horizontally by ' + overflow + 'px on a phone');
  await p.setViewportSize({ width: 1366, height: 900 });

  const realErrors = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', realErrors.length ? JSON.stringify(realErrors.slice(0, 5)) : 'none');
  if (realErrors.length) fail(realErrors.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nbookings-invoices-rows OK — four pages that had never rendered a row now do, honestly and in both languages');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
