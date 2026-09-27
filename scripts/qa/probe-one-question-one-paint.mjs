/* probe-one-question-one-paint.mjs (2026-09-27, speed finding B) — the two changes that make a page load lighter and
   stop it jumping: js/01 lets an identical read share one answer ("one question, one answer"); js/116 runs a redraw's
   short follow-up timers before the browser paints ("one paint per redraw"). Driven on the stand-in as the QA admin.

   Under test:
     ONE QUESTION, ONE ANSWER (js/01)
       1. while Today loads, no read goes to the database twice within the sharing window — the layers that ask the same
          question get one answer (and the page says how many it shared);
       2. a write forgets every shared answer: the same read asked right after a write goes to the database again;
       3. a failed answer is not shared: asked again, the question goes out again;
     ONE PAINT PER REDRAW (js/116)
       4. the short timers a redraw sets have run by the next frame — before the browser paints — in the order and spacing they asked for (0 ms, then
          one it set for 10 ms later, then 60, then 150); a cancelled one does not run; a long one (1 s) stays a real
          timer and runs once, later; none runs twice;
       5. an error in one of them still reaches the page as an error, and the ones after it still run;
       6. Today loading: the page's layout-shift score stays under 0.25 (it measured about 1.0 live before this change; what
          is left, 0.07-0.17 here, is the top bar and the menu settling in the first second after sign-in);
     7. no JS errors other than the one thrown on purpose in 5.
   PORT 9673. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
let failures = 0; const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };
const PORT = 9673, BASE = 'http://localhost:' + PORT; const srv = start(PORT);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
const reads = [], writes = [];
p.on('request', (r) => { const u = r.url(); if (!u.includes('vkxoeeoauexyfpzqufqd.supabase.co/')) return;
  if (u.includes('/rest/v1/') && r.method() === 'GET') reads.push({ u: u.split('/rest/v1/')[1], t: Date.now() });
  else if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !u.includes('/auth/v1/')) writes.push(Date.now()); });
await p.context().addInitScript(() => { window.__cls = 0; window.__src = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) { window.__cls += e.value; window.__src.push(Math.round(e.startTime) + ' ' + e.value.toFixed(3) + ' ' + (e.sources || []).map((x) => { const n = x.node; return n ? ((n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '') + '<' + n.nodeName + '>') : '?'; }).join(' | ')); } })).observe({ type: 'layout-shift', buffered: true }); } catch (_) { } });
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
  if (u.pathname === '/rest/v1/funnels' && u.search.includes('fail_me')) return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' });
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && window.__roleKnown === true && (DB.businesses || []).length > 0, null, { timeout: 180000 });
await p.waitForTimeout(6000);

/* 1 */
const byUrl = {}; reads.forEach((r) => (byUrl[r.u] = byUrl[r.u] || []).push(r.t));
/* a write in between rightly forgets the shared answer — only a repeat with no write between counts */
const twice = Object.entries(byUrl).filter(([u, ts]) => ts.some((t, i) => i && t - ts[i - 1] < 2000 && !writes.some((w) => w >= ts[i - 1] && w <= t))).map(([u, ts]) => ts.length + '× ' + u.slice(0, 60));
const hits = await p.evaluate(() => window.__sharedReads ? window.__sharedReads.hits : -1);
check(!twice.length && hits > 0, `1 · while Today loads no read goes out twice within the sharing window (${reads.length} reads; ${hits} answered from a shared reply)`, twice.join(' ; '));

/* 2 + 3 */
const r23 = await p.evaluate(async () => {
  const c = fc(); const n0 = performance.getEntriesByType('resource').length;
  const q = () => c.from('periods').select('id').eq('kind', 'month').limit(1);
  await q(); await q();
  await c.from('app_settings').update({ updated_by: 'probe' }).eq('id', 'probe-none');
  await q();
  const f1 = await c.from('funnels').select('id').eq('key', 'fail_me'); const f2 = await c.from('funnels').select('id').eq('key', 'fail_me');
  return { f1: !!f1.error, f2: !!f2.error };
});
await p.waitForTimeout(300);
const periodsReads = reads.filter((r) => /^periods\?select=id&kind=eq\.month&limit=1/.test(r.u)).length;
const failReads = reads.filter((r) => /^funnels\?select=id&key=eq\.fail_me/.test(r.u)).length;
check(periodsReads === 2, `2 · the same read twice goes out once, and again after a write (${periodsReads} of 3 went to the database)`, String(periodsReads));
check(r23.f1 && r23.f2 && failReads === 2, `3 · a failed answer is not shared — asked again, it goes out again (${failReads} of 2)`, JSON.stringify(r23));

/* 4 + 5 */
const t4 = await p.evaluate(async () => {
  const log = []; const r0 = window.render;
  window.render = function () {
    const o = r0.apply(this, arguments);
    setTimeout(() => log.push('A60'), 60);
    setTimeout(() => { log.push('B0'); setTimeout(() => log.push('D10'), 10); }, 0);
    setTimeout(() => log.push('C150'), 150);
    const x = setTimeout(() => log.push('CANCELLED'), 20); clearTimeout(x);
    setTimeout(() => log.push('LATE1000'), 1000);
    setTimeout(() => { throw new Error('probe-116 deliberate'); }, 30);
    setTimeout(() => log.push('E40'), 40);
    return o;
  };
  if (typeof window.__v116Wrap === "function") window.__v116Wrap();
  render();
  const atReturn = await new Promise((res) => requestAnimationFrame(() => res(log.slice())));   /* the next frame: before the browser paints */
  await new Promise((r) => setTimeout(r, 1300));
  window.render = r0;
  return { atReturn, after: log.slice() };
});
check(t4.atReturn.join(',') === 'B0,D10,E40,A60,C150', '4 · a redraw\'s short timers have all run by the next frame (before the browser paints), in their order and spacing; the cancelled one does not', t4.atReturn.join(','));
check(t4.after.join(',') === 'B0,D10,E40,A60,C150,LATE1000', '4 · a long timer stays a real one and runs once, later; none runs twice', t4.after.join(','));
check(errors.filter((e) => /probe-116 deliberate/.test(e)).length === 1 && t4.atReturn.includes('E40'), '5 · an error in one of them still reaches the page, and the ones after it still run', errors.join(' | '));

/* 6 — a fresh load of Today, measured from the start */
const p2 = await p.context().newPage(); const e2 = []; p2.on('pageerror', (e) => e2.push(e.message));
await p2.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
await p2.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p2.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
await p2.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 });
await p2.waitForFunction(() => typeof render === 'function' && !document.getElementById('cl_email') && (DB.businesses || []).length > 0, null, { timeout: 120000 }).catch(() => { });
await p2.waitForTimeout(6000);
const cls = await p2.evaluate(() => window.__cls); const clsSrc = await p2.evaluate(() => window.__src);
check(cls < 0.25, `6 · Today loading (signed in already): the layout-shift score stays under 0.25 — it was about 1.0 before; what is left is the top bar and menu settling at sign-in (${cls.toFixed(3)})`, cls.toFixed(3) + ' · ' + clsSrc.join(' ; '));
check(errors.filter((e) => !/probe-116 deliberate/.test(e)).length === 0 && e2.length === 0, '7 · no other JS errors', [...errors, ...e2].filter((e) => !/probe-116 deliberate/.test(e)).slice(0, 3).join(' | '));
await b.close(); srv.close();
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — one question, one answer; one paint per redraw');
process.exit(failures ? 1 : 0);
