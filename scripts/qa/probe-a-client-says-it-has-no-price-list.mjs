/* probe-a-client-says-it-has-no-price-list.mjs — the Corporate account card on a client
   (core-05 `corpCard`), and the instruction it carries.

   All 28 live clients have an EMPTY pricing scheme, so the card's own line — "⚠ No pricing scheme
   set — add before quoting this client." / «⚠ لم يُحدَّد نظام تسعير — أضِفه قبل تقديم عرض لهذا
   العميل.» — is on every client card in the app right now. It is not decoration: it is the
   instruction that stops somebody quoting a corporate client off the top of their head.

   Nothing asserted it, and nothing asserted the card reads in Arabic. The card's labels are
   hardcoded English in core-05 and translated after render by js/21's dictionary — the arrangement
   that leaks silently the day a label is added and the dictionary is not, and the card only exists
   after you click into a client, so a sweep that walks the nav never sees it.

   Driven against the real database on 2026-09-20, both languages: the card is present and visible
   on a client, every one of its eight labels reads in Arabic, and the warning appears in the right
   language. Clean — so this is a guard around something already right, not a fix.

   Also held here, because this card is one of the places it could break: **no money figure on a
   client card.** The card has a branch that would print a credit limit, and eight live clients have
   one. The owner's ruling of 21 August is that no deal value, billing total or other money figure
   appears on Leads or Clients — Finance is the one place a number is read — so the credit limit
   must not reach the screen even though the record holds it.

   Sabotage-tested 2026-09-20 against a COPY of the app (APP_DIR, so the repository is untouched):
     · the warning line removed: 2 checks FAIL — a client with no price list says nothing.
     · the credit-limit condition flipped to show it: 1 check FAILS — 50,000 appears on the card.
   Run: node scripts/qa/probe-a-client-says-it-has-no-price-list.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9091; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];
const CREDIT = 50000;

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 1 && typeof corpCard === 'function', { timeout: 120000 });
  await p.waitForTimeout(4000);

  /* one client in the state all 28 live ones are in, and one that HAS a price list */
  const ids = await p.evaluate((credit) => {
    const B = (DB.businesses || []).filter((x) => x.isClient);
    const a = B[0], c = B[1] || B[0];
    a.name = 'Qaanoon No Price Co'; a.pricing = []; a.creditLimit = credit; a.isClient = true;
    a.entityType = 'Corporate'; a.paymentTerms = 'Net 30';
    c.name = 'Qaanoon Priced Co'; c.isClient = true; c.entityType = 'Corporate';
    c.pricing = [{ service: 'Flights', value: '3%', notes: 'agreed 2026' }];
    return { none: a.id, priced: c.id, clients: B.length };
  }, CREDIT);

  /* the detail page is the leads one for clients too — they share it */
  const look = async (id) => {
    await p.evaluate((i) => { current = 'leads'; openLead = i; render(); }, id);
    await p.waitForTimeout(2600);
    return p.evaluate(() => {
      const cards = [].slice.call(document.querySelectorAll('#view .card'));
      const c = cards.find((x) => /Corporate account|الحساب المؤسسي/.test((x.querySelector('h3') || {}).textContent || ''));
      const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };
      if (!c) return { found: false, headings: cards.map((x) => ((x.querySelector('h3') || {}).textContent || '').trim()).filter(Boolean) };
      const txt = c.innerText || '';
      const labels = [].slice.call(c.querySelectorAll('.k, .sub-h, h3, th')).filter(shown)
        .map((x) => (x.textContent || '').trim()).filter(Boolean);
      return { found: true, visible: shown(c), labels,
        /* a label still in English on the Arabic page. Industry terms a Riyadh professional writes
           in Latin anyway are not leaks — the same rule the language sweeps use. */
        latin: labels.filter((t) => t.length > 2 && !/[؀-ۿ]/.test(t) && /[A-Za-z]{3}/.test(t)
          && !/(SAR|VAT|CR|SLA|IATA|PNR|API|GDS|Direct)/i.test(t)),
        warn: (txt.match(/⚠[^\n]{0,140}/g) || []),
        pricingRows: [].slice.call(c.querySelectorAll('table tr')).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim()),
        /* any money on the card at all — the 21 August ruling */
        money: (txt.match(/\b\d{1,3}(?:,\d{3})+\b|\b50000\b|SAR|ريال/g) || []) };
    });
  };

  const none = await look(ids.none);
  const priced = await look(ids.priced);
  await ctx.close();
  return { ids, none, priced };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN no-price card:', JSON.stringify({ found: en.none.found, warn: en.none.warn, money: en.none.money }));
console.log('  AR no-price card:', JSON.stringify({ found: ar.none.found, warn: ar.none.warn, latin: ar.none.latin }));
console.log('  EN priced card  :', JSON.stringify({ warn: en.priced.warn, rows: en.priced.pricingRows }));

const AR_WARN = 'لم يُحدَّد نظام تسعير';
const checks = [
  ['the Corporate account card is on a client\'s page, and visible, in both languages',
    en.none.found && en.none.visible && ar.none.found && ar.none.visible,
    JSON.stringify({ en: en.none.found, ar: ar.none.found, headings: (en.none.headings || []).slice(0, 8) })],
  ['a client with no price list is told so, in English',
    en.none.warn.some((w) => /No pricing scheme set/.test(w)), JSON.stringify(en.none.warn)],
  ['and in Arabic, in Arabic', ar.none.warn.some((w) => w.indexOf(AR_WARN) >= 0), JSON.stringify(ar.none.warn)],
  /* the half that makes it a check rather than a string that is always there */
  ['a client that HAS a price list is not told it is missing, and its rows are shown instead',
    !en.priced.warn.some((w) => /No pricing scheme set/.test(w))
    && en.priced.pricingRows.some((r) => /Flights/.test(r) && /3%/.test(r)),
    JSON.stringify({ warn: en.priced.warn, rows: en.priced.pricingRows })],
  ['…in Arabic too', !ar.priced.warn.some((w) => w.indexOf(AR_WARN) >= 0),
    JSON.stringify(ar.priced.warn)],
  ['every label on the card reads in Arabic on the Arabic page',
    ar.none.latin.length === 0 && ar.none.labels.length >= 6,
    JSON.stringify({ stillEnglish: ar.none.latin, labelCount: ar.none.labels.length })],
  /* the owner's ruling of 21 August — money lives on Finance, not on a client card */
  ['no money figure reaches the card, although the record carries a credit limit',
    en.none.money.length === 0 && ar.none.money.length === 0,
    JSON.stringify({ en: en.none.money, ar: ar.none.money })],
  ['opening a client wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0,
    JSON.stringify(wrote.filter((w) => !/finance_client_links/.test(w)).slice(0, 4))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
