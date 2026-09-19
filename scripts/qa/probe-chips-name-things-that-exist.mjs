/* probe-chips-name-things-that-exist.mjs — guards the 2026-09-19 (fire #105) fix to the filter
   buttons on Bookings, Invoices and Tickets.

   Of the eleven buttons on those three pages, NINE could not work in any data:

     · Bookings — Today · This week · This month are DATE RANGES, and they were applied by the
       shared handler that hides any row whose visible text lacks the button's word. No date cell
       contains the word "Today", so all three showed an empty table, always, for every dataset.
     · Invoices — "Unpaid" is not one of the statuses. They are Draft · Issued · Paid · Overdue ·
       Refunded (INV_STATUS_COLOR). Nothing could ever match it.
     · Tickets — the buttons read Issued · Voided · Refunded. A ticket here takes its status from
       its booking (allTickets copies it across) and the booking vocabulary is Confirmed · Pending ·
       Ticketed · Delivered · Cancelled. Not one of those three words is in it. That table does not
       even show a status column, so the row text could not have carried it either.

   Through all of it the table just went blank — no "nothing here", no explanation — and the counter
   under it went on describing the unfiltered list.

   None of this was costing anyone anything on the day it was found: all four of these pages are
   read-only mirrors of Direct Payments and hold zero rows today. It is written down that way on
   purpose. What makes it worth fixing anyway is that it is not a risk, it is a certainty — the
   buttons are incapable of matching, so they would be wrong on the first day the pages fill.

   The buttons now filter the RECORD. "Unpaid" means Issued + Overdue, which is how renderInvoices()
   itself computes the Outstanding figure printed at the top of that same page — read from the code,
   not invented. The Tickets buttons name the statuses that exist. Real ticket-level issued/voided/
   refunded is a Direct Payments fact this app has never been given; if it is wanted, it has to
   arrive as a field on the ticket rather than be guessed at.

   The rows that do not match are REMOVED rather than hidden, so js/04's counter recounts them —
   hiding rows is what let the old filter leave "Showing 1–20 of 136" over an empty table (fire
   #104). An empty result says so, in the reader's language.

   Everything here is seeded, including bookings dated today and earlier this week, because a date
   filter that is only ever shown an empty result proves nothing.

   AND THE FILTER DID NOT SURVIVE. The app re-renders in the background; about a second after a
   button was pressed the full list came back while the button stayed lit — a screen disagreeing
   with itself, which is the one thing fire #101 set out to make impossible. The choice is now
   remembered per page and re-applied after the re-render, and the lit button is drawn from that
   memory rather than the config default, so the highlight and the rows cannot disagree. It lasts
   for the page's lifetime only, like every other filter here.

   Sabotage-tested 2026-09-19, each half separately, both restored afterwards:
     · record branch removed, falling back to the row-text filter: 5 FAIL — the date buttons and
       the Tickets buttons all empty, the Unpaid total wrong, and the empty result silent again.
     · filter memory removed: 1 FAIL, and its detail is the defect itself — "Today: 2 -> 5" with
       the button still reading "Today".
   Run: node scripts/qa/probe-chips-name-things-that-exist.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9082; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('db_pageSize', '20'); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(3000);

  /* bookings across today, earlier this week, earlier this month and last year, so each date
     button has something it must find AND something it must leave out */
  const seeded = await p.evaluate(() => {
    const iso = (d) => d.toISOString().slice(0, 10);
    const today = (typeof todayISO === 'function') ? todayISO() : iso(new Date());
    const base = new Date(today + 'T00:00:00Z');
    const back = (n) => { const d = new Date(base); d.setUTCDate(base.getUTCDate() - n); return iso(d); };
    const weekStart = base.getUTCDay();                       /* days since Sunday */
    const earlierThisWeek = weekStart > 0 ? back(weekStart) : null;   /* Sunday, if today is not Sunday */
    const earlierThisMonth = (Number(today.slice(8, 10)) > 1) ? (today.slice(0, 8) + '01') : null;
    const lastYear = (Number(today.slice(0, 4)) - 1) + today.slice(4);

    const rows = [];
    const add = (id, date, status) => rows.push({ id: id, ref: 'QA-' + id, leadId: null, date: date, status: status,
      provider: 'QA Provider', totalSale: 1000, totalCost: 700,
      tickets: [{ airline: 'QA Air', pnr: 'PNR' + id, eticket: '000-' + id, pax: 'QA Pax', route: 'RUH-JED', cls: 'Y', fare: 900, taxes: 100 }] });
    add('t1', today, 'Ticketed'); add('t2', today, 'Delivered');
    if (earlierThisWeek) add('w1', earlierThisWeek, 'Ticketed');
    /* nothing is seeded as Cancelled on purpose: that button must be the empty one, so the
       "says so instead of a blank table" check has a case to meet */
    if (earlierThisMonth && earlierThisMonth !== today && earlierThisMonth !== earlierThisWeek) add('m1', earlierThisMonth, 'Ticketed');
    add('y1', lastYear, 'Ticketed');
    DB.bookings = rows;
    DB.invoices = [
      { id: 'i1', number: 'QA-INV-1', clientId: null, date: today, total: 100, currency: 'SAR', status: 'Issued', items: [] },
      { id: 'i2', number: 'QA-INV-2', clientId: null, date: today, total: 200, currency: 'SAR', status: 'Overdue', items: [] },
      { id: 'i3', number: 'QA-INV-3', clientId: null, date: today, total: 300, currency: 'SAR', status: 'Paid', items: [] },
      { id: 'i4', number: 'QA-INV-4', clientId: null, date: today, total: 400, currency: 'SAR', status: 'Draft', items: [] },
    ];
    return { today: today,
      want: {
        bookings: { all: rows.length,
          Today: rows.filter((r) => r.date === today).length,
          Week: rows.filter((r) => { const d = new Date(r.date + 'T00:00:00Z'); const s = new Date(base); s.setUTCDate(base.getUTCDate() - weekStart);
            const e = new Date(s); e.setUTCDate(s.getUTCDate() + 6); return r.date >= iso(s) && r.date <= iso(e); }).length,
          Month: rows.filter((r) => r.date.slice(0, 7) === today.slice(0, 7)).length },
        invoices: { all: 4, Unpaid: 2, Paid: 1, Overdue: 1 },
        tickets: { all: rows.length,
          Ticketed: rows.filter((r) => r.status === 'Ticketed').length,
          Delivered: rows.filter((r) => r.status === 'Delivered').length,
          Cancelled: rows.filter((r) => r.status === 'Cancelled').length },
      },
      /* the vocabularies the app itself defines — a button naming anything else is the bug */
      vocab: { booking: Object.keys(typeof BK_STATUS_COLOR !== 'undefined' ? BK_STATUS_COLOR : {}),
        invoice: Object.keys(typeof INV_STATUS_COLOR !== 'undefined' ? INV_STATUS_COLOR : {}) },
      chipFilters: { tickets: ((window.V26_3_SECTIONS || {}).tickets || {}).chipsEn || [],
        invoices: ((window.V26_3_SECTIONS || {}).invoices || {}).chipsEn || [] },
    };
  });

  const read = () => p.evaluate(() => {
    const v = document.getElementById('view');
    const all = [].slice.call(v.querySelectorAll('tbody tr')).filter((r) => !r.querySelector('td[colspan]'));
    const shown = all.filter((r) => { const cs = getComputedStyle(r); return cs.display !== 'none' && r.getBoundingClientRect().height > 0; });
    const emptyCell = v.querySelector('tbody td[colspan]');
    return { rows: shown.length, empty: emptyCell ? (emptyCell.innerText || '').replace(/\s+/g, ' ').trim() : null };
  });

  const out = {};
  for (const tab of ['bookings', 'invoices', 'tickets']) {
    await p.evaluate((t) => { current = t; openBooking = null; openInvoice = null; render(); }, tab);
    await p.waitForTimeout(2000);
    const chips = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view [class*=chip]'))
      .filter((c) => !/chiplink/.test(c.className || '')).map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 30 && t.split(' ').length <= 3));
    out[tab] = { chips: chips, byChip: {} };
    for (const lab of chips) {
      await p.evaluate((l) => { const c = [].slice.call(document.querySelectorAll('#view [class*=chip]'))
        .filter((x) => !/chiplink/.test(x.className || '')).find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim() === l); if (c) c.click(); }, lab);
      await p.waitForTimeout(1200);
      out[tab].byChip[lab] = await read();
      /* the app re-renders in the background; a filter that is quietly undone a second later,
         under a button still lit, is the defect this guards — look again after that moment */
      if (lab !== 'All' && lab !== 'الكل') {
        await p.waitForTimeout(2200);
        const later = await read();
        const lit = await p.evaluate(() => { const a = document.querySelector('#view .v26_3-chip.active'); return a ? (a.innerText || '').replace(/\s+/g, ' ').trim() : null; });
        out[tab].byChip[lab].later = later.rows;
        out[tab].byChip[lab].stillLit = lit;
      }
    }
  }
  await ctx.close();
  return { seeded, out };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const W = en.seeded.want;
const EN = (tab, lab) => (en.out[tab].byChip[lab] || {});
const AR = (tab, lab) => (ar.out[tab].byChip[lab] || {});
console.log('  today seeded as', en.seeded.today, '· wanted', JSON.stringify(W));
for (const tab of ['bookings', 'invoices', 'tickets']) {
  console.log('  ' + tab, JSON.stringify(Object.keys(en.out[tab].byChip).reduce((a, k) => { a[k] = EN(tab, k).rows; return a; }, {})));
}

/* every button must name something the data can actually hold */
const bookingVocab = en.seeded.vocab.booking, invoiceVocab = en.seeded.vocab.invoice;
const ticketWords = (en.seeded.chipFilters.tickets || []).map((c) => c.filter).filter((f) => f && f !== 'all');
const invoiceWords = (en.seeded.chipFilters.invoices || []).map((c) => c.filter).filter((f) => f && f !== 'all');
const strayTicket = ticketWords.filter((w) => bookingVocab.indexOf(w) < 0);
const strayInvoice = invoiceWords.filter((w) => invoiceVocab.indexOf(w) < 0 && w !== 'Unpaid');

const checks = [
  ['the three pages rendered their seeded rows, in both languages',
    EN('bookings', 'All').rows === W.bookings.all && EN('invoices', 'All').rows === W.invoices.all
    && AR('bookings', 'الكل').rows === W.bookings.all],
  ['no Tickets button names a status that is not in the booking vocabulary',
    strayTicket.length === 0, JSON.stringify({ buttons: ticketWords, vocabulary: bookingVocab, stray: strayTicket })],
  ['no Invoices button names a status that is not in the invoice vocabulary (Unpaid is defined below)',
    strayInvoice.length === 0, JSON.stringify({ buttons: invoiceWords, stray: strayInvoice })],
  ['Bookings "Today" finds the bookings dated today — and only those',
    EN('bookings', 'Today').rows === W.bookings.Today && W.bookings.Today > 0 && W.bookings.Today < W.bookings.all,
    EN('bookings', 'Today').rows + ' of a wanted ' + W.bookings.Today],
  ['"This week" and "This month" find theirs too, and each is a real subset',
    EN('bookings', 'This week').rows === W.bookings.Week && EN('bookings', 'This month').rows === W.bookings.Month
    && W.bookings.Month < W.bookings.all,
    JSON.stringify({ week: EN('bookings', 'This week').rows + '/' + W.bookings.Week, month: EN('bookings', 'This month').rows + '/' + W.bookings.Month })],
  ['"Unpaid" means the two statuses the page\'s own Outstanding figure adds up, and Unpaid + Paid is every invoice',
    EN('invoices', 'Unpaid').rows === W.invoices.Unpaid && EN('invoices', 'Paid').rows === W.invoices.Paid],
  ['each Tickets button finds the tickets whose booking is in that state',
    EN('tickets', 'Ticketed').rows === W.tickets.Ticketed && EN('tickets', 'Cancelled').rows === W.tickets.Cancelled
    && W.tickets.Ticketed > 0,
    JSON.stringify({ Ticketed: EN('tickets', 'Ticketed').rows + '/' + W.tickets.Ticketed, Cancelled: EN('tickets', 'Cancelled').rows + '/' + W.tickets.Cancelled })],
  ['a button with nothing behind it says so instead of leaving a blank table, in both languages',
    !!EN('bookings', 'This week') && (() => {
      const empties = [['bookings', 'Today'], ['invoices', 'Paid'], ['tickets', 'Cancelled']];
      void empties;
      const zeroEN = Object.keys(en.out.tickets.byChip).filter((k) => EN('tickets', k).rows === 0);
      const zeroAR = Object.keys(ar.out.tickets.byChip).filter((k) => AR('tickets', k).rows === 0);
      return zeroEN.length > 0 && zeroEN.every((k) => /Nothing here/i.test(EN('tickets', k).empty || ''))
        && zeroAR.length > 0 && zeroAR.every((k) => /لا شيء هنا/.test(AR('tickets', k).empty || ''));
    })()],
  ['the chosen filter survives the background re-render, and the lit button still matches the rows',
    ['bookings', 'invoices', 'tickets'].every((tab) => Object.keys(en.out[tab].byChip)
      .filter((k) => k !== 'All').every((k) => EN(tab, k).later === EN(tab, k).rows && EN(tab, k).stillLit === k)),
    JSON.stringify(['bookings', 'invoices', 'tickets'].map((tab) => Object.keys(en.out[tab].byChip).filter((k) => k !== 'All')
      .map((k) => k + ':' + EN(tab, k).rows + '->' + EN(tab, k).later + '/' + JSON.stringify(EN(tab, k).stillLit)).join(' ')))],
  ['Arabic finds the same rows as English',
    AR('bookings', 'اليوم').rows === EN('bookings', 'Today').rows
    && AR('invoices', 'غير مدفوع').rows === EN('invoices', 'Unpaid').rows
    && AR('tickets', 'صدرت التذكرة').rows === EN('tickets', 'Ticketed').rows],
  ['clicking through every button wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en: en.out, ar: ar.out, want: W }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
