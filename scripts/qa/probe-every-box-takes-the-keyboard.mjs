/* probe-every-box-takes-the-keyboard.mjs — not a probe for two boxes; a probe for the SHAPE.

   Ten files in this app build a full-screen overlay of their own instead of using the shared modal,
   and the shared modal's protections do not reach them. Fire #92 found three ignoring the Escape
   key. Fire #126 found js/09's funnel box ignoring the keyboard entirely. Fire #127 then went
   looking with a crawler rather than by hand and found two more:

     · the Team & Access panel (js/31) — the screen that manages eleven real staff accounts and what
       each may open. Opening it left focus on the button behind, and every one of six Tab presses
       landed on the Settings page underneath.
     · the command palette (core-06) — whose own comment has always claimed the trap covers it. The
       wrapper set the ARIA attributes and stopped there; five of six tabs walked the page behind.

   So this probe does not name boxes. It walks the app the way a person does — click a visible
   button, see whether a full-screen box appears — and for every one that opens it asks the two
   questions that matter: did the keyboard go INTO it, and does Tab stay there. A box added next
   month is covered without anyone remembering to add it here.

   Buttons whose words suggest deleting, wiping or resetting are never clicked.

   It is a crawl, so it is not instant: about four minutes, most of it waiting for pages to settle
   between clicks. That is the price of a check that covers boxes nobody has written yet.

   Sabotage-tested 2026-09-20 against a COPY of the app (APP_DIR — the repository is untouched):
   with js/31's call to the trap removed, 2 checks FAIL and the report names the box and the page it
   was opened from.
   Run: node scripts/qa/probe-every-box-takes-the-keyboard.mjs                                     */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9097; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const DANGER = /delete|remove|wipe|reset|حذف|إزالة|مسح|تصفير|sign out|خروج/i;

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
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
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  await p.waitForTimeout(5000);

  /* a box of a layer's own: fixed, covering most of the window, and not the shared modal's #ov */
  const overlayNow = () => p.evaluate(() => {
    const hit = [].slice.call(document.querySelectorAll('body > div, body > section')).find((e) => {
      const cs = getComputedStyle(e); if (cs.position !== 'fixed' || cs.display === 'none') return false;
      const r = e.getBoundingClientRect();
      return r.width > window.innerWidth * 0.6 && r.height > window.innerHeight * 0.6; });
    if (!hit || hit.id === 'ov') return null;
    return { id: hit.id || '', controls: hit.querySelectorAll('input,select,textarea,button,a[href]').length };
  });
  const focusIn = (id) => p.evaluate((i) => {
    const a = document.activeElement; const host = i ? document.getElementById(i) : null;
    return { el: a ? (a.tagName + (a.id ? '#' + a.id : '')) : null, inside: !!(host && a && host.contains(a)) };
  }, id);

  const pages = await p.evaluate(() => [].slice.call(document.querySelectorAll('#nav button')).map((x) => (x.textContent || '').trim()).filter(Boolean));
  const seen = [];
  for (const pg of pages) {
    await p.evaluate((l) => { const btn = [].slice.call(document.querySelectorAll('#nav button')).find((x) => (x.textContent || '').trim() === l); if (btn) btn.click(); }, pg);
    await p.waitForTimeout(1200);
    const labels = await p.evaluate((d) => {
      const rx = new RegExp(d, 'i');
      return [].slice.call(document.querySelectorAll('#view button, #view .btn'))
        .filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map((x) => (x.textContent || '').trim())
        .filter((t) => t && t.length < 40 && !rx.test(t)).filter((t, i, a) => a.indexOf(t) === i).slice(0, 7);
    }, DANGER.source);
    for (const label of labels) {
      const clicked = await p.evaluate((l) => {
        const btn = [].slice.call(document.querySelectorAll('#view button, #view .btn')).find((x) => (x.textContent || '').trim() === l);
        if (!btn) return false; btn.focus(); btn.click(); return true; }, label);
      if (!clicked) continue;
      await p.waitForTimeout(900);
      const ov = await overlayNow();
      if (ov && ov.id && ov.controls > 0) {
        const f = await focusIn(ov.id);
        let outside = 0;
        for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(70);
          const w = await focusIn(ov.id); if (!w.inside) outside++; }
        seen.push({ page: pg, button: label, box: ov.id, controls: ov.controls, focusInside: f.inside, focusOn: f.el, tabsOutside: outside });
      }
      await p.keyboard.press('Escape'); await p.waitForTimeout(400);
      await p.evaluate((l) => { const btn = [].slice.call(document.querySelectorAll('#nav button')).find((x) => (x.textContent || '').trim() === l); if (btn) btn.click(); }, pg);
      await p.waitForTimeout(500);
    }
  }
  await ctx.close();
  return seen;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
const all = en.concat(ar);
const bad = all.filter((x) => !x.focusInside || x.tabsOutside > 0);
all.forEach((x) => console.log('  ' + (x.focusInside && x.tabsOutside === 0 ? 'ok   ' : 'LOSES') + ' ' + x.page + ' → "' + x.button + '" → ' + x.box
  + ' (' + x.controls + ' controls) focus ' + (x.focusInside ? 'inside' : 'OUTSIDE on ' + x.focusOn) + ', tabs outside ' + x.tabsOutside + '/6'));

const checks = [
  ['the crawl really opened boxes of a layer’s own — otherwise this passes by finding nothing',
    all.length >= 2, all.length + ' box(es): ' + JSON.stringify([...new Set(all.map((x) => x.box))])],
  ['every one of them takes the keyboard when it opens',
    all.every((x) => x.focusInside), JSON.stringify(bad.filter((x) => !x.focusInside).map((x) => x.box + ' from "' + x.button + '" (focus on ' + x.focusOn + ')'))],
  ['and keeps it — six tabs, none landing on the page behind',
    all.every((x) => x.tabsOutside === 0), JSON.stringify(bad.filter((x) => x.tabsOutside > 0).map((x) => x.box + ': ' + x.tabsOutside + '/6 outside'))],
  ['no JS errors', errors.length === 0, errors.slice(0, 3).join(' | ')],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
process.exit(fail ? 1 : 0);
