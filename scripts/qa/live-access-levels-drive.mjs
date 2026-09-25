/* live-access-levels-drive.mjs (2026-09-25, Phase 1a) — drives the WORKING-COPY app against the
   LIVE database, signed in as the QA account, and checks the four access levels on screen as the
   database answers them. Run it three times, once per role the QA row holds:

     LIVE_AS=admin        node scripts/qa/live-access-levels-drive.mjs
     LIVE_AS=manager      node scripts/qa/live-access-levels-drive.mjs
     LIVE_AS=team_member  node scripts/qa/live-access-levels-drive.mjs

   The QA row's role is switched OUTSIDE this script (an owner-side SQL update to the QA account
   only — never anyone else's row) and put back afterwards; the script refuses to run if the role it
   finds is not the one it was told. No person's password is used.

   Writes nothing: every table write, save_state/save_state_patch and log_page_denied is answered
   at the route and never reaches the database. set_page_levels is let through ONLY when its target
   is an admin — which the database refuses on its first check — so the manager's refusal is the
   real one and no grid can change.

   Screenshots go to $SHOTS (default /tmp/live-1a); they show real names, so they stay out of git. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';

const AS = process.env.LIVE_AS || 'admin';
const SHOTS = process.env.SHOTS || '/tmp/live-1a';
fs.mkdirSync(SHOTS, { recursive: true });
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const REAL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ROOT = process.env.APP_DIR || process.cwd();
const PORT = 9281; const BASE = 'http://localhost:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(String(req.url).split('?')[0]);
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
}).listen(PORT);

let adminIds = [];
const blocked = [];
let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy: { server: 'direct://' }, args: ['--no-proxy-server'] });

async function session(width, lang) {
  const ctx = await b.newContext({ viewport: { width, height: 1000 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
  const early = [];   // mayEditPage('finance') as sampled while the levels were still in flight
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (/\/rpc\/set_page_levels$/.test(u.pathname)) {
      let t = null; try { t = JSON.parse(rq.postData() || '{}').target; } catch (_) {}
      if (!adminIds.includes(t)) { blocked.push('set_page_levels→non-admin'); await r.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"QA000","message":"blocked by the live drive"}' }); return; }
    } else if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') &&
               (!isRpc || /save_state|log_page_denied/.test(u.pathname))) {
      blocked.push(m + ' ' + u.pathname.replace('/rest/v1/', ''));
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return;
    }
    try {
      const resp = await fetch(REAL + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  for (let i = 0; i < 200; i++) {
    const s = await p.evaluate(() => ({ k: window.__roleKnown === true, lv: !!window.__pageLevels,
      may: (typeof window.mayEditPage === 'function') ? window.mayEditPage('finance') : 'none', r: window.__userRole }));
    if (s.k && !s.lv) early.push(s);
    if (s.lv) break;
    await p.waitForTimeout(50);
  }
  await p.waitForFunction(() => window.__pageAccessLoaded === true && typeof render === 'function', { timeout: 120000 });
  if (lang === 'ar') await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); render(); } catch (_) {} });
  await p.waitForTimeout(3000);
  return { p, ctx, errs, early };
}

console.log('live access-levels drive as ' + AS);
const { p, ctx, errs, early } = await session(1500, 'en');
const me = await p.evaluate(() => ({ role: window.__userRole, levels: window.__pageLevels }));
if (me.role !== AS) { console.log('  ✗ the QA row is "' + me.role + '", not "' + AS + '" — switch it first; nothing checked'); process.exit(2); }
const L = me.levels || {};
(Object.keys(L).length === 20) ? ok('the screen holds the database\'s answer for all 20 pages') : bad('levels for ' + Object.keys(L).length + ' pages');

const sidebar = async (pg) => pg.evaluate(() => [].slice.call(document.querySelectorAll('#nav button[data-view]'))
  .filter((x) => x.style.display !== 'none' && x.offsetParent !== null).map((x) => x.getAttribute('data-view')));

if (AS === 'admin') {
  Object.values(L).every((v) => v === 'full') ? ok('admin: full on every page') : bad('admin levels ' + JSON.stringify(L));
} else {
  const nonAdminEarly = early.filter((s) => s.r && s.r !== 'admin');
  (nonAdminEarly.length === 0 || nonAdminEarly.every((s) => s.may === false))
    ? ok('while the levels were in flight, "may edit Finance?" answered no (' + nonAdminEarly.length + ' samples) — fails closed')
    : bad('in flight, mayEditPage said ' + JSON.stringify(nonAdminEarly.slice(0, 3)));
}

const nav = await sidebar(p);
const expectOpen = Object.keys(L).filter((k) => L[k] !== 'none');
const extra = nav.filter((v) => v !== 'today' && !expectOpen.includes(v) && !/^\?/.test(v));
extra.length === 0 ? ok('the sidebar offers no page the database closes (' + nav.length + ' buttons)') : bad('sidebar offers closed pages: ' + extra.join(', '));

if (AS === 'team_member') {
  await p.evaluate(() => { current = 'settings'; render(); }); await p.waitForTimeout(2500);
  const cur = await p.evaluate(() => current);
  cur === 'today' ? ok('an employee sent to Settings by address is moved back to Today') : bad('employee stayed on ' + cur);
  const acc = await p.evaluate(() => !!document.getElementById('v41acc'));
  !acc ? ok('an employee has no "Access" button') : bad('an employee sees the Access button');
  const list = await p.evaluate(async () => { const r = await fc().rpc('team_access_list'); return r.error ? 'error:' + r.error.message : (r.data || []).length; });
  list === 0 ? ok('an employee reading the team\'s access list gets nobody') : bad('employee team_access_list → ' + list);
}

if (AS === 'admin' || AS === 'manager') {
  adminIds = await p.evaluate(async () => { const r = await fc().rpc('team_access_list'); return (r.data || []).filter((x) => x.role === 'admin').map((x) => x.id); });
  await p.evaluate(() => { current = 'settings'; render(); });
  let cards = 0; for (let i = 0; i < 40 && !cards; i++) { await p.waitForTimeout(500); cards = await p.evaluate(() => document.querySelectorAll('#axHost .ax-card').length); }
  cards > 0 ? ok(AS + ': Team & Access lists ' + cards + ' people') : bad(AS + ': the access editor did not paint');
  const shape = await p.evaluate(() => {
    const cs = [].slice.call(document.querySelectorAll('#axHost .ax-card'));
    const withSel = cs.filter((c) => c.querySelector('select[data-ax-page]'));
    const first = withSel[0];
    const sels = first ? [].slice.call(first.querySelectorAll('select[data-ax-page]')) : [];
    return { editable: withSel.length, self: cs.filter((c) => c.querySelector('[data-ax-self]')).length,
      pages: sels.length, words: sels[0] ? [].slice.call(sels[0].options).map((o) => o.textContent) : [],
      ownOpen: sels.some((s) => [].slice.call(s.options).some((o) => o.value === 'own' && !o.disabled && !o.selected)),
      disabledAbove: sels.filter((s) => [].slice.call(s.options).some((o) => o.value === 'full' && o.disabled)).map((s) => s.getAttribute('data-ax-page')) };
  });
  shape.pages === 20 && shape.words.join('|') === 'No access|View|Own work|Full control'
    ? ok('each editable person shows 20 pages in the four words') : bad('editor shape ' + JSON.stringify(shape));
  !shape.ownOpen ? ok('"Own work" cannot be chosen on any page yet') : bad('Own work is choosable');
  if (AS === 'manager') {
    shape.self === 1 ? ok('the manager\'s own card is locked, with the reason in words') : bad('self cards ' + shape.self);
    shape.disabledAbove.length > 0 ? ok('pages above the manager\'s own level cannot be granted: ' + shape.disabledAbove.join(', ')) : bad('no page is capped for the manager');
    const refusal = await p.evaluate(async (ids) => { const r = await fc().rpc('set_page_levels', { target: ids[0], levels: { finance: 'view' } }); return r.error ? r.error.message : 'ACCEPTED'; }, adminIds);
    /change their level first|cannot|Only an admin/i.test(refusal) ? ok('the database itself refuses the manager changing an admin: "' + refusal + '"') : bad('manager → admin: ' + refusal);
  }
  await p.locator('#axHost').screenshot({ path: SHOTS + '/' + AS + '-access-en.png' });
}
await p.screenshot({ path: SHOTS + '/' + AS + '-today-en.png' });
await ctx.close();

/* Arabic, and a phone */
const ar = await session(400, 'ar');
if (AS !== 'team_member') {
  await ar.p.evaluate(() => { current = 'settings'; render(); }); await ar.p.waitForTimeout(4000);
  const words = await ar.p.evaluate(() => { const s = document.querySelector('#axHost select[data-ax-page]'); return s ? [].slice.call(s.options).map((o) => o.textContent) : []; });
  words.join('|') === 'لا وصول|مشاهدة|عمله فقط|تحكم كامل' ? ok('in Arabic the four levels read in Arabic') : bad('Arabic words ' + JSON.stringify(words));
  const wide = await ar.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  wide <= 1 ? ok('on a phone the editor does not scroll sideways') : bad('phone overflow ' + wide + 'px');
  await ar.p.locator('#axHost').screenshot({ path: SHOTS + '/' + AS + '-access-ar-phone.png' });
} else {
  const nav2 = await sidebar(ar.p);
  ok('Arabic phone sidebar holds ' + nav2.length + ' buttons');
  await ar.p.screenshot({ path: SHOTS + '/' + AS + '-today-ar-phone.png' });
}
await ar.ctx.close();

const allErr = errs.concat(ar.errs);
allErr.length === 0 ? ok('no JS errors') : bad('JS errors: ' + allErr.slice(0, 2).join(' | '));
console.log('  · writes held back at the route: ' + (blocked.length ? [...new Set(blocked)].join(', ') : 'none attempted'));
await b.close(); srv.close();
console.log(failures ? 'FAILED — ' + failures : 'live-access-levels OK as ' + AS);
process.exit(failures ? 1 : 0);
