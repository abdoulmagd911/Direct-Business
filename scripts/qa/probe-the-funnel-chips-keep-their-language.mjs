/* probe-the-funnel-chips-keep-their-language.mjs — the funnel tabs on Leads stay in the page's
   language when the list is re-drawn, and their counts still move.

   Fire #209. Driven live in Arabic: on a fresh Leads render the eight funnel tabs read Arabic
   («الكل · 78», «وارد · 0», «وكالات السفر · 0» …). One click on any filter — Hide closed, Needs
   attention, Mine, a stage chip, a keystroke in the search box, all of which call drawLeads() —
   and every one of them came back in ENGLISH:

       "All · 80"  "Inbound · 0"  "Outreach & Network · 0"  "Travel Trade · 0" …

   and stayed English: sampled at 300ms, 1s, 2.5s and 5s after the click, all eight still Latin.
   The page was left half-Arabic until the person navigated away and came back.

   The cause is a fix undoing another fix. The tabs are built with `f.name_en` and were translated
   afterwards by the Arabic pass (js/21). On 2026-09-09 a count-refresh was added so the numbers
   stop going stale on a re-draw — and it rebuilt each label from `data-funnel-label`, which holds
   the ENGLISH name. Every re-draw therefore restored English over the Arabic.

   Fixed by carrying BOTH languages on the button (`data-label-en` / `data-label-ar`, the Arabic
   from the funnel's own `name_ar` through this file's `fnTitle`/`fnL` — the helpers the funnel
   card and the hover card already use) and choosing at re-draw time. The count-refresh keeps
   working; it just no longer decides the language.

   What this holds:
     1. in Arabic, on a fresh render, no funnel tab is Latin-only;
     2. in Arabic, AFTER a re-draw, still none — this is the regression itself;
     3. brake: in English the tabs read English, before AND after a re-draw. A fix that hardcoded
        the Arabic label would pass 1 and 2 and fail this;
     4. brake: the counts still move on a re-draw. Deleting the count-refresh would also make 1-3
        pass, and would silently restore the stale-number bug of 2026-09-09;
     5. "Needs attention" follows the page language too;
     6. no JS errors in either language.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · restoring `b.textContent=b.getAttribute('data-funnel-label')+…` — fails 2 and prints the
       English tabs it put back;
     · making the re-draw skip the label entirely (labels frozen, counts never updated) — fails 4.
   Run: node scripts/qa/probe-the-funnel-chips-keep-their-language.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9238 — one mock. */
const PORT = 9238; const BASE = 'http://localhost:' + PORT;

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

/* a funnel of our own with a real Arabic name, and one LOST lead inside it so that toggling
   "Hide closed" genuinely changes the numbers — check 4 would pass vacuously otherwise */
const seeded = await p.evaluate(() => {
  try {
    window.__FUNNELS = window.__FUNNELS || [];
    window.__FUNNELS.push({ id: 'qa_fn_lang', key: 'qa_lang', name_en: 'QA Language Funnel', name_ar: 'قمع اللغة', color: 'blue', field_template: [] });
    const B = DB.businesses || [];
    const src = B.find((x) => !x.isClient) || B[0]; if (!src) return { ok: false };
    const mk = (id, stage) => { const c = JSON.parse(JSON.stringify(src)); c.id = id; c.isClient = false; c.name = 'QALANG ' + id;
      c.funnelKey = 'qa_lang'; c.stage = stage; c.status = stage; c.activities = []; if (c.raw) c.raw = {}; return c; };
    B.push(mk('qa_lang_open', 'Contacted'));
    B.push(mk('qa_lang_lost', 'Lost'));
    return { ok: true };
  } catch (e) { return { ok: false, err: e.message }; }
});
await p.waitForTimeout(400);

const readChips = () => p.evaluate(() => {
  const strip = document.getElementById('funnelTabs');
  if (!strip) return { chips: [], attn: null };
  const btns = [...strip.querySelectorAll('button')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim());
  const keyed = [...strip.querySelectorAll('button[data-funnel-key]')].map((x) => ({
    key: x.getAttribute('data-funnel-key'), text: (x.textContent || '').replace(/\s+/g, ' ').trim() }));
  const attn = btns.find((t) => /Needs attention|انتباه/.test(t)) || null;
  return { chips: keyed, attn };
});
const show = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'leads'; openLead = null; window.__funnelTab = 'all'; leadFilter.hideClosed = true; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2800);
};
const redraw = async () => { await p.evaluate(() => { try { leadFilter.hideClosed = !leadFilter.hideClosed; drawLeads(); } catch (_) {} }); await p.waitForTimeout(1800); };

await show('ar');
const arFresh = await readChips();
await redraw();
const arRedrawn = await readChips();
await p.waitForTimeout(3000);
const arLater = await readChips();

await show('en');
const enFresh = await readChips();
await redraw();
const enRedrawn = await readChips();
await b.close(); srv.close?.();

const latinOnly = (s) => /[A-Za-z]/.test(String(s || '')) && !/[؀-ۿ]/.test(String(s || ''));
const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));
const latinChips = (r) => r.chips.filter((c) => latinOnly(c.text));
const countOf = (r, key) => { const c = r.chips.find((x) => x.key === key); if (!c) return null; const m = c.text.match(/(\d+)\s*$/); return m ? Number(m[1]) : null; };

const checks = [
  ['in Arabic, on a fresh render, no funnel tab is Latin-only',
    arFresh.chips.length >= 3 && latinChips(arFresh).length === 0,
    JSON.stringify({ tabs: arFresh.chips.length, latin: latinChips(arFresh).map((c) => c.text).slice(0, 4) })],
  ['in Arabic, after a re-draw, still none — and still none three seconds later',
    latinChips(arRedrawn).length === 0 && latinChips(arLater).length === 0,
    JSON.stringify({ afterRedraw: latinChips(arRedrawn).map((c) => c.text).slice(0, 4), later: latinChips(arLater).map((c) => c.text).slice(0, 3) })],
  ['brake: in English the tabs read English, before and after a re-draw',
    enFresh.chips.length >= 3 && enFresh.chips.every((c) => !arabic(c.text)) && enRedrawn.chips.every((c) => !arabic(c.text)),
    JSON.stringify({ fresh: enFresh.chips.slice(0, 3).map((c) => c.text), after: enRedrawn.chips.slice(0, 3).map((c) => c.text) })],
  /* the fixture guarantees at least one closed lead of our own, so showing the closed ones MUST
     raise the "All" count. How many others the workspace holds is not this probe's business — the
     property is that the number moved at all, which is what the 2026-09-09 refresh exists for. */
  ['brake: the counts still move on a re-draw — the 2026-09-09 refresh survives',
    countOf(arFresh, 'all') != null && countOf(arRedrawn, 'all') != null && countOf(arRedrawn, 'all') > countOf(arFresh, 'all'),
    JSON.stringify({ closedHidden: countOf(arFresh, 'all'), closedShown: countOf(arRedrawn, 'all'), seeded })],
  ['"Needs attention" follows the page language too',
    arabic(arFresh.attn) && arabic(arRedrawn.attn) && !arabic(enFresh.attn) && /Needs attention/.test(String(enFresh.attn)),
    JSON.stringify({ ar: arFresh.attn, arAfter: arRedrawn.attn, en: enFresh.attn })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
