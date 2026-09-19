/* probe-topbar-survives-browser-zoom.mjs — guards the 2026-09-19 (fire #96) fix, index.html's
   `v85-midwidth` block.

   The fourth environment dimension, after language (#94), the clock (#95) and this round's dark
   mode: the size of the window. Every QA round had used a big screen at 100% zoom. A 1366x768
   laptop at Chrome's 150% zoom is 911 CSS pixels wide; at 125% it is 1093. So is a half-screen
   window, and so is anyone who has made their text bigger.

   In that band the top bar was one non-wrapping row holding the page title, the global search and
   about 500px of tool buttons. The title and the search had no floor, so the tools won: measured
   across the range, at 1050px the title was already clipped and from 1020px down to the phone
   breakpoint it was ZERO PIXELS WIDE — the word "Leads" painting over a search box that had itself
   collapsed to a 52px circle with no usable input. You could not see which page you were on and
   the search everyone uses was gone, with nothing to say why.

   The fix lets the bar wrap, stops anything being squeezed to nothing, and gives the search a
   floor. It also has to beat `.top{height:56px}`, which core-09 injects at RUNTIME — a first
   version without that dropped the wrapped row straight through the orange divider onto the page.
   That is why the rule is written `.top.top` and marked important, and why this probe checks the
   wrapped row is INSIDE the bar rather than merely present.

   Every check is gated on the element existing: a missing title is a failure, never a pass.

   Sabotage-tested: with index.html reverted, 5 checks go FAIL, exit 1 — including the one at 700px,
   which is how the band turned out to reach all the way down to the phone breakpoint.
   Run: node scripts/qa/probe-topbar-survives-browser-zoom.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9073; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
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
  await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0 && !!document.querySelector('.top'), { timeout: 90000 });
  await p.waitForTimeout(2500);

  const at = {};
  for (const w of [1366, 1100, 1000, 911, 700]) {
    await p.setViewportSize({ width: w, height: 640 });
    await p.evaluate(() => { try { current = 'leads'; render(); } catch (_) { } });
    await p.waitForTimeout(1800);
    at[w] = await p.evaluate(() => {
      const top = document.querySelector('.top'); if (!top) return { noBar: true };
      const tr = top.getBoundingClientRect();
      /* the page title: whatever element in the bar actually holds the heading text */
      const t = document.getElementById('vTitle') || top.querySelector('h1');
      const title = t ? (() => { const r = t.getBoundingClientRect();
        /* the visible span of the text itself, not of a stretchy wrapper */
        const rng = document.createRange(); rng.selectNodeContents(t);
        const tb = rng.getBoundingClientRect();
        return { text: (t.innerText || '').trim().slice(0, 20), boxW: Math.round(r.width), textW: Math.round(tb.width), textRight: Math.round(tb.right), barRight: Math.round(tr.right) }; })() : null;
      const inp = document.getElementById('gsearch');
      const wrapEl = inp && inp.closest('.gsearch-wrap');
      const shown = wrapEl ? getComputedStyle(wrapEl).display !== 'none' : false;
      const tools = top.querySelector('.tools');
      const toolsR = tools ? tools.getBoundingClientRect() : null;
      return { barTop: Math.round(tr.top), barBottom: Math.round(tr.bottom), barH: Math.round(tr.height), title,
        searchShown: shown, searchW: shown && inp ? Math.round(inp.getBoundingClientRect().width) : 0,
        toolsFound: !!tools, toolsInsideBar: toolsR ? toolsR.bottom <= tr.bottom + 1 && toolsR.right <= tr.right + 1 : null,
        toolsBottom: toolsR ? Math.round(toolsR.bottom) : null };
    });
  }
  await ctx.close();
  return at;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
for (const w of [1366, 1100, 1000, 911, 700]) {
  const e = en[w];
  console.log(`  ${String(w).padStart(4)}px · bar ${String(e.barH).padStart(3)}px · title "${e.title && e.title.text}" ${e.title && e.title.textW}px wide, ends ${e.title && (e.title.barRight - e.title.textRight)}px inside the bar · search ${e.searchShown ? e.searchW + 'px' : 'hidden (by design under 780)'} · tools inside the bar: ${e.toolsInsideBar}`);
}

const band = [1100, 1000, 911];
const titleOK = (o) => !!(o && o.title && o.title.text && o.title.textW > 8 && o.title.boxW > 8);
const checks = [
  ['the bar and its title were really found at every size, in both languages, so nothing below passes by absence',
    [1366, 1100, 1000, 911, 700].every((w) => en[w] && !en[w].noBar && en[w].title && ar[w] && !ar[w].noBar && ar[w].title)],
  ['in the zoom band the page title is on screen with a real width, not squeezed to nothing', band.every((w) => titleOK(en[w]))],
  ['and it stays inside the bar instead of painting over the search box', band.every((w) => en[w].title.textRight <= en[w].title.barRight + 1)],
  ['the global search is still wide enough to type in, not a 52px circle', band.every((w) => en[w].searchShown && en[w].searchW >= 150)],
  ['when the tools wrap onto a second row they stay INSIDE the bar — core-09 pins .top to 56px at runtime, and a fix that loses to it drops the row through the orange divider onto the page',
    band.every((w) => en[w].toolsFound && en[w].toolsInsideBar === true)],
  ['the bar grew to hold that second row rather than keeping its fixed height', band.some((w) => en[w].barH > 60)],
  ['Arabic is no worse off', band.every((w) => titleOK(ar[w]) && ar[w].searchShown && ar[w].searchW >= 150 && ar[w].toolsInsideBar === true)],
  ['a full-size desktop is untouched: one row, 56px, as it always was', en[1366].barH <= 60 && en[1366].toolsInsideBar === true && titleOK(en[1366])],
  ['below 780 the search is hidden on purpose and the title is still there', en[700].searchShown === false && titleOK(en[700])],
  ['resizing wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail EN:', JSON.stringify(en, null, 1)); console.log('detail AR:', JSON.stringify(ar, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
