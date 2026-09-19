/* probe-an-import-date-is-a-real-day.mjs — guards the 2026-09-19 (fire #103) fix to js/41's date
   reader, which is the reader BOTH import paths use: js/65's router parses a Direct Payments export
   through js/41's parseDP/toRows.

   It took exactly two spellings, dd/mm/yyyy and yyyy-mm-dd, and never checked that the day it read
   exists. Driven against the live parser before the fix — every one of these is something a real
   export can carry:

       03/14/2026  ->  "2026-14-03"   MONTH 14. Not a rejection: a date-shaped string handed to a
                                      real DATE column. Postgres refuses it, and because one batch
                                      is one statement, that single row loses the WHOLE file. On the
                                      way past, the app's own maths reads month 14 as no month at
                                      all and quarter "Q5".
       31/02/2026  ->  "2026-02-31"   February has no 31st.
       29/02/2026  ->  "2026-02-29"   2026 is not a leap year.
       3/14/2026 · 14-03-2026 · 2026/03/14 · 14-Mar-2026 · 14 Mar 2026 · ١٤/٠٣/٢٠٢٦  ->  null, so
                                      every row is held back for "no readable invoice date" and a
                                      perfectly good file imports nothing.

   The last group is not hypothetical. An Excel export carries a real date CELL, and what it reads
   as depends on the number format saved in the file — which changes when it is re-saved, or opened
   on a machine set to another region. That is how this was found: dropping the same export written
   four ways, three of them imported nothing.

   js/65 hardened its own reader for this on 2026-09-03 and publishes it; js/41 now defers to it,
   the same way its money reader already did, with month-name spellings handled first because a
   spreadsheet produces those and js/65's reader does not take them. dd/mm stays the preferred
   reading — it is what Direct Payments writes — and only a month above 12 flips it.

   What this probe requires is the whole point: a date that cannot exist must never become a stored
   invoice_date, and a date a person can read must never cost them the file. Both are driven through
   a real drop on the Import tab, and the stored rows are read back from the database.

   Sabotage-tested 2026-09-19: with js/41's isoDate reverted to its two-shape original, 6 checks go
   FAIL, exit 1 — and the shape of that failure is the point. NOTHING is stored at all, not even the
   rows whose dates the old reader could read: the impossible date reaches the database as
   "2026-02-31", the call is refused, and the whole file goes down with the one bad row. That is the
   failure this project has already lived through twice, reproduced on demand.
   Run: node scripts/qa/probe-an-import-date-is-a-real-day.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9080; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

/* the same day, written the ways a real export writes it */
const SPELLINGS = [
  ['dp', '14/03/2026'],                    // what Direct Payments itself writes — must not change
  ['dp-with-time', '14/03/2026 03:35:42 PM'],
  ['iso', '2026-03-14'],
  ['us', '03/14/2026'],                    // used to become month 14
  ['dashes', '14-03-2026'],
  ['month-name', '14-Mar-2026'],
  ['arabic-digits', '١٤/٠٣/٢٠٢٦'],
];
const IMPOSSIBLE = '31/02/2026';

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.FIN && Array.isArray(FIN.rows) && typeof window.v65Commit === 'function', { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { FIN.tab = 'import'; render(); } catch (_) { } });
  await p.waitForTimeout(2500);

  /* one file: every spelling of the same day, plus one day that does not exist */
  const preview = await p.evaluate(async ({ SPELLINGS, IMPOSSIBLE, lang }) => {
    const HEAD = ['Type', 'Invoice Reference #', 'Invoice Number', 'Invoice Create Date', 'Invoice Status',
      'Customer Name', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Invoice Total', 'Sale Branch', 'Salesman'];
    const q = (r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',');
    const lines = [q(HEAD)];
    const add = (no, date) => {
      lines.push(q(['invoice', no, no, date, 'Paid', 'Date Shapes Co', 'Direct Flights', '', '', '', '', '1150', 'B', 'S']));
      lines.push(q(['item', no, '', '', '', 'Date Shapes Co', 'Direct Flights', 'Service fee', 'Yes', '0', '1150', '1150', 'B', 'S']));
    };
    SPELLINGS.forEach(([key]) => add('QA-DT-' + lang + '-' + key, null));
    lines.length = 1;   /* rebuild with the real dates now that the ids are settled */
    SPELLINGS.forEach(([key, written]) => add('QA-DT-' + lang + '-' + key, written));
    add('QA-DT-' + lang + '-impossible', IMPOSSIBLE);
    const dt = new DataTransfer(); dt.items.add(new File([lines.join('\r\n')], 'dates.csv', { type: 'text/csv' }));
    const box = document.getElementById('finImpOut'); if (box) box.innerHTML = '';
    document.getElementById('finDrop').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 11000));
    return (document.getElementById('finImpOut') || {}).innerText.replace(/\s+/g, ' ').trim();
  }, { SPELLINGS, IMPOSSIBLE, lang });

  await p.evaluate(() => { try { v65Commit(); } catch (_) { } });
  await p.waitForTimeout(6000);

  /* what actually landed in the database */
  const stored = await p.evaluate(async ({ lang, PORT }) => {
    const r = await fetch('http://localhost:' + PORT + '/rest/v1/finance_invoices?limit=2000').then((x) => x.json());
    const mine = (Array.isArray(r) ? r : []).filter((x) => String(x.invoice_no || '').startsWith('QA-DT-' + lang + '-'));
    const byKey = {}; mine.forEach((x) => { byKey[String(x.invoice_no).replace('QA-DT-' + lang + '-', '')] = { date: x.invoice_date, month: x.month, quarter: x.quarter }; });
    return byKey;
  }, { lang, PORT });
  await ctx.close();
  return { preview, stored };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN preview:', JSON.stringify(en.preview.slice(0, 300)));
console.log('  EN stored :', JSON.stringify(en.stored));
console.log('  AR preview:', JSON.stringify(ar.preview.slice(0, 260)));

const ALL_KEYS = SPELLINGS.map(([k]) => k);
const readAsTheDay = (s) => ALL_KEYS.filter((k) => s.stored[k] && s.stored[k].date === '2026-03-14');
const enGood = readAsTheDay(en), arGood = readAsTheDay(ar);
const badMonth = (s) => Object.keys(s.stored).filter((k) => {
  const d = String((s.stored[k] || {}).date || ''); const m = Number(d.slice(5, 7));
  return d && (!(m >= 1 && m <= 12) || String((s.stored[k] || {}).quarter || '') === 'Q5');
});

const checks = [
  ['the file really imported, so nothing below passes because nothing happened',
    Object.keys(en.stored).length > 0 && Object.keys(ar.stored).length > 0 && /Files dropped/i.test(en.preview)],
  ['what Direct Payments itself writes still reads as the day it says', en.stored.dp && en.stored.dp.date === '2026-03-14'],
  ['…including when it carries the time after it', en.stored['dp-with-time'] && en.stored['dp-with-time'].date === '2026-03-14'],
  ['every other way that same day can be written reads as that same day too — no file lost for its spelling',
    enGood.length === ALL_KEYS.length, enGood.length + '/' + ALL_KEYS.length + ' ok: ' + JSON.stringify(enGood)],
  /* the "New 7" matters as much as the absence: with the old reader the impossible date reached
     the database as "2026-02-31", the call was refused, and NOTHING landed — the seven good rows
     went down with it. Held back means held back alone. */
  ['a day that does not exist is held back on its own, and the other seven still import',
    !en.stored.impossible && !ar.stored.impossible && /New 7|7 new/.test(en.preview) && /7/.test(ar.preview)],
  ['and the person is told why, in their own language, and keeps the rest of the file',
    /no readable invoice date/i.test(en.preview) && /تاريخ فاتورة مقروء/.test(ar.preview) && !/no readable invoice date/i.test(ar.preview)],
  ['nothing reached the database with a month that is not a month, or a quarter that is not a quarter',
    badMonth(en).length === 0 && badMonth(ar).length === 0, JSON.stringify({ en: badMonth(en), ar: badMonth(ar) })],
  ['Arabic reads the same days as English', arGood.length === ALL_KEYS.length],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
