/* probe-a-settings-button-does-what-it-says.mjs — every control on the Settings page does
   something when it is pressed, and the two that could not are gone.

   Fire #219. The Settings page was driven live, control by control, each from a clean page. Seven
   of them moved nothing at all:

     👤 View preset → 🎯 Commercial · 💰 Finance · 📊 CFO · 🌐 Everything · 📈 B2B snapshot
     👤 View as · "Change preset"

   The preset card carried the sentence "Each preset shapes the sidebar and Today KPIs." Measured,
   all five presets produced the identical screen — the same 20 sidebar entries, the same two
   visible cards, the same 1,084 characters of Today. Each preset's `nav` and `todoKpis` lists are
   read by nothing; the only flag still consumed drives the Commercial Credit Pool widget, which
   v26.3's calm-Today redesign demotes out of sight. The "View as" card clicked `#v25PresetBtn`, a
   dropdown deleted long ago, so `if(b)` quietly did nothing.

   Both are hidden (reversibly — V25_PRESETS and v25SetPreset are untouched) rather than rebuilt:
   who sees which page belongs to Team & Access → "Who can open what", a card on the same page, and
   a second mechanism shaping the sidebar could hide a page from somebody the access matrix says
   may open it.

   A third control was mislabelled rather than dead: "Company profile · CR, VAT, IBAN, Wakeel"
   looked for a company record of our own that has never existed in the live data (108 companies,
   none of them us) and fell back to scrolling to the PRINTABLES card and flashing an outline round
   it. It now opens the Generator's "Company assets & registry", which is where those values are.

   Two controls that LOOK inert and are not, which is why this probe watches for a new tab: the two
   one-pagers open one through window.open. The first pass of this round called them broken; they
   were not. The instrument was.

   What this holds:
     1. every visible control on Settings does something — a new address, a panel, a new tab, a
        notice, or a language flip. Not one of them moves nothing;
     2. the control that says "CR, VAT, IBAN" lands on the registry that holds them;
     3. no preset button is offered on the page any more;
     4. the language control still flips the page and flips it back — the one control this probe
        must drive separately, because it changes every label it would otherwise be reading;
     5. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · putting the View-preset card back — fails 1 and 3, naming all five inert buttons;
     · pointing the company card back at the scroll-and-flash — fails 1 and 2, landing on /settings,
       which is also the proof that a scroll-and-flash is indistinguishable from doing nothing.
   Run: node scripts/qa/probe-a-settings-button-does-what-it-says.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9248 — one mock. */
const PORT = 9248; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const popups = []; ctx.on('page', (pg) => popups.push(pg));
const p = await ctx.newPage();
const errors = []; const dialogs = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', (d) => { dialogs.push(String(d.message()).slice(0, 80)); d.dismiss(); });
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

await p.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3500);

const settle = async () => {
  await p.evaluate((keep) => {
    try {
      /* take away anything a click added on top of the page, so the next control is clicked on a
         clean Settings page rather than through somebody else's panel — the mistake the first pass
         of this round made, which reported four working controls as inert */
      [...document.querySelectorAll('body > *')].slice(keep).forEach((n) => { try { n.remove(); } catch (_) {} });
      const ov = document.getElementById('ov'); if (ov) ov.classList.remove('show');
      if (typeof LANG !== 'undefined' && LANG !== 'en') { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); }
      current = 'settings'; openLead = null; render();
    } catch (_) {}
  }, baseline);
  await p.waitForTimeout(1600);
};
const baseline = await p.evaluate(() => { current = 'settings'; openLead = null; render(); return document.querySelectorAll('body > *').length; });
await p.waitForTimeout(2200);

const snap = () => p.evaluate(() => ({
  url: location.pathname, text: (document.body.innerText || '').length,
  kids: document.querySelectorAll('body > *').length,
  panels: [...document.querySelectorAll('body *')].filter((e) => { try { return getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().width > 150 && (e.innerText || '').trim().length > 10; } catch (_) { return false; } }).length,
}));

const labels = await p.evaluate(() => { const v = document.getElementById('view');
  return [...v.querySelectorAll('button,a.btn')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
    .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 52)); });

const inert = []; let companyUrl = null;
for (const label of labels) {
  if (!label) continue;
  if (/sign out|logout|save access|^Language/i.test(label)) continue;
  await settle();
  const before = await snap(); const dB = dialogs.length, popB = popups.length;
  const hit = await p.evaluate((lb) => { const v = document.getElementById('view');
    const el = [...v.querySelectorAll('button,a.btn')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; })
      .find((e) => ((e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 52)) === lb);
    if (!el) return 'missing'; el.click(); return 'clicked'; }, label);
  await p.waitForTimeout(2200);
  const after = await snap();
  const moved = before.url !== after.url || Math.abs(before.text - after.text) > 4 ||
    before.kids !== after.kids || before.panels !== after.panels ||
    dialogs.length > dB || popups.length > popB;
  if (hit === 'clicked' && !moved) inert.push(label);
  if (/CR, VAT, IBAN/.test(label)) companyUrl = after.url;
  while (popups.length > popB) { try { await popups.pop().close(); } catch (_) { popups.pop(); } }
}
await settle();
const presetButtons = await p.evaluate(() => { const v = document.getElementById('view');
  return [...v.querySelectorAll('button,a.btn')].map((e) => (e.innerText || '').trim())
    .filter((t) => /Commercial$|CFO|Everything|B2B snapshot|View preset|Change preset/.test(t)); });
/* the language control, driven on its own */
const langFlip = await (async () => {
  const before = await p.evaluate(() => (document.body.innerText || '').slice(0, 400));
  await p.evaluate(() => { const v = document.getElementById('view');
    const el = [...v.querySelectorAll('button,a.btn')].find((e) => /^Language/i.test((e.innerText || '').trim())); if (el) el.click(); });
  await p.waitForTimeout(2200);
  const mid = await p.evaluate(() => (document.body.innerText || '').slice(0, 400));
  await p.evaluate(() => { try { LANG = 'en'; if (typeof applyLang === 'function') applyLang(); current = 'settings'; render(); } catch (_) {} });
  await p.waitForTimeout(2000);
  const back = await p.evaluate(() => (document.body.innerText || '').slice(0, 400));
  return { flipped: mid !== before && /[؀-ۿ]/.test(mid), restored: /[A-Za-z]{4,}/.test(back) };
})();
await b.close(); srv.close?.();

const checks = [
  ['every visible control on Settings does something',
    labels.length > 8 && inert.length === 0,
    JSON.stringify({ controls: labels.length, inert })],
  ['the control that says "CR, VAT, IBAN" lands on the registry that holds them',
    companyUrl !== null && /documents/.test(String(companyUrl)),
    JSON.stringify({ landedOn: companyUrl })],
  ['no preset button is offered on the page any more',
    presetButtons.length === 0,
    JSON.stringify(presetButtons)],
  ['the language control still flips the page, and it can be flipped back',
    langFlip.flipped === true && langFlip.restored === true,
    JSON.stringify(langFlip)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
