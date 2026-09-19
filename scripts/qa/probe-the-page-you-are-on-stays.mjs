/* probe-the-page-you-are-on-stays.mjs — guards the 2026-09-19 (fire #106) fix in js/20 and js/04.

   WHAT WAS WRONG, found on the real database with 136 carriers on the Airlines page: pressing
   "Next ›" worked for about a second and then silently undid itself. Traced by watching the table
   rather than reading it once:

       before              page 1   "Showing 1–20 of 136"
       right after click   page 2   "Showing 21–40 of 136"
       ~800ms later        A NEW TABLE, page 1, "Showing 1–20 of 136"

   So pages 2 onward could not be reached at all. The only way to see carrier 21 was to change the
   page size.

   The cause was not the pager. js/20 looks up the signed-in person's name and role and then
   re-rendered the WHOLE page — and it runs on load, again at 3 seconds, again at 8 seconds, and
   every time the browser tab is brought back to the front. A full render rebuilds the list from
   scratch, so whatever the person was looking at went with it. The same re-render is what wiped the
   filter buttons in fire #105.

   Two fixes, and they are deliberately at different levels:
     · js/20 re-renders only when the name or role actually CHANGED. The lookup almost always
       returns what it returned before, and the footer is painted directly anyway, so the repeat
       renders were pure loss.
     · js/04 remembers which page each list was left on, for this page's lifetime, so a re-render
       that does have a reason does not put the person back at the top of a long list. Rebuilding
       the list itself still means page one — a changed list starts over, which is the fire #104
       rule about a counter never describing a list that has been replaced.

   Sabotage-tested 2026-09-19, each fix separately, both restored afterwards. Exactly 1 check flips
   each time, and that is the result rather than a weakness — with either fix removed the OTHER one
   still protects the reader, which is why both are here:
     · js/20's guard removed: the idle page redraws itself on its own (1 render while nobody is
       touching it) — but page 2 survives, because js/04 now remembers it.
     · js/04's page memory removed: idle is quiet, but a re-render that really is needed drops the
       reader back to page 1.
   Only with BOTH gone does the original defect return: press Next, and a second later you are back
   at the top of a 136-row list.
   Run: node scripts/qa/probe-the-page-you-are-on-stays.mjs                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9083; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); localStorage.setItem('db_pageSize', '20'); } catch (_) { } }, lang);
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
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });

  /* count every render from here on, so a page that redraws itself while nobody touches it shows up */
  await p.evaluate(() => { window.__renderCount = 0; const _r = window.render;
    window.render = function () { window.__renderCount++; return _r.apply(this, arguments); }; });
  await p.waitForTimeout(2500);

  /* a list long enough to have pages at all */
  await p.evaluate(() => {
    const out = [];
    for (let i = 1; i <= 44; i++) out.push({ id: 'qa_air_' + i, name: 'QA Carrier ' + String(i).padStart(2, '0'),
      code: 'Q' + i, country: 'Testland', type: 'FSC', ksa: 'Yes', alliance: 'Unaligned', stock: String(900 + i), contacts: [] });
    DB.airlines = out; current = 'airlines'; openSup = null; render();
  });
  await p.waitForTimeout(2500);

  const state = () => p.evaluate(() => {
    const v = document.getElementById('view');
    const rows = [].slice.call(v.querySelectorAll('tbody tr')).filter((r) => !r.querySelector('td[colspan]'))
      .filter((r) => { const cs = getComputedStyle(r); return cs.display !== 'none' && r.getBoundingClientRect().height > 0; });
    const m = (v.innerText || '').match(/(?:Showing|عرض)\s*(\d+)[–-](\d+)\s*(?:of|من)\s*(\d+)/);
    return { rows: rows.length, from: m ? Number(m[1]) : null, to: m ? Number(m[2]) : null, total: m ? Number(m[3]) : null,
      first: rows.length ? ((rows[0].innerText || '').match(/QA Carrier \d+/) || [null])[0] : null };
  });

  const page1 = await state();
  const renderedBefore = await p.evaluate(() => window.__renderCount);

  /* nobody is touching the app for the next few seconds — it must not redraw itself */
  await p.waitForTimeout(6500);
  const idleRenders = await p.evaluate(() => window.__renderCount) - renderedBefore;
  const afterIdle = await state();

  await p.evaluate(() => { const n = document.querySelector('#view .pg-next'); if (n) n.click(); });
  await p.waitForTimeout(1200);
  const page2 = await state();
  await p.waitForTimeout(3500);
  const page2Later = await state();

  /* a re-render that really is needed must not cost the reader their place */
  await p.evaluate(() => { render(); });
  await p.waitForTimeout(1800);
  const afterRender = await state();

  /* but changing the list itself does mean starting again */
  await p.evaluate(() => { const s = document.getElementById('sq'); if (s) { s.value = 'QA Carrier 4'; s.dispatchEvent(new Event('input', { bubbles: true })); } });
  await p.waitForTimeout(1600);
  const afterSearch = await state();

  await ctx.close();
  return { page1, idleRenders, afterIdle, page2, page2Later, afterRender, afterSearch };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
for (const [k, r] of [['EN', en], ['AR', ar]]) {
  console.log(`  ${k} page1 ${JSON.stringify(r.page1)}`);
  console.log(`     idle renders ${r.idleRenders} · after idle ${JSON.stringify(r.afterIdle)}`);
  console.log(`     page2 ${JSON.stringify(r.page2)} · 3.5s later ${JSON.stringify(r.page2Later)}`);
  console.log(`     after a real re-render ${JSON.stringify(r.afterRender)} · after searching ${JSON.stringify(r.afterSearch)}`);
}

const checks = [
  ['the list is long enough to have pages, in both languages',
    en.page1.total === 44 && en.page1.rows === 20 && ar.page1.total === 44],
  ['left alone, the page does not redraw itself — nothing is thrown away behind the reader\'s back',
    en.idleRenders === 0 && ar.idleRenders === 0, 'renders while idle: EN ' + en.idleRenders + ' · AR ' + ar.idleRenders],
  ['and it is still showing the same rows after that wait', en.afterIdle.from === 1 && en.afterIdle.first === en.page1.first],
  ['"Next" really moves to the second page', en.page2.from === 21 && en.page2.to === 40 && en.page2.first === 'QA Carrier 21'
    && ar.page2.from === 21],
  ['and the second page is still there seconds later, instead of snapping back to the top',
    en.page2Later.from === 21 && en.page2Later.first === 'QA Carrier 21' && ar.page2Later.from === 21,
    JSON.stringify({ en: en.page2Later.from, ar: ar.page2Later.from })],
  ['a re-render that really is needed keeps the reader where they were',
    en.afterRender.from === 21 && en.afterRender.first === 'QA Carrier 21' && ar.afterRender.from === 21,
    JSON.stringify({ en: en.afterRender.from, ar: ar.afterRender.from })],
  ['but changing the list starts again at the first page, with an honest count',
    en.afterSearch.from === 1 && en.afterSearch.total < 44 && en.afterSearch.rows === en.afterSearch.total,
    JSON.stringify(en.afterSearch)],
  ['paging about wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
