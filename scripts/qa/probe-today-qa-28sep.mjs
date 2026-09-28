/* probe-today-qa-28sep.mjs (2026-09-28) — QA defects on Today, live 12:30 UTC (made-up data, the stand-in).
     1. an address the app does not have (/team) opens Today and says so in the app's box: "Page not found (/team) — taken
        to Today"; the same in Arabic;
     2. a real page address (/tasks) and the root say nothing;
     3. the hero sentence agrees with its number: "1 item needs", "N items need" — never "1 items";
     4. no JS error, no native dialog.
   (The dashes while records are not loaded: probe-not-loaded-is-not-your-data.)
   Sabotage (run 28 Sep): remove `notFound(boot);` from js/03 restoreBoot → 1 goes red.
   PORT 9765. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0;
const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
process.env.MOCK_ROLE = 'admin';
const { start } = await import('./mock-supabase.mjs'); const srv = start(9765); const BASE = 'http://localhost:9765';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [], natives = [];
async function visit(path, lang) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => { natives.push(d.message()); d.dismiss(); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } window.__notes = []; document.addEventListener('v63-notice', (e) => window.__notes.push(e.detail.text)); }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const bd = Buffer.from(await resp.arrayBuffer()); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); }
    catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__roleKnown === true && typeof current !== 'undefined', null, { timeout: 150000 });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(() => ({ page: current, notes: window.__notes.slice(), hero: ((document.querySelector('.hero p') || {}).innerText || '') }));
  await ctx.close(); return out;
}
const t = await visit('/team', 'en');
check(t.page === 'today' && t.notes.some((x) => /Page not found \(\/team\) — taken to Today/.test(x)), '1. /team opens Today and says "Page not found (/team) — taken to Today"', JSON.stringify(t));
const ta = await visit('/people', 'ar');
check(ta.notes.some((x) => /الصفحة غير موجودة \(\/people\)/.test(x)), '1b. the same in Arabic', JSON.stringify(ta.notes));
const k = await visit('/tasks', 'en'); const r0 = await visit('/', 'en');
check(!k.notes.some((x) => /not found/i.test(x)) && !r0.notes.some((x) => /not found/i.test(x)), '2. a real page (/tasks) and the root say nothing', JSON.stringify({ tasks: k.notes, root: r0.notes }));
const m = String(r0.hero).match(/^(\d+) (item needs|items need) your attention/);
check(!/\b1 items\b/.test(r0.hero) && (!m || (m[1] === '1') === (m[2] === 'item needs')), '3. the hero sentence agrees with its number', r0.hero);
check(!errors.length && !natives.length, '4. no JS error, no native dialog', JSON.stringify({ errors, natives }));
await b.close(); try { srv.close(); } catch (_) { }
console.log(failures ? '\nFAILED — ' + failures + ' check(s)' : '\nPASS — Today says when an address is unknown, and its counts read as English');
process.exit(failures ? 1 : 0);
