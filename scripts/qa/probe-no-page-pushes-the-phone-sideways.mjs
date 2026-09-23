/* probe-no-page-pushes-the-phone-sideways.mjs — every page fits an iPhone-sized screen, in both
   languages, and the notice card the app speaks through fits too.

   Fire #213. Most of this team opens the app on a phone. There IS a phone pass already
   (`probe-phone.mjs`), but it signs in as each real employee, so it needs the staff passwords from
   the environment and cannot run in the battery — and it walks 8 pages per role, not the whole
   app. This one runs anywhere, covers all 20 pages in both languages, and holds the one rule that
   makes a phone screen usable: the page may not slide sideways.

   Measured live at 390×844 before writing it: all 20 pages clean, nothing outside the viewport,
   no page scroll wider than the screen. So this is a guard on a passing state rather than a fix —
   the app's wide tables are already inside their own scrollers, which is exactly the shape that
   keeps the PAGE still while a TABLE scrolls.

   What this holds:
     1. no page makes the document itself wider than the phone, in Arabic;
     2. the same in English (RTL and LTR put different things at the edge);
     3. nothing visible sits outside the viewport unless an ancestor scrolls sideways on purpose —
        a table in a .tbl-wrap is fine, a card hanging off the edge is not;
     4. the notice card (js/63's, which js/102 and js/103 both speak through) fits inside the
        screen and its buttons are big enough to hit;
     5. the pages really rendered — a blank page cannot overflow, so without this the whole thing
        could pass by drawing nothing;
     6. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched), a real run:
     · giving .card a min-width of 900px in index.html's stylesheet — fails 1, 2 and 3, naming the
       pages that broke and the element hanging off the edge.
   Run: node scripts/qa/probe-no-page-pushes-the-phone-sideways.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9243 — one mock. */
const PORT = 9243; const BASE = 'http://localhost:' + PORT;
/* 2026-09-23 (fire #233), M78 again: twenty routes were swept and the app answers twenty-five.
   The five missing were the Dashboard, the SOP/SLA pair's combined page, Service Levels on its
   own, and the two alias routes. */
const PAGES = ['today', 'dashboard', 'leads', 'clients', 'finance', 'ops', 'operations', 'offers',
  'bookings', 'invoices', 'projects', 'airlines', 'vendors', 'providers', 'sops', 'slas', 'sopsla',
  'events', 'settings', 'activity', 'archive', 'documents', 'tickets', 'reports', 'sync'];

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-GB' });
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
/* signed in through the DOM rather than by clicking: a page that IS broken sideways can push the
   sign-in button out of reach, and then this probe dies of a timeout instead of reporting which
   page broke — which is exactly what happened the first time it was sabotage-tested. */
await p.evaluate(([e, pw]) => {
  const set = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  set(document.getElementById('cl_email'), e); set(document.getElementById('cl_pw'), pw);
  const go = document.getElementById('cl_go'); if (go) go.click();
}, ['test@directksa.com', 'Dq7nTest-2026-Riyadh']);
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3500);

const sweep = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); } catch (_) {} }, lang);
  const out = {};
  for (const pg of PAGES) {
    await p.evaluate((x) => { try { current = x; openLead = null; openSup = null; render(); } catch (_) {} }, pg);
    await p.waitForTimeout(pg === 'settings' ? 3500 : 1500);
    out[pg] = await p.evaluate(() => {
      const de = document.documentElement;
      const shown = (el) => { try { if (el.offsetParent) return true; const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; } catch (_) { return false; } };
      /* a wide table inside its own horizontal scroller is the CORRECT shape — the page stays
         still while the table moves — so an element only counts as escaping when nothing above it
         scrolls sideways */
      const inScroller = (el) => { let n = el; while (n && n !== document.body) { try { const cs = getComputedStyle(n);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true; } catch (_) {} n = n.parentElement; } return false; };
      const escaped = [...document.querySelectorAll('#view *')].filter(shown).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2) && !inScroller(el);
      }).slice(0, 3).map((el) => (el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/)[0]).slice(0, 30));
      const v = document.getElementById('view');
      return { pageWider: de.scrollWidth > de.clientWidth + 2, scrollW: de.scrollWidth, screen: de.clientWidth,
        escaped, chars: v ? (v.innerText || '').length : 0 };
    });
  }
  return out;
};

const en = await sweep('en');
const ar = await sweep('ar');
/* the card the app speaks through, with a second button beside its OK — the shape js/103 makes */
const card = await p.evaluate(() => {
  try {
    window.v63Notice('QA — a company you followed a link to was merged into another company, and its records live there now.');
    const c = document.getElementById('v63Notice'); if (!c) return null;
    const row = c.lastElementChild;
    const btn = document.createElement('button'); btn.className = 'btn sm pri v103-go'; btn.textContent = 'QA open the other company';
    row.insertBefore(btn, row.firstChild);
    const de = document.documentElement; const r = c.getBoundingClientRect();
    return { inside: r.left >= -1 && r.right <= de.clientWidth + 1, width: Math.round(r.width), screen: de.clientWidth,
      buttons: [...c.querySelectorAll('button')].map((x) => ({ t: (x.textContent || '').trim().slice(0, 24), h: Math.round(x.getBoundingClientRect().height),
        inside: x.getBoundingClientRect().right <= de.clientWidth + 1 && x.getBoundingClientRect().left >= -1 })) };
  } catch (e) { return { err: e.message }; }
});
await b.close(); srv.close?.();

const wideIn = (m) => PAGES.filter((pg) => m[pg] && m[pg].pageWider);
const escapedIn = (m) => PAGES.filter((pg) => m[pg] && m[pg].escaped.length).map((pg) => pg + ': ' + m[pg].escaped.join(', '));
const blank = (m) => PAGES.filter((pg) => !m[pg] || m[pg].chars < 40);

const checks = [
  ['no page makes the document wider than the phone, in Arabic',
    wideIn(ar).length === 0, JSON.stringify(wideIn(ar).map((pg) => pg + ' ' + ar[pg].scrollW + 'px'))],
  ['the same in English',
    wideIn(en).length === 0, JSON.stringify(wideIn(en).map((pg) => pg + ' ' + en[pg].scrollW + 'px'))],
  ['nothing visible sits outside the screen unless it is inside something that scrolls on purpose',
    escapedIn(ar).length === 0 && escapedIn(en).length === 0,
    JSON.stringify({ ar: escapedIn(ar).slice(0, 3), en: escapedIn(en).slice(0, 3) })],
  ['the notice card fits the screen and its buttons can be hit',
    !!card && card.inside === true && card.buttons.length >= 2 && card.buttons.every((x) => x.h >= 32 && x.inside),
    JSON.stringify(card)],
  ['the pages really rendered — a blank page cannot overflow',
    blank(ar).length <= 1 && blank(en).length <= 1,
    JSON.stringify({ ar: blank(ar), en: blank(en) })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
