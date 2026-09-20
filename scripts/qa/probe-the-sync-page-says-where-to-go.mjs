/* probe-the-sync-page-says-where-to-go.mjs — the one page whose whole job is to point somewhere.

   Driven live on 2026-09-21 (fire #150). The Sync page no longer holds an integration grid: it is a
   list of where to go in Direct Payments, plus the three sources the team works in by hand. Two
   things were wrong with it.

   · TWO CHIPS EMPTIED THE PAGE. "Connected" and "Needs attention" were left over from the grid that
     used to be there. Neither row on this page carries a connection status, so both fell through to
     the generic row-text filter — which hides a row unless its visible text contains the chip's own
     word — and clicking either left nothing but the table header. Both showed the SAME empty table:
     two opposite filters agreeing, and no line saying why. Same family as fire #104 (Airlines) and
     #105 (Bookings / Invoices / Tickets): a button that cannot work in any data. There was no
     filter to put back, so the strip is gone.

   · THE ARABIC SIDE WAS HALF ENGLISH. The area names were translated and not one word next to them
     was: all nine "what lives there" lines, one area name nobody had added, and the page's own
     heading — which read "Sync" while every other page's heading is Arabic. The six buttons said
     «مفتوحة» — "open" as a STATE — because one dictionary serves the whole app and a ticket status
     claimed the word first. Here it is an instruction: «فتح».

   What this holds:
     1. the page lists where to go — the rows are there at all;
     2. no control on it can empty it: every button is clicked, and the rows must survive each one;
     3. the Arabic heading is Arabic;
     4. every description line is Arabic — checked string by string, so one left behind is caught;
     5. the buttons say «فتح», not the ticket-status word;
     6. English comes back when the language is switched back, so the translation is a layer and not
        a rewrite;
     7. the deep links still point at payments.directksa.com and still open in a new tab — the whole
        purpose of the page.

   Check 2 is the one that outlives this round: it does not care WHICH control appears, only that
   nothing on this page can leave a person staring at an empty table.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the two
   chips back into the sync config fails checks 2 and 6, and check 2 prints what it found —
   «"Connected" left 0 rows»; removing the eight dictionary lines and the «فتح» override fails
   checks 4 and 5, and check 5 prints «مفتوحة» back on the buttons.
   Run: node scripts/qa/probe-the-sync-page-says-where-to-go.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9104; const BASE = 'http://localhost:' + PORT;

/* every English line the page prints in its second column, with the Arabic it must show instead */
const LINES = [
  ['Client records, credit limits, payment terms', 'سجلات العملاء وحدود الائتمان وشروط الدفع'],
  ['DPIN/TTIN invoices, tax view, publishing', 'فواتير DPIN/TTIN والعرض الضريبي والنشر'],
  ['Expense submissions and approvals', 'طلبات المصروفات واعتمادها'],
  ['Refund queue with assignee and approver', 'قائمة طلبات الاسترداد مع المسؤول والمعتمِد'],
  ['Balance/payment receipts applied to invoices', 'إيصالات الرصيد والدفع المطبّقة على الفواتير'],
  ['Per-client price overrides', 'أسعار خاصة لكل عميل'],
  ['Office RUHS2234B - live reservations and ticketing', 'مكتب RUHS2234B — الحجوزات وإصدار التذاكر المباشر'],
  ['Provider evaluations and operations sheets', 'تقييمات المورّدين وجداول التشغيل'],
  /* the mailbox line keeps its three addresses — they are names, not words */
  ['business@ / ticketing@ / accounting1@ - mined read-only for airline cases and BSP/ADM intel',
    'تُقرأ فقط لاستخراج حالات شركات الطيران ومعلومات BSP/ADM'],
];

const srv = start(PORT, { businesses: [], contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  /* the deep links must never actually be followed from a test */
  await p.route((u) => u.href.includes('payments.directksa.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.evaluate(() => { try { current = 'sync'; render(); } catch (_) { } });
  await p.waitForTimeout(2200);

  const read = () => p.evaluate(() => {
    const v = document.getElementById('view');
    const rows = [].slice.call(v.querySelectorAll('tbody tr')).filter((r) => r.offsetParent !== null);
    const links = [].slice.call(v.querySelectorAll('a.btn')).map((a) => ({ href: a.getAttribute('href') || '', t: (a.textContent || '').trim(), tgt: a.getAttribute('target') || '' }));
    return { txt: (v.innerText || '').replace(/\s+/g, ' '), rows: rows.length, links,
      head: ((document.querySelector('.v26_3-section-head h2') || {}).textContent || '').replace(/[?\s]+$/, '').trim(),
      chips: [].slice.call(v.querySelectorAll('.v26_3-chip')).map((c) => (c.innerText || '').trim()) };
  });
  const start0 = await read();

  /* click EVERY button on the page and check the rows are still there after each one. A control
     that empties this page is the defect, whatever it is called. */
  const nButtons = await p.evaluate(() => document.getElementById('view').querySelectorAll('button').length);
  const worst = { label: '', rows: start0.rows };
  for (let i = 0; i < nButtons; i++) {
    const label = await p.evaluate((ix) => {
      const bs = document.getElementById('view').querySelectorAll('button');
      if (!bs[ix]) return null; const t = (bs[ix].innerText || '').replace(/\s+/g, ' ').trim();
      try { bs[ix].click(); } catch (_) { } return t || '(unnamed)';
    }, i);
    if (label == null) break;
    await p.waitForTimeout(450);
    const now = await read();
    if (now.rows < worst.rows) { worst.rows = now.rows; worst.label = label; }
  }

  /* and back to the other language, in the app's own way */
  let backTxt = '';
  if (lang === 'ar') {
    await p.evaluate(() => { try { toggleLang(); current = 'sync'; render(); } catch (_) { } });
    await p.waitForTimeout(1800);
    backTxt = (await read()).txt;
  }
  await ctx.close();
  return { start: start0, worst, nButtons, backTxt };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const arTxt = ar.start.txt;
const missing = LINES.filter(([e]) => arTxt.indexOf(e) >= 0).map(([e]) => e);
const untranslated = LINES.filter(([, a]) => arTxt.indexOf(a) < 0).map(([e]) => e);
const checks = [
  ['the page lists where to go — the rows are there at all', en.start.rows >= 9, en.start.rows + ' rows, ' + en.nButtons + ' buttons'],
  ['no control on this page can empty it — every button was clicked and the rows survived each one',
    en.worst.rows >= 9 && ar.worst.rows >= 9,
    'worst: EN "' + en.worst.label + '" left ' + en.worst.rows + ' rows · AR "' + ar.worst.label + '" left ' + ar.worst.rows +
    (en.start.chips.length ? ' · chips present: ' + JSON.stringify(en.start.chips) : '')],
  ['the Arabic heading is Arabic', /[؀-ۿ]/.test(ar.start.head) && !/Sync/i.test(ar.start.head), JSON.stringify(ar.start.head)],
  ['every description line is Arabic — none left behind',
    missing.length === 0 && untranslated.length === 0,
    missing.length ? 'still English: ' + JSON.stringify(missing.slice(0, 2)) : (untranslated.length ? 'Arabic missing for: ' + JSON.stringify(untranslated.slice(0, 2)) : 'all ' + LINES.length + ' lines')],
  ['the buttons say «فتح» — an instruction, not the ticket-status word «مفتوحة»',
    ar.start.links.length >= 6 && ar.start.links.every((l) => l.t === 'فتح'),
    JSON.stringify([...new Set(ar.start.links.map((l) => l.t))])],
  ['English comes back when the language is switched back — this is a layer, not a rewrite',
    LINES.every(([e]) => ar.backTxt.indexOf(e) >= 0), ar.backTxt.slice(0, 90)],
  ['the deep links still point at payments.directksa.com and still open in a new tab',
    en.start.links.length >= 6 && en.start.links.every((l) => /^https:\/\/payments\.directksa\.com\//.test(l.href) && l.tgt === '_blank'),
    JSON.stringify(en.start.links.slice(0, 2))],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let fail = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
