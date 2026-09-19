/* probe-reference-chips-filter-the-list.mjs — guards the 2026-09-19 (fire #104) fix to the
   alliance/type chips above the Airlines and Providers tables, and to the row counter under them.

   WHAT WAS WRONG, measured against the real database (136 carriers, read live, nothing written):

     · The chips were applied by a generic handler that hid every table ROW whose VISIBLE text did
       not contain the chip's word. The Airlines table has no alliance column — it lives behind
       Insights — so the alliance was never in the row's text:
           oneworld · SkyTeam · Unaligned  ->  a completely blank table, no message, nothing
           Star Alliance                   ->  34 rows, matched on incidental text: Aer Lingus,
                                               Aeroflot, Air Arabia Egypt, Air Mauritius, Akasa Air
       Confirmed on screen, not only in a count.

     · Through all of it the line under the table still read "Showing 1–20 of 136", and clicking
       "All" set every row visible again — 136 rows under a label promising 20. The pager decorates
       a table once and then describes whatever list it saw at that moment, for ever; anything that
       rebuilds the body without a full render (the search box and these chips both call
       drawSupTable) left it talking about a list that no longer existed.

   THE FIX. The chip filters the DATA, where the search box and the sort already live, so the
   table, the Export helper and the pager all describe one list. "Unaligned" means "not in one of
   the three alliances", so the four chips add up to All — an airline with no alliance recorded is
   not in an alliance as far as this app knows. The pager re-paginates when a table body is really
   rebuilt, and goes back to page one, which is what a changed list means.

   After the fix, on the real data: Star Alliance 20 · oneworld 12 · SkyTeam 11 · Unaligned 93,
   summing to 136, each with an honest "Showing …" line, and SkyTeam reading Air France, China
   Eastern, China Southern, Delta, Garuda, ITA, Kenya Airways, KLM.

   This probe seeds its own carriers rather than leaning on the harness's five, because the cases
   that matter — a bucket bigger than one page, and a bucket with nothing in it — do not exist
   there, and a check that never meets its own case is not a check.

   Sabotage-tested 2026-09-19, each half separately, both restored afterwards:
     · chip branch removed, so it falls back to the row-text filter: 5 FAIL. Star shows 20 rows out
       of a claimed 44, the other three show a blank table with no message, and the four totals sum
       to 176 instead of 44.
     · pager's rebuild watcher disabled: 5 FAIL. Every bucket is right but the counter under it
       still describes the list from before — searching down to one carrier reads "1 of 12", and a
       25-carrier bucket is dumped whole under a label promising 20.
   Run: node scripts/qa/probe-reference-chips-filter-the-list.mjs                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9081; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

/* invented carriers: one bucket bigger than a page, one bucket deliberately empty */
const PLAN = { 'Star Alliance': 12, 'Oneworld': 0, 'SkyTeam': 7, '': 25 };
const EXPECT = { Star: 12, oneworld: 0, SkyTeam: 7, Unaligned: 25, all: 44 };

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
  await p.waitForTimeout(3000);

  await p.evaluate((plan) => {
    const out = []; let n = 0;
    Object.keys(plan).forEach((al) => {
      for (let i = 0; i < plan[al]; i++) {
        n++;
        out.push({ id: 'qa_air_' + n, name: 'QA Carrier ' + String(n).padStart(2, '0'), code: 'Q' + n,
          country: 'Testland', type: 'FSC', ksa: 'Yes', alliance: al, stock: String(900 + n),
          voidRule: 'Seeded for the alliance chips', refundRule: 'Seeded', contacts: [] });
      }
    });
    DB.airlines = out;
    current = 'airlines'; openLead = null; render();
  }, PLAN);
  await p.waitForTimeout(2500);

  const readState = () => p.evaluate(() => {
    const v = document.getElementById('view');
    const all = [].slice.call(v.querySelectorAll('tbody tr')).filter((r) => !r.querySelector('td[colspan]'));
    const shown = all.filter((r) => { const cs = getComputedStyle(r); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.getBoundingClientRect().height > 0; });
    const m = (v.innerText || '').match(/(?:Showing|عرض)\s*\d+[–-]\d+\s*(?:of|من)\s*(\d+)/);
    const emptyCell = v.querySelector('tbody td[colspan]');
    return { inDom: all.length, visible: shown.length,
      pagerTotal: m ? Number(m[1]) : null,
      emptyMsg: emptyCell ? (emptyCell.innerText || '').replace(/\s+/g, ' ').trim() : null,
      names: shown.map((r) => ((r.innerText || '').match(/QA Carrier \d+/) || [null])[0]).filter(Boolean) };
  });

  const chipNames = await p.evaluate(() => [].slice.call(document.querySelectorAll('#view [class*=chip]'))
    .map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 30));
  const byChip = {}; byChip.__start = await readState();
  for (const lab of chipNames) {
    await p.evaluate((l) => { const c = [].slice.call(document.querySelectorAll('#view [class*=chip]'))
      .find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim() === l); if (c) c.click(); }, lab);
    await p.waitForTimeout(1400);
    byChip[lab] = await readState();
    /* what the DATA says this chip should hold, asked of the app's own matcher */
    byChip[lab].expectedInData = await p.evaluate((l) => {
      const key = { 'Star Alliance': 'Star', 'ستار': 'Star', 'oneworld': 'oneworld', 'وان وورلد': 'oneworld',
        'SkyTeam': 'SkyTeam', 'سكاي تيم': 'SkyTeam', 'Unaligned': 'Unaligned', 'مستقل': 'Unaligned',
        'All': 'all', 'الكل': 'all' }[l];
      if (!key) return null;
      const A = DB.airlines || [];
      if (key === 'all') return A.length;
      const pre = ['star', 'oneworld', 'skyteam'];
      return A.filter((a) => { const al = String(a.alliance || '').trim().toLowerCase();
        const inAl = pre.some((x) => al.indexOf(x) === 0);
        return key === 'Unaligned' ? !inAl : al.indexOf(key.toLowerCase()) === 0; }).length;
    }, lab);
  }
  /* the search box rebuilds the same table body the same way, and was left describing the old list
     by the same stale pager — so it is checked here rather than assumed to follow */
  await p.evaluate(() => { const c = [].slice.call(document.querySelectorAll('#view [class*=chip]'))
    .find((x) => /^(All|الكل)$/.test((x.innerText || '').trim())); if (c) c.click(); });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const s = document.getElementById('sq'); if (s) { s.value = 'QA Carrier 03'; s.dispatchEvent(new Event('input', { bubbles: true })); } });
  await p.waitForTimeout(1400);
  const searched = await readState();

  await ctx.close();
  return { chipNames, byChip, searched };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();

const EN = (k) => en.byChip[k] || {};
const AR = (k) => ar.byChip[k] || {};
const pair = [['All', 'الكل', 'all'], ['Star Alliance', 'ستار', 'Star'], ['oneworld', 'وان وورلد', 'oneworld'],
  ['SkyTeam', 'سكاي تيم', 'SkyTeam'], ['Unaligned', 'مستقل', 'Unaligned']];
for (const [e, a, key] of pair) {
  console.log('  ' + key.padEnd(9), 'EN', JSON.stringify({ vis: EN(e).visible, total: EN(e).pagerTotal, want: EXPECT[key] }),
    ' AR', JSON.stringify({ vis: AR(a).visible, total: AR(a).pagerTotal }));
}
console.log('  empty bucket says:', JSON.stringify([EN('oneworld').emptyMsg, AR('وان وورلد').emptyMsg]));

/* a chip's list must never contain a carrier that belongs to a different alliance */
const PRE = ['star', 'oneworld', 'skyteam'];
const totalsSum = ['Star Alliance', 'oneworld', 'SkyTeam', 'Unaligned'].reduce((s, k) => s + (EN(k).pagerTotal || 0), 0);
const arTotalsSum = ['ستار', 'وان وورلد', 'سكاي تيم', 'مستقل'].reduce((s, k) => s + (AR(k).pagerTotal || 0), 0);

const checks = [
  ['the five chips are there and the seeded carriers really rendered, in both languages',
    en.chipNames.length === 5 && ar.chipNames.length === 5 && EN('All').pagerTotal === EXPECT.all && AR('الكل').pagerTotal === EXPECT.all],
  ['each alliance chip counts exactly the carriers the data puts in it',
    pair.every(([e, , key]) => key === 'all' || EN(e).pagerTotal === EXPECT[key]),
    JSON.stringify(pair.filter(([e, , k]) => k !== 'all').map(([e, , k]) => k + ':' + EN(e).pagerTotal + '/' + EXPECT[k]))],
  ['every chip shows exactly what its own line promises — one page of it, or all of it if it fits',
    pair.every(([e, a]) => EN(e).visible === Math.min(EN(e).pagerTotal, 20) && AR(a).visible === Math.min(AR(a).pagerTotal, 20)),
    JSON.stringify(pair.map(([e]) => e + ':' + EN(e).visible + '/' + EN(e).pagerTotal))],
  ['a bucket bigger than one page is still paged, not dumped whole under a label promising 20',
    EN('Unaligned').pagerTotal === 25 && EN('Unaligned').visible === 20 && AR('مستقل').visible === 20],
  ['the four alliance chips add up to All — no carrier lost between them, none counted twice',
    totalsSum === EXPECT.all && arTotalsSum === EXPECT.all, totalsSum + ' / ' + arTotalsSum + ' vs ' + EXPECT.all],
  ['a chip with nothing in it says so, in the reader\'s language, instead of showing a blank table',
    !!EN('oneworld').emptyMsg && /Nothing here|try/i.test(EN('oneworld').emptyMsg)
    && !!AR('وان وورلد').emptyMsg && /لا شيء هنا/.test(AR('وان وورلد').emptyMsg)],
  ['Arabic counts the same carriers as English', pair.every(([e, a]) => EN(e).pagerTotal === AR(a).pagerTotal)],
  ['searching narrows the counter too, instead of leaving it describing the whole list',
    en.searched.visible === 1 && en.searched.pagerTotal === 1 && ar.searched.pagerTotal === 1,
    JSON.stringify({ en: en.searched.visible + '/' + en.searched.pagerTotal, ar: ar.searched.visible + '/' + ar.searched.pagerTotal })],
  ['looking at every chip wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en: en.byChip, ar: ar.byChip }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
