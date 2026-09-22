/* probe-the-leads-list-says-what-it-hides.mjs — the Leads strip names the closed leads it is
   holding back, and offers the one click that shows them.

   Fire #209. Counted against the live database, the Leads table drew 78 rows over 80 leads.
   Nothing was broken — "Hide closed" is on by default and two leads are Lost — but this page was
   the only list in the app that did not say so:

       Airlines  "Showing 136 of 139 airlines."  and then names the three it is not showing
       Events    "43 of 80 shown"
       Leads     "In view · 78 leads"  and a tick labelled "Hide closed"

   A reader of the Leads page had no way to know two records existed at all. Same app, same kind of
   statement, less information — so the strip now reads "2 closed hidden · Show", and Show is the
   one click that brings them back.

   What this holds:
     1. with closed leads hidden, the strip NAMES how many, in English;
     2. and in Arabic;
     3. Show works: the row count rises by exactly the number the strip named, and the badge goes;
     4. brake: when nothing is being hidden, there is no badge — a line that is always there is
        furniture, not information;
     5. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched), a real run:
     · dropping the badge from the strip — fails 1 and 2, and check 3 with them (there is nothing
       left to click), which is one cause, not three findings.
   Run: node scripts/qa/probe-the-leads-list-says-what-it-hides.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9239 — one mock. */
const PORT = 9239; const BASE = 'http://localhost:' + PORT;

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

await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

const openLeads = async (lang, hideClosed) => {
  await p.evaluate(([l, h]) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'leads'; openLead = null;
    leadFilter.stage = 'all'; leadFilter.hideClosed = h; window.__funnelTab = 'all'; render(); } catch (_) {} }, [lang, hideClosed]);
  await p.waitForTimeout(2800);
};
const readStrip = () => p.evaluate(() => {
  const sum = document.getElementById('leadsum');
  const tb = document.querySelector('#view table');
  const badge = document.querySelector('.v209-hidden');
  return { strip: sum ? (sum.innerText || '').replace(/\s+/g, ' ').trim() : null,
    badge: badge ? (badge.textContent || '').replace(/\s+/g, ' ').trim() : null,
    rows: tb ? [...tb.querySelectorAll('tbody tr')].filter((x) => x.querySelectorAll('td').length > 1).length : null };
});
const numberIn = (s) => { const m = String(s || '').match(/(\d+)/); return m ? Number(m[1]) : null; };

await openLeads('en', true);
const enHidden = await readStrip();
const enCount = numberIn(enHidden.badge);
/* Show */
const clicked = await p.evaluate(() => { const a = document.querySelector('.v209-hidden a'); if (!a) return false; a.click(); return true; });
await p.waitForTimeout(2000);
const enShown = await readStrip();

await openLeads('ar', true);
const arHidden = await readStrip();

/* nothing hidden: the tick is off, so the badge must not be there */
await openLeads('en', false);
const enOff = await readStrip();
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const checks = [
  ['with closed leads hidden, the strip names how many, in English',
    !!enHidden.badge && enCount > 0 && /closed hidden/i.test(enHidden.badge) && /Show/.test(enHidden.badge),
    JSON.stringify({ badge: enHidden.badge, rows: enHidden.rows })],
  ['and in Arabic',
    !!arHidden.badge && arabic(arHidden.badge) && numberIn(arHidden.badge) === enCount && !/closed hidden/i.test(arHidden.badge),
    JSON.stringify({ badge: arHidden.badge, expectedCount: enCount })],
  ['Show brings back exactly the number it named, and the badge goes',
    clicked === true && enShown.badge === null && enShown.rows === enHidden.rows + enCount,
    JSON.stringify({ before: enHidden.rows, named: enCount, after: enShown.rows, badgeAfter: enShown.badge })],
  ['brake: with nothing hidden there is no badge — it never becomes furniture',
    enOff.badge === null && enOff.rows === enShown.rows,
    JSON.stringify({ badge: enOff.badge, rows: enOff.rows, expected: enShown.rows })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
