/* probe-client-table-sorts-by-what-you-see.mjs — guards the 2026-09-19 (fire #99) fixes in core-02.

   The Clients table has clickable column sorts, and nothing had ever driven them. Two defects, both
   measured on the real 28 clients.

   HEALTH — the rank map read {"At risk":0, Watch:1, New:2, Good:3}, and clientHealth() has also
   returned 'Lost' since 2026-09-09. An unknown label gives undefined, and undefined compares equal
   to everything, so the one Lost client landed in the MIDDLE of the Watch block: the live order was
   At risk ×4, Watch ×3, Lost, Watch ×2, New… A health was split in two, under a column whose own
   tooltip promises "click to surface at-risk clients". Lost now ranks last — it is the one reading
   that needs no chasing — and a label the map has never heard of sorts after everything rather than
   nowhere.

   NAME — the rows show the Arabic name when there is one (js/54's nmMain), but the sort key was
   always b.name, the stored English one. In Arabic the list read Abdel Hadi… / Al Sharq… /
   مؤسسة العرض… / نادي الجندل… / alnahla… — Arabic names sitting in the middle of a Latin run,
   ordered by something the reader cannot see. It sorts by the name on the row now, with
   localeCompare in the language being read.

   The harness seed has no Lost client, so this probe makes one: without it the health check would
   pass on a list that never contained the case it is about.

   Sabotage-tested: with the core-02 edit reverted, 5 checks go FAIL, exit 1 — the health order comes
   back as Watch, New, Lost, New, Lost, Watch, New, and the Arabic names are no longer in Arabic
   order. The English name check fails there too, because the old comparator also ordered
   "company 12" before "company 4"; the new one counts numbers as numbers.
   Run: node scripts/qa/probe-client-table-sorts-by-what-you-see.mjs                                */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9076; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
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
  await p.goto(BASE + '/clients', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof clientHealth === 'function' && (DB.businesses || []).filter((x) => x.isClient).length > 3, { timeout: 90000 });
  await p.waitForTimeout(2500);

  /* the case the health defect is ABOUT. The harness seed has no Lost client and no Arabic client
     name, so both are made here — a check that never meets its own case is not a check. Local to
     this page only: every write is refused at the network edge and none is attempted. */
  const seeded = await p.evaluate(() => {
    const cls = (DB.businesses || []).filter((x) => x.isClient);
    if (cls.length < 4) return null;
    cls[0].stage = 'lost'; cls[0].status = 'Lost';
    cls[1].nameAr = 'ياسمين للسفر';            /* sorts LAST in Arabic, first-ish by its English name */
    cls[2].nameAr = 'أبجد للرحلات';            /* sorts FIRST in Arabic */
    current = 'clients'; render();
    return { lost: cls[0].id, arLast: cls[1].id, arFirst: cls[2].id };
  });
  await p.waitForTimeout(2200);

  const sortBy = async (k) => { await p.evaluate((kk) => { try { window.clSort = { k: '__none__', dir: 1 }; clSortBy(kk); } catch (_) { } }, k); await p.waitForTimeout(2000); };
  await sortBy('health');
  const health = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view tbody tr'))
    .map((r) => ({ n: ((r.cells[0] && r.cells[0].innerText) || '').split('\n')[0].trim(), h: r.getAttribute('data-health') })).filter((x) => x.n));
  await sortBy('name');
  const names = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view tbody tr'))
    .map((r) => ((r.cells[0] && r.cells[0].innerText) || '').split('\n')[0].trim()).filter(Boolean));
  await ctx.close();
  return { seeded, health, names };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const groupsOf = (seq) => { const g = []; seq.forEach((h) => { if (!g.length || g[g.length - 1] !== h) g.push(h); }); return g; };
const enG = groupsOf(en.health.map((x) => x.h));
const arG = groupsOf(ar.health.map((x) => x.h));
console.log('  EN health order :', JSON.stringify(enG));
console.log('  AR health order :', JSON.stringify(arG));
console.log('  AR names, first 4:', JSON.stringify(ar.names.slice(0, 4)));
console.log('  AR names, last   :', JSON.stringify(ar.names.slice(-1)));

const ARABIC = /[؀-ۿ]/;
const properAr = ar.names.slice().sort((x, y) => x.localeCompare(y, 'ar', { sensitivity: 'base', numeric: true }));
const properEn = en.names.slice().sort((x, y) => x.localeCompare(y, 'en', { sensitivity: 'base', numeric: true }));
const checks = [
  ['the clients table was really found and sorted in both languages, so nothing below passes by absence',
    en.health.length > 3 && ar.health.length > 3 && en.names.length > 3 && ar.names.length > 3],
  ['the Lost case the health defect is about really exists in this run', !!(en.seeded && en.seeded.lost) && en.health.some((x) => x.h === 'Lost')],
  ['sorting by health keeps each health together — no label split across the list (EN)', enG.length === new Set(enG).size],
  ['and in Arabic too', arG.length === new Set(arG).size],
  ['Lost sorts last: it is the one reading nobody needs to chase', enG[enG.length - 1] === 'Lost' && arG[arG.length - 1] === 'Lost'],
  ['Arabic names really are on screen, so the name check has something to order', ar.names.some((n) => ARABIC.test(n))],
  ['sorting by name in Arabic gives Arabic alphabetical order of the names actually shown',
    JSON.stringify(ar.names) === JSON.stringify(properAr)],
  ['and English is unchanged — still alphabetical by what is on the row', JSON.stringify(en.names) === JSON.stringify(properEn)],
  ['sorting wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ enG, arG, arNames: ar.names, properAr }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
