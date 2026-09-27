/* probe-the-built-site-runs-the-same.mjs (2026-09-27, speed finding B) — what Vercel serves is the app with its 108
   scripts written INTO the page (scripts/build/build-site.mjs, run at deploy: vercel.json buildCommand). Every other probe
   runs the files one by one, as index.html lists them; this one proves the built page is the same app.

   Under test, the built page against the unbuilt one, both on the same stand-in database, English and Arabic:
     1. the build succeeds and every /js/ line became an inline script (none left, none extra);
     2. the built page asks the server for NO script file at all (the unbuilt one asks for 108);
     3. both end up with exactly the same set of app functions on the page (window.*) — no layer lost, none doubled;
     4. every page in the menu (and Tasks, People & teams, Activity, Archive) opens on the built page with something
        drawn and no JS error;
     5. the built page runs right to left in Arabic;
     6. a build that would break is refused: a file that does not compile stops the build (exit 1), and so does a file
        holding both "<!--" and "<script" (sabotage, on a copy of the repository).
   PORTS 9671-9674 (free when written). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import { execFileSync } from 'child_process';
import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
let failures = 0; const check = (c, m, d) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m + (d ? ' — ' + d : '')); } };

/* 1 — build */
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'built-site-'));
let buildOut = '';
try { buildOut = execFileSync('node', [path.join(ROOT, 'scripts/build/build-site.mjs'), OUT], { encoding: 'utf8' }); } catch (e) { buildOut = 'FAILED ' + (e.stderr || e.message); }
const html = fs.existsSync(path.join(OUT, 'index.html')) ? fs.readFileSync(path.join(OUT, 'index.html'), 'utf8') : '';
const srcLines = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/<script src="\/js\/[^"]+\.js"><\/script>/g) || []).length;
const inlined = (html.match(/<script data-src="\/js\//g) || []).length;
check(/inlined/.test(buildOut) && inlined === srcLines && !/<script src="\/js\//.test(html), `the build writes every one of index.html's ${srcLines} script files into the page (${inlined} inline, none left as a separate file)`, buildOut.trim());

/* serve the built page on its own port; the stand-in database answers both */
const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const dist = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(OUT, u);
  if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(OUT, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(9672);
const mock = start(9671); const API = 'http://localhost:9671';

async function run(site, lang) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
  const errors = [], jsReqs = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  p.on('request', (r) => { if (/\/js\/.*\.js(\?|$)/.test(r.url()) && r.url().startsWith(site)) jsReqs.push(r.url()); });
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => { const rq = r.request(); const u = new URL(rq.url());
    try { const resp = await fetch(API + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; }); await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); } });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => /fonts\.googleapis|fonts\.gstatic|clearbit|assets\.directksa/.test(u.href), (r) => r.abort());
  await p.goto(site + '/today', { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForSelector('#cl_email', { timeout: 120000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => window.__pageLevels && typeof render === 'function' && window.__roleKnown === true && (DB.businesses || []).length > 0, null, { timeout: 180000 });
  await p.waitForTimeout(3000);
  const fns = await p.evaluate(() => { const blank = new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(window)).concat(['onerror'])); return Object.getOwnPropertyNames(window).filter((k) => { try { return typeof window[k] === 'function' && !blank.has(k) && !/^(webkit|on)/.test(k); } catch (_) { return false; } }).sort(); });
  const pages = await p.evaluate(() => { const ids = (typeof VIEWS !== 'undefined' ? VIEWS : []).map((v) => v.id); ['tasks', 'people', 'activity', 'archive'].forEach((x) => { if (!ids.includes(x)) ids.push(x); }); return ids; });
  const bad = [];
  for (const id of pages) {
    const e0 = errors.length;
    await p.evaluate((pid) => { try { openLead = null; current = pid; render(); } catch (e) { } }, id); await p.waitForTimeout(700);
    const len = await p.evaluate(() => { const v = document.getElementById('view'); return v ? v.innerText.trim().length : 0; });
    if (len < 20 || errors.length > e0) bad.push(id + (len < 20 ? ' blank' : '') + (errors.length > e0 ? ' JS:' + errors.slice(e0).join('|').slice(0, 80) : ''));
  }
  const dir = await p.evaluate(() => document.documentElement.dir || getComputedStyle(document.body).direction);
  await b.close();
  return { fns, pages, bad, errors, jsReqs: jsReqs.length, dir };
}

const plain = await run('http://localhost:9671', 'en');
const builtEn = await run('http://localhost:9672', 'en');
const builtAr = await run('http://localhost:9672', 'ar');
check(builtEn.jsReqs === 0 && plain.jsReqs >= srcLines, `the built page asks the server for no script file (the file-by-file page asks for ${plain.jsReqs})`, 'built asked for ' + builtEn.jsReqs);
const onlyPlain = plain.fns.filter((f) => !builtEn.fns.includes(f)), onlyBuilt = builtEn.fns.filter((f) => !plain.fns.includes(f));
check(plain.fns.length > 200 && !onlyPlain.length && !onlyBuilt.length, `both pages end up with the same ${plain.fns.length} app functions — no layer lost, none added`, 'only file-by-file: ' + onlyPlain.slice(0, 8).join(',') + ' · only built: ' + onlyBuilt.slice(0, 8).join(','));
check(!builtEn.bad.length, `EN: all ${builtEn.pages.length} pages open on the built page, with something drawn and no JS error`, builtEn.bad.join(' ; '));
check(!builtAr.bad.length && builtAr.dir === 'rtl', `AR: all ${builtAr.pages.length} pages open on the built page, right to left`, builtAr.bad.join(' ; ') + ' dir=' + builtAr.dir);
check(!plain.errors.length && !builtEn.errors.length && !builtAr.errors.length, 'no JS errors on either page', [...plain.errors, ...builtEn.errors, ...builtAr.errors].slice(0, 3).join(' | '));

/* 6 — sabotage on a copy: a broken file, and the one dangerous combination, each stop the build */
const COPY = fs.mkdtempSync(path.join(os.tmpdir(), 'built-site-src-'));
for (const d of ['index.html', 'js', 'css', 'brand', 'scripts/build']) { const s = path.join(ROOT, d), t = path.join(COPY, d); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.cpSync(s, t, { recursive: true }); }
const victim = path.join(COPY, 'js/115-change-log.js'); const keep = fs.readFileSync(victim, 'utf8');
const refused = (why) => { try { execFileSync('node', [path.join(COPY, 'scripts/build/build-site.mjs'), path.join(COPY, 'out')], { encoding: 'utf8', stdio: 'pipe' }); return 'BUILT'; } catch (e) { return String(e.stderr || '').trim(); } };
fs.writeFileSync(victim, keep + '\nfunction ( {'); const r1 = refused();
fs.writeFileSync(victim, keep + "\nvar __x='<!--', __y='<script>';"); const r2 = refused();
check(/does not compile/.test(r1) && /<!--/.test(r2), 'a build that would break is refused: a file that does not compile, and a file holding "<!--" with "<script"', r1.slice(0, 80) + ' / ' + r2.slice(0, 80));
fs.rmSync(COPY, { recursive: true, force: true }); fs.rmSync(OUT, { recursive: true, force: true });

dist.close(); try { mock.close(); } catch (_) { }
console.log(failures ? `FAIL — ${failures} check(s)` : 'PASS — the built page is the same app, in one request');
process.exit(failures ? 1 : 0);
