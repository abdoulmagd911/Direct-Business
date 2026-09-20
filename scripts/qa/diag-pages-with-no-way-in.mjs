/* diag-pages-with-no-way-in.mjs (2026-09-21) — REPORT, asserts nothing. Drives the LIVE database.

   "This is how the finance ledger sat live-but-unreachable for two days" — CLAUDE.md. The app
   routes by address (js/03 keeps a list of valid ones) but builds its sidebar from a DIFFERENT
   list (`VIEWS`, core-01). Nothing keeps the two in step, so a page can render perfectly and be
   missing from the sidebar entirely.

   That is not hypothetical here: four real companies are archived in the live database, and the
   Archive page — the only screen that can bring one back (js/76, fire from 2026-09-09) — is not in
   `VIEWS`. (It is linked from the Settings page; see the warning below before calling anything
   unreachable.)

   This asks, signed in as an admin (who may open everything, so nothing is hidden by permission):
   for every routable address, does it draw real content, and does the SIDEBAR offer it?

   *** READ THIS BEFORE QUOTING THIS REPORT. ***
   The "sidebar?" column is about the sidebar and top bar ONLY. It says nothing about links that
   live INSIDE a page, and this app keeps an admin index on the Settings page which links to
   several of them. On 2026-09-21 this report was read as proof that Activity & Audit and Archive
   "had no button anywhere"; they are in fact linked from Settings -> "Admin & history", with
   working buttons, and the claim had to be retracted (DECISIONS M31). A "no" here means
   "not offered by the sidebar" and nothing more. To claim a page is genuinely unreachable you must
   search every visible control on every page, which this report does not do.

   Writes nothing: every table write and save_state call is blocked at the route.
   Run:  node scripts/qa/diag-pages-with-no-way-in.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const REAL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ROOT = process.env.APP_DIR || process.cwd();
const PORT = 9121; const BASE = 'http://localhost:' + PORT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(String(req.url).split('?')[0]);
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
}).listen(PORT);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy: { server: 'direct://' }, args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());

await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(REAL + u.pathname + u.search, { method: m, headers: rq.headers(),
      body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
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
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && DB.businesses && DB.businesses.length > 0, { timeout: 120000 });
await p.waitForTimeout(6000);

/* every route the address bar accepts, and every button anywhere on the chrome that opens one */
const survey = await p.evaluate(() => {
  const vis = (el) => { try { return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'); } catch (_) { return false; } };
  const views = (typeof VIEWS !== 'undefined' ? VIEWS : []).map((v) => v.id);
  /* anything clickable OUTSIDE the page body — the sidebar, the top bar, any nav rail */
  const view = document.getElementById('view');
  const clickable = [].slice.call(document.querySelectorAll('button,a,[onclick],[data-view],[data-nav]'))
    .filter((el) => !(view && view.contains(el))).filter(vis);
  const reach = new Set();
  clickable.forEach((el) => {
    const bag = [el.getAttribute('data-view'), el.getAttribute('data-nav'), el.getAttribute('onclick'),
      el.getAttribute('href'), el.className, el.id].filter(Boolean).join(' ');
    (bag.match(/[a-z]{3,12}/g) || []).forEach((w) => reach.add(w));
    (bag.match(/go\(['"]([a-z]+)['"]\)/g) || []).forEach((w) => reach.add(w));
  });
  return { views: views, reachWords: [].slice.call(reach), navLabels: clickable.map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 30) };
});

const ROUTES = ['today', 'dashboard', 'leads', 'clients', 'airlines', 'vendors', 'providers', 'sops', 'slas',
  'sopsla', 'reports', 'ops', 'operations', 'offers', 'activity', 'archive', 'bookings', 'invoices',
  'tickets', 'finance', 'settings', 'events', 'sync', 'projects', 'documents'];

const out = [];
for (const r of ROUTES) {
  const res = await p.evaluate(async (route) => {
    try { current = route; openLead = null; render(); } catch (_) { }
    await new Promise((s) => setTimeout(s, 1700));
    const v = document.getElementById('view');
    const txt = (v.innerText || '').replace(/\s+/g, ' ').trim();
    /* did the app stay where it was sent, or bounce somewhere else? */
    return { landedOn: (typeof current !== 'undefined' ? current : '?'), len: txt.length,
      cards: v.querySelectorAll('.card').length, rows: v.querySelectorAll('tbody tr').length,
      head: txt.slice(0, 60) };
  }, r);
  /* is there a visible button anywhere on the chrome that names this route? */
  const clickable = await p.evaluate((route) => {
    const vis = (el) => { try { return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); } catch (_) { return false; } };
    const view = document.getElementById('view');
    return [].slice.call(document.querySelectorAll('button,a,[onclick],[data-view],[data-nav]'))
      .filter((el) => !(view && view.contains(el))).filter(vis)
      .some((el) => {
        const bag = [el.getAttribute('data-view'), el.getAttribute('data-nav'), el.getAttribute('onclick'),
          el.getAttribute('href'), el.id].filter(Boolean).join(' ');
        return new RegExp('(^|[^a-z])' + route + '([^a-z]|$)').test(bag);
      });
  }, r);
  out.push({ route: r, ...res, button: clickable });
}
await b.close(); srv.close();

console.log('--- every routable address, signed in as an admin (who may open everything) ---');
console.log('VIEWS (the sidebar is built from this): ' + survey.views.join(', '));
console.log('');
console.log('route        | landed on    | sidebar?| cards | rows | length');
for (const o of out) {
  console.log('  ' + o.route.padEnd(11) + '| ' + String(o.landedOn).padEnd(13) + '| '
    + (o.button ? 'yes' : 'NO ').padEnd(8) + '| ' + String(o.cards).padEnd(6) + '| ' + String(o.rows).padEnd(5) + '| ' + o.len);
}
const orphans = out.filter((o) => !o.button && o.landedOn === o.route && o.len > 120);
console.log('');
console.log('DRAW REAL CONTENT AND ARE NOT OFFERED BY THE SIDEBAR (they may still be linked from inside a page — check Settings before calling one unreachable): ' + (orphans.length ? orphans.map((o) => o.route).join(', ') : 'none'));
console.log('JS errors: ' + errs.length + (errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''));
