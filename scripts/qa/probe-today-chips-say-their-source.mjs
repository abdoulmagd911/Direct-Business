/* probe-today-chips-say-their-source.mjs — guards the 2026-09-18 (fire #89) layer js/84.
   Today is the first thing every employee sees each morning, and its five chips read the workspace
   blob: core-06's renderToday does `const B=activeRows(DB.bookings); const I=activeRows(DB.invoices);
   const O=activeRows(DB.offers)`. Measured live, in both languages: invoices 0, bookings 0, offers 0,
   requests 0 — while the real money sits in the finance_invoices TABLE, 46 invoices, which Today never
   reads. So four of the five chips are structurally incapable of ever showing a number. "0 Overdue
   invoices" is not a measurement; it is an empty box being counted, under a hero line that says
   "Nothing urgent right now — all clear."
   It happens to be the true answer today — all 46 invoices are fully received — which is exactly why
   it had gone unnoticed.
   js/84 does NOT rewire Today to read finance_invoices: what counts as overdue, which due date and how
   aging is read are money decisions with rules attached, the Finance page already does it properly, and
   it is the owner's call rather than a side effect of a QA round. No number changes and nothing is
   hidden. One line appears under the chips saying what they count and where the real ledger is — and it
   takes itself away the moment any of those collections holds a record.
   This probe checks both halves: the note is there in both languages when the collections are empty,
   and it is GONE once a record exists — the second half is what stops the note becoming a permanent
   untruth of its own.
   Sabotage-tested: with js/84's contents neutered (left in place, so index.html's script line does not
   404 and add a spurious error), 4 checks go FAIL, exit 1 — the note is gone in both languages, with it
   the Finance link and the mention of Direct Payments. Deleting the file instead scores 5, but the
   fifth is only the 404; the four above are the real signal.
   Run: node scripts/qa/probe-today-chips-say-their-source.mjs                                         */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9068; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const AR = /[؀-ۿ]/;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const read = async (lang) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1050 } });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 90000 });
  await p.waitForTimeout(3500);
  /* the mock seeds invoices and bookings; empty them so this is the LIVE shape, which is the shape
     the note exists for. The second half below puts one back. */
  await p.evaluate(() => { try { DB.invoices = []; DB.bookings = []; DB.offers = []; current = 'today'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(2200);
  const empty = await p.evaluate(() => {
    const v = document.getElementById('view'); const n = v && v.querySelector('.v84-note');
    return {
      note: n ? (n.innerText || '').replace(/\s+/g, ' ').trim() : null,
      linksToFinance: !!(n && n.querySelector('a[href="/finance"]')),
      chips: Array.from(v.querySelectorAll('.chips .chip')).map((x) => (x.textContent || '').trim()),
      sources: { i: (DB.invoices || []).length, b: (DB.bookings || []).length, o: (DB.offers || []).length }
    };
  });
  /* and now a record really does exist here — the note must take itself away */
  await p.evaluate(() => { try { DB.invoices = [{ id: 'x1', number: 'INV-X', status: 'Issued', date: new Date().toISOString().slice(0, 10), clientId: (DB.businesses || [])[0].id, items: [] }]; render(); } catch (_) { } });
  await p.waitForTimeout(2200);
  const filled = await p.evaluate(() => { const v = document.getElementById('view');
    return { note: !!(v && v.querySelector('.v84-note')), invoices: (DB.invoices || []).length }; });
  await ctx.close();
  return { empty, filled };
};
const en = await read('en'); const ar = await read('ar');
await b.close(); srv.close?.();

const checks = [
  ['the drive really happened — Today rendered its chips with nothing to count', !!en.empty.chips.length && en.empty.sources.i === 0 && en.empty.sources.b === 0],
  ['with nothing to count, Today says so in English', !!en.empty.note && /count records kept in this app/i.test(en.empty.note)],
  ['and in Arabic', !!ar.empty.note && AR.test(ar.empty.note) && /Direct Payments/.test(ar.empty.note)],
  ['the note points at the Finance page, where the real ledger is', en.empty.linksToFinance && ar.empty.linksToFinance],
  ['it names Direct Payments as where invoices are really minted', /Direct Payments/.test(en.empty.note || '')],
  ['the note takes itself away the moment a record exists here — English', en.filled.invoices === 1 && en.filled.note === false],
  ['and in Arabic', ar.filled.invoices === 1 && ar.filled.note === false],
  ['reading Today wrote nothing of its own', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar, wrote: [...new Set(wrote)] }, null, 1)); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
