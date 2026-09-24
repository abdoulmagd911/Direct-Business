/* probe-a-money-gap-is-named-for-what-it-is.mjs — the money screen calls a rounding artifact
   rounding and a real disagreement a real disagreement, and never quotes a date it cannot read.

   Fire #238. Found by handing Finance malformed rows with a 200 — nulls in the money columns, text
   where a number belongs, a negative pair, an unreadable date, and one row whose stored profit does
   not equal its revenue minus its cost.

   The page read:

       Each figure above is rounded on its own, so -2,100 minus -7,700 reads as 5,600
       where Profit reads 5,799.

   A **199-riyal** contradiction, explained as a display artifact, on the one page where M1 says
   cost, profit and revenue must always be clean. The note was written for rounding — which can move
   each figure by less than half a riyal and no more — but it fired on any mismatch at all.

   The same run showed the header quoting **"data through 32/13/2026"**: the cutoff was the last
   value after a plain string sort, so a single unreadable date won and the page claimed a cutoff
   the data never had.

   Live, every one of the 46 invoices obeys the doctrine — the database trigger keeps them honest,
   and they were re-counted the same day — so neither fault is biting today. This is the money page
   refusing to mislabel the day that changes.

   What this holds:
     1. a real disagreement is named as one, with the size of the gap;
     2. it is not called rounding;
     3. it says how many rows the gap comes from, so it points somewhere;
     4. the brake, and the reason this is not just a reworded sentence: a genuine ROUNDING gap —
        under a riyal — still gets the rounding explanation, which is true and useful;
     5. the header never quotes a date it cannot read;
     6. a row carrying text where a number belongs is still counted as zero AND said, which the
        page already did and must keep doing;
     7. no page prints NaN, undefined or Invalid Date from any of it;
     8. and none of it puts a VAT figure on the money screen (M1);
     9. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the mismatch branch removed — fails 1, 2 and 3, the 199-riyal gap back under "Each figure
       above is rounded on its own";
     · the date filter removed — fails 5, the header quoting "32/13/2026" again.
   Run: node scripts/qa/probe-a-money-gap-is-named-for-what-it-is.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9265 — one mock. */
const PORT = 9265; const BASE = 'http://localhost:' + PORT;

const mk = (n, x) => Object.assign({
  id: 'f0000000-0000-4000-8000-00000000000' + n, invoice_no: 'QA238-' + n,
  client_group: 'QA Client', customer_raw_name: 'QA Client', invoice_date: '2026-05-10',
  month: 'May', quarter: 'Q2', year: 2026, products: 'QA service', service_type: 'Other',
  record_type: 'invoice', total_incl_vat_sar: 1000, wallet_portion_sar: 0,
  revenue_sar: 1000, cost_sar: 600, profit_sar: 400, amount_received_sar: 1000,
  amount_remaining_sar: 0, integrity_status: 'verified_paid', revenue_way: 'invoice',
  deleted_at: null, vat_sar: null,
}, x || {});

/* a real disagreement (row 5 stores 999 where 900 − 100 = 800), plus the other malformed shapes */
const MIXED = [
  mk(1, { revenue_sar: null, cost_sar: null, profit_sar: null }),
  mk(2, { revenue_sar: 'not a number', cost_sar: 'abc', profit_sar: '??' }),
  mk(3, { invoice_date: '32/13/2026', month: null, quarter: null, year: null }),
  mk(4, { revenue_sar: -5000, cost_sar: -9000, profit_sar: 4000 }),
  mk(5, { revenue_sar: 900, cost_sar: 100, profit_sar: 999 }),
  mk(6, {}),
];
/* every row honest, but the pennies make the printed figures disagree by one riyal — the case the
   rounding sentence was written for, and the one it must keep */
const ROUNDING = [
  mk(7, { revenue_sar: 3000.30, cost_sar: 1201.80, profit_sar: 1798.50, invoice_date: '2026-05-11' }),
];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang, rows) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/finance_invoices' && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(13000);
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) {} });
  await p.waitForTimeout(6500);
  const seen = await p.evaluate(() => {
    const v = document.getElementById('view'); const t = (v && v.innerText) || '';
    return { mismatch: !!document.getElementById('ov-mismatch'),
             mismatchText: ((document.getElementById('ov-mismatch') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
             rounding: !!document.getElementById('ov-rounding'),
             roundingText: ((document.getElementById('ov-rounding') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
             through: (t.match(/[^\n]*(data through|حتى)[^\n]*/i) || [''])[0].trim().slice(0, 60),
             unreadable: /unreadable amount|غير قابلة للقراءة/i.test(t),
             badTokens: (t.match(/[^\n]*(undefined|NaN|Invalid Date|\[object Object\])[^\n]*/g) || []).slice(0, 2),
             vat: (t.match(/[^\n]*(VAT|ضريب)[^\n]*/gi) || []).slice(0, 2) };
  });
  await ctx.close();
  return { seen, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const mixedEn = await run('en', MIXED);
const mixedAr = await run('ar', MIXED);
const rounding = await run('en', ROUNDING);
await b.close(); srv.close?.();

console.log('  three runs: rows that really disagree (EN and AR), and one honest row whose pennies make the printed figures differ by a riyal');

(mixedEn.seen.mismatch && /does not equal revenue minus cost/i.test(mixedEn.seen.mismatchText) && /\b199\b/.test(mixedEn.seen.mismatchText))
  ? pass('a real disagreement is named as one, with the size of the gap', JSON.stringify(mixedEn.seen.mismatchText.slice(0, 80)))
  : fail('a real disagreement is named as one, with the size of the gap', JSON.stringify(mixedEn.seen));

(!mixedEn.seen.rounding && /not rounding/i.test(mixedEn.seen.mismatchText))
  ? pass('it is not called rounding')
  : fail('it is not called rounding', JSON.stringify({ rounding: mixedEn.seen.roundingText, mismatch: mixedEn.seen.mismatchText }));

/\b1 row\b/.test(mixedEn.seen.mismatchText)
  ? pass('it says how many rows the gap comes from, so it points somewhere')
  : fail('it says how many rows the gap comes from, so it points somewhere', JSON.stringify(mixedEn.seen.mismatchText));

(rounding.seen.rounding && /rounded on its own/i.test(rounding.seen.roundingText) && !rounding.seen.mismatch)
  ? pass('brake: a genuine rounding gap still gets the rounding explanation', JSON.stringify(rounding.seen.roundingText.slice(0, 70)))
  : fail('brake: a genuine rounding gap still gets the rounding explanation', JSON.stringify(rounding.seen));

(!/32\/13\/2026/.test(mixedEn.seen.through) && /2026-05-10|—/.test(mixedEn.seen.through))
  ? pass('the header never quotes a date it cannot read', JSON.stringify(mixedEn.seen.through))
  : fail('the header never quotes a date it cannot read', JSON.stringify(mixedEn.seen.through));

mixedEn.seen.unreadable
  ? pass('a row carrying text where a number belongs is counted as zero and said so')
  : fail('a row carrying text where a number belongs is counted as zero and said so', JSON.stringify(mixedEn.seen));

(mixedEn.seen.badTokens.length === 0 && mixedAr.seen.badTokens.length === 0)
  ? pass('no NaN, undefined or Invalid Date on the money screen, in either language')
  : fail('no NaN, undefined or Invalid Date on the money screen, in either language', JSON.stringify({ en: mixedEn.seen.badTokens, ar: mixedAr.seen.badTokens }));

(mixedEn.seen.vat.length === 0 && mixedAr.seen.vat.length === 0)
  ? pass('and no VAT figure anywhere on it (M1)')
  : fail('and no VAT figure anywhere on it (M1)', JSON.stringify({ en: mixedEn.seen.vat, ar: mixedAr.seen.vat }));

const errs = mixedEn.errors.concat(mixedAr.errors, rounding.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
