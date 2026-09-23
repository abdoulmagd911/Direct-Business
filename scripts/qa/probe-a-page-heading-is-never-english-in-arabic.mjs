/* probe-a-page-heading-is-never-english-in-arabic.mjs — every page's own heading is Arabic on an
   Arabic screen, and the English one keeps the character it is written with.

   Fire #204, widened in #232 from 19 routes to all 25 the app answers. Swept in Arabic against
   the live database, reading only the HEADINGS
   inside #view. A heading is always the app's own words — never a company name, never an answer
   somebody typed — so "is there Latin here?" has no data false positives on a heading, which is
   what makes this measurable at all. (The same sweep over every text node does not: it flags
   supplier names, SOP titles and company names, and an earlier run of it also walked cards that
   js/31 deliberately hides, so it "found" English nobody can see.)

   18 of the 19 pages swept then came back clean. One did not:

       vendors     headings   2 | Latin-only headings:  1  -> ["Providers  GDS ?"]

   Note the two spaces. The section head (js/core/core-09-v26.js) sanitised its title with
   .replace(/[<>&]/g,'') — it DELETED the character rather than escaping it. Only one of the twelve
   titles contains one, "Providers & GDS", and losing it broke the page twice over:
     · in English the heading read "Providers  GDS" — the ampersand gone, its space left behind;
     · in Arabic it stayed English, alone among the pages swept then, because the Arabic pass (js/21) looks
       a heading up word-for-word and holds 'Providers & GDS'. The deletion had turned the heading
       into a string no dictionary anywhere has, so the lookup missed and the heading stood.
   The words were never missing. The heading had been renamed before anyone could translate it.

   Fixed by escaping instead of deleting (&amp;), for the title and the subtitle both.

   What this holds:
     1. in Arabic, across all 19 pages, no visible heading inside #view is Latin-only;
     2. in Arabic the Providers heading is Arabic, and carries no double space;
     3. in English the Providers heading reads "Providers & GDS" — the ampersand is there;
     4. no section heading in either language carries a double space — the tell of a deleted
        character, which is how this defect hid in plain sight on the English page for months;
     5. a brake: in English the section heading of every page that has one is still ENGLISH. A
        "fix" that hardcodes the Arabic title would pass 1 and 2 and fail this;
     6. the sweep really ran — the section head was found on at least ten pages in each language,
        so check 1 cannot pass by finding no headings at all;
     7. no JS errors in either language.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched):
     · putting .replace(/[<>&]/g,'') back — fails 1 («Providers  GDS ?» is named in the failure
       line), 2, 3 and 4. Four checks, one cause, and the double space is printed rather than
       described.
   Run: node scripts/qa/probe-a-page-heading-is-never-english-in-arabic.mjs                       */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9234 — one mock. */
const PORT = 9234; const BASE = 'http://localhost:' + PORT;

/* 2026-09-23 (fire #232): this list was 19 routes and the app has 25. The six it never visited
   were exactly where an English heading was still sitting — /dashboard's "Agency profile — KSA
   settings" card, whose every other word is written in both languages, read English above Arabic
   on the Arabic page and no check here had ever looked at it. A sweep is only as wide as its list,
   so the list is now every route the app answers, taken from diag-pages-with-no-way-in. */
const PAGES = ['today', 'dashboard', 'leads', 'clients', 'finance', 'ops', 'operations', 'offers',
  'bookings', 'invoices', 'projects', 'airlines', 'vendors', 'providers', 'sops', 'slas', 'sopsla',
  'events', 'settings', 'activity', 'archive', 'documents', 'tickets', 'reports', 'sync'];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
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

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

const sweep = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }, lang);
  await p.waitForTimeout(1200);
  const out = {};
  for (const pg of PAGES) {
    await p.evaluate((x) => { try { current = x; openLead = null; openSup = null; render(); } catch (_) {} }, pg);
    await p.waitForTimeout(pg === 'settings' ? 4000 : 1800);
    out[pg] = await p.evaluate(() => {
      const v = document.querySelector('#view'); if (!v) return { heads: [], sec: null };
      /* only what is ON SCREEN: a hidden card's text is not a translation gap */
      const shown = (el) => { try { if (!el) return false; if (el.offsetParent) return true;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; } catch (_) { return false; } };
      const heads = [...v.querySelectorAll('h1,h2,h3')].filter(shown)
        .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const sh = v.querySelector('.v26_3-section-head h2');
      /* the section head is read RAW — whitespace not collapsed — because the double space IS the
         evidence here; collapsing it is what would hide the defect */
      return { heads, sec: sh ? (sh.textContent || '').trim() : null };
    });
  }
  return out;
};

const AR = await sweep('ar');
const EN = await sweep('en');
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const latin = (s) => /[A-Za-z]/.test(String(s || ''));
const latinOnly = (s) => latin(s) && !arabic(s);

const arOffenders = [];
for (const pg of PAGES) for (const h of (AR[pg] || {}).heads || []) if (latinOnly(h)) arOffenders.push(pg + ': ' + h);
const arSecs = PAGES.filter((pg) => (AR[pg] || {}).sec);
const enSecs = PAGES.filter((pg) => (EN[pg] || {}).sec);
const doubleSpaced = [];
for (const pg of PAGES) {
  for (const [l, M] of [['ar', AR], ['en', EN]]) { const s = (M[pg] || {}).sec; if (s && /\s\s/.test(s)) doubleSpaced.push(l + ' ' + pg + ': ' + JSON.stringify(s)); }
}
const arVendors = (AR.vendors || {}).sec || '';
const enVendors = (EN.vendors || {}).sec || '';
const enStillEnglish = enSecs.filter((pg) => !latin((EN[pg] || {}).sec) || arabic((EN[pg] || {}).sec));

const checks = [
  ['in Arabic no visible heading on any of the ' + PAGES.length + ' pages is Latin-only',
    arOffenders.length === 0, JSON.stringify(arOffenders.slice(0, 5))],
  ['in Arabic the Providers heading is Arabic and carries no double space',
    arabic(arVendors) && !/\s\s/.test(arVendors), JSON.stringify(arVendors)],
  ['in English the Providers heading reads "Providers & GDS" — the ampersand is there',
    /Providers & GDS/.test(enVendors), JSON.stringify(enVendors)],
  ['no section heading in either language carries a double space',
    doubleSpaced.length === 0, JSON.stringify(doubleSpaced.slice(0, 5))],
  ['brake: in English every section heading is still English',
    enStillEnglish.length === 0, JSON.stringify(enStillEnglish.map((pg) => (EN[pg] || {}).sec).slice(0, 5))],
  ['the sweep really ran — a section head was found on at least ten pages in each language',
    arSecs.length >= 10 && enSecs.length >= 10, JSON.stringify({ ar: arSecs.length, en: enSecs.length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
