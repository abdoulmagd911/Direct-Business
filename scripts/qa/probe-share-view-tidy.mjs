/* probe-share-view-tidy.mjs — guards js/79: what an OUTSIDER holding a view-only share link sees.
   Found live 2026-09-15 (fire #50) by opening a real link in a fresh browser with no session:
     1. the view-only banner covered the page's top bar (title, search, language, export) — the
        sticky top bar and sidebar started at 0 under the fixed 36px banner;
     2. the sidebar offered FINANCE (js/52's sessionless floor) although the Share panel promises
        "Today, Leads and Clients"; setting current='finance' rendered an (empty) Finance page;
     3. the sidebar footer showed the built-in placeholder person by name, as if the outsider
        were signed in as a colleague.
   Seeds one active share_links row in the mock, opens /s/<token>/leads with no session, asserts:
   banner visible; top bar's box starts at or below the banner's bottom edge; no Finance button
   visible in the sidebar; current='finance' stays put and says why, showing no ledger; footer reads "View-only guest" (and
   the Arabic wording after a language flip); edit controls still absent; no JS errors.
   Sabotage-tested: with the js/79 script line removed from index.html, 6 of the 10 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-share-view-tidy.mjs                                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9036;
const TOKEN = 'qa-share-tidy-token-0123456789abcdef';
const srv = start(PORT, { share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }] });
const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => document.body.getAttribute('data-share') === '1' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0 && document.querySelectorAll('#nav button').length > 0, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(3000);
const read = () => p.evaluate(() => {
  const banner = document.getElementById('v38banner'); const br = banner ? banner.getBoundingClientRect() : null;
  const top = document.querySelector('.top'); const tr = top ? top.getBoundingClientRect() : null;
  const vis = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent !== null || getComputedStyle(x).position === 'fixed').length;
  const finBtns = [...document.querySelectorAll('#nav button')].filter((x) => x.style.display !== 'none' && getComputedStyle(x).display !== 'none' && (x.getAttribute('data-view') === 'finance' || x.id === 'v44FinBtn' || /^(Finance|المالية)$/.test(((x.querySelector('span') || x).textContent || '').trim())));
  const foot = document.querySelector('.side .foot') || document.querySelector('.foot');
  return { share: document.body.getAttribute('data-share'), bannerVisible: !!(br && br.height > 10 && br.width > 100), bannerBottom: br ? br.bottom : null, topTop: tr ? tr.top : null, topFound: !!tr, finVisible: finBtns.length, current, footName: foot ? (foot.querySelector('b') || {}).textContent : null, footSub: foot ? (foot.querySelector('span') || {}).textContent : null, footGuest: !!(foot && foot.getAttribute('data-share-guest') === '1'), editors: vis('#view [onclick*="editBusiness"],#view [onclick*="leadQuickEdit"],#view .btn.pri'), biz: (DB.businesses || []).length, lang: LANG };
});
const en = await read();
const bounce = await p.evaluate(() => { try { current = 'finance'; openLead = ''; render(); } catch (_) { } return new Promise((res) => setTimeout(() => res({ current, len: (document.getElementById('view').innerText || '').trim().length, txt: (document.getElementById('view').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200), rows: document.querySelectorAll('#view tbody tr').length }), 1500)); });
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(2000);
const ar = await read();
await b.close(); srv.close?.();

const checks = [
  ['shared view loaded (data-share=1, businesses present)', en.share === '1' && en.biz > 0],
  ['view-only banner is visible', en.bannerVisible],
  ['top bar starts at or below the banner (not covered)', en.topFound && en.bannerBottom != null && en.topTop >= en.bannerBottom - 1],
  ['no Finance entry in the sidebar for a link holder', en.finVisible === 0],
  /* 2026-09-17 (fire #79): this used to read `bounce.current === 'today'` — it guarded the SILENT
     bounce this layer added on 2026-09-15. Fire #78 replaced that bounce, because the reason for it
     had gone: Finance no longer renders empty in a share view, it answers with a sentence of its own,
     and bouncing meant the holder typed /s/<token>/finance, landed somewhere else and was told
     nothing. The check's intent — a link holder must never sit on a Finance page that shows them
     nothing — is unchanged and is now stronger: they stay on the page AND are told why, with no
     ledger row rendered. (Two probes disagreed about this behaviour for two days:
     probe-share-and-settings-attacks wanted the sentence, this one wanted the bounce.) */
  ['landing on Finance in a shared view is told why, and shows no ledger', bounce.current === 'finance' && /not available in shared|غير متاح/i.test(bounce.txt || '') && bounce.rows === 0],
  ['footer says "View-only guest", not the placeholder person', en.footGuest && en.footName === 'View-only guest'],
  ['AR: footer reads "ضيف" after the language flip', ar.lang === 'ar' && ar.footName === 'ضيف'],
  ['AR: still no Finance entry', ar.finVisible === 0],
  ['edit controls still absent in the shared view', en.editors === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, bounce, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
