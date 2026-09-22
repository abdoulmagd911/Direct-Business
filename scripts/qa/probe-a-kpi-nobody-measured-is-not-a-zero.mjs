/* probe-a-kpi-nobody-measured-is-not-a-zero.mjs — the Reports page counts what was measured, and
   says how much of the plan that is.

   Fire #205. Reports has 14 objectives and 30 KPIs, and a figure is entered by hand (it lives in
   the browser, which the page says out loud at the top). `rptPct()` answers 0 for a KPI with no
   figure — right for a progress bar, which cannot be drawn as null — and three places read that 0
   as a measurement. Driven live with ONE KPI recorded at exactly its 20,000,000 SAR target and
   nothing else touched, the page said:

       Avg progress to 2026 targets            3%      ← 100 ÷ 30 KPIs, 29 of them never recorded
       #1 Increase revenue …                  17%      ← 100 ÷ 6 KPIs, 5 of them never recorded
       3 · Gaps & focus areas (<50% of target)
         KPI 15 — Number of B2B deal contracts: at no data of target 80
         … 29 lines, every one of them "no data"

   A report that goes to management, naming 29 shortfalls where there was not one measured
   shortfall. The author knew — a `withData` guard was already in the function — but the
   denominator stayed the full list, so the awareness never reached the arithmetic.

   Fixed: both averages are taken over the KPIs that have a figure, they are null (shown "—") when
   none has, the gaps list holds only MEASURED KPIs under half their target, and every one of those
   claims now names the fraction it speaks for ("of the 1 measured, not all 30", "1 of 6 KPIs
   measured", "29 of 30 KPIs have no figure recorded … and are not counted as gaps").

   What this holds:
     1. with nothing measured the headline average is "—", not "0%";
     2. with nothing measured every objective reads "—", not "0%";
     3. one KPI at exactly its target → its objective reads 100% and the headline reads 100%;
     4. both of those name what they speak for — "1 of 6" on the objective, "1" and "30" on the
        headline;
     5. the report's gaps section lists no gap and states how many KPIs have no figure;
     6. a brake, and the whole risk of this fix: a KPI that IS measured and IS below half its
        target must still be named a gap, and must still pull its objective's average down. A
        version that quietly dropped unmeasured KPIs by ignoring low numbers would pass 1-5;
     7. the same two claims read Arabic in Arabic;
     8. no JS errors.

   Nothing here touches the database: every figure is set through the page's own override, which
   writes to this browser only.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), both real runs:
     · dividing by every KPI again — fails 1, 2, 3, 6 and 7, and prints "17%" and "3%" rather than
       describing them (7 goes with them because the Arabic screen shows the same wrong number —
       one cause, not a second finding);
     · putting the unmeasured KPIs back into the gaps list — fails 5 and, with it, 6: the failure
       line prints all 29 restored lines, 28 of them reading "at 0% of target".
   Run: node scripts/qa/probe-a-kpi-nobody-measured-is-not-a-zero.mjs                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9235 — one mock. */
const PORT = 9235; const BASE = 'http://localhost:' + PORT;

const KPI_FULL = 8;        // objective #1, target 20,000,000 SAR, one of that objective's 6 KPIs
const KPI_FULL_TARGET = 20000000;
const KPI_LOW = 15;        // objective #1, target 80 — 10 of 80 is 13%, a genuine gap
const KPI_LOW_VALUE = 10;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try {
    const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {};
    resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd });
  } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
await p.waitForTimeout(3000);

const openReports = async (lang) => {
  await p.evaluate((l) => { try { LANG = l; if (typeof applyLang === 'function') applyLang(); current = 'reports'; render(); } catch (_) {} }, lang);
  await p.waitForTimeout(2200);
  await p.evaluate(() => { try { const bs = [...document.querySelectorAll('#view .rpt-tabs button')]; if (bs[0]) bs[0].click(); } catch (_) {} });
  await p.waitForTimeout(1800);
};
const readOverview = () => p.evaluate(() => {
  const chips = [...document.querySelectorAll('#view .chips .chip')].map((c) => ({
    v: ((c.querySelector('.v') || {}).textContent || '').trim(),
    l: ((c.querySelector('.l') || {}).textContent || '').trim() }));
  const rows = [...document.querySelectorAll('#view .card div')]
    .filter((d) => d.querySelector(':scope > span.tag') && d.querySelector('.rpt-bar'))
    .map((d) => ({ tag: (d.querySelector(':scope > span.tag').textContent || '').trim(),
      title: ((d.querySelector(':scope > div > div') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      pct: ((d.querySelector(':scope > b') || {}).textContent || '').trim() }));
  return { chips, rows };
});
const readReport = async () => {
  await p.evaluate(() => { try { const bs = [...document.querySelectorAll('#view .rpt-tabs button')]; if (bs[3]) bs[3].click(); } catch (_) {} });
  await p.waitForTimeout(2200);
  return p.evaluate(() => {
    const d = document.getElementById('rptdoc'); if (!d) return null;
    const heads = [...d.querySelectorAll('h3')].map((h) => (h.textContent || '').trim());
    const gapsHead = heads.find((h) => /Gaps|الفجوات/.test(h)) || null;
    return { gapsHead, items: [...d.querySelectorAll('ul li')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
      text: (d.innerText || '').replace(/\s+/g, ' '), kpiRows: d.querySelectorAll('tbody tr').length };
  });
};
const setKpi = async (n, val) => { await p.evaluate(([a, b2]) => { try { window.rptSetOverride(a, b2); } catch (_) {} }, [n, val]); await p.waitForTimeout(1800); };
const objRow = (ov, tag) => (ov.rows.find((r) => r.tag === tag) || {});
const headline = (ov) => ov.chips[3] || {};

/* A — nothing measured at all */
await openReports('en');
const empty = await readOverview();

/* B — one KPI recorded at exactly its target */
await setKpi(KPI_FULL, KPI_FULL_TARGET);
await openReports('en');
const one = await readOverview();
const rep1 = await readReport();

/* C — a second KPI recorded WELL BELOW its target: a real gap */
await setKpi(KPI_LOW, KPI_LOW_VALUE);
await openReports('en');
const two = await readOverview();
const rep2 = await readReport();

/* D — the same screen in Arabic */
await openReports('ar');
const arabicOv = await readOverview();
await b.close(); srv.close?.();

const arabic = (s) => /[؀-ۿ]/.test(String(s || ''));

const checks = [
  ['with nothing measured the headline average is "—", not "0%"',
    headline(empty).v === '—', JSON.stringify(headline(empty))],
  ['with nothing measured every objective reads "—", not "0%"',
    empty.rows.length === 14 && empty.rows.every((r) => r.pct === '—'),
    JSON.stringify({ n: empty.rows.length, pcts: [...new Set(empty.rows.map((r) => r.pct))] })],
  ['one KPI at exactly its target → its objective reads 100% and the headline reads 100%',
    objRow(one, '#1').pct === '100%' && headline(one).v === '100%',
    JSON.stringify({ obj1: objRow(one, '#1').pct, headline: headline(one).v, wasBefore: '17% / 3%' })],
  ['both claims name what they speak for — "1 of 6" on the objective, 1 and 30 on the headline',
    /1 of 6 KPIs measured/.test(objRow(one, '#1').title) && /\b1\b/.test(headline(one).l) && /\b30\b/.test(headline(one).l),
    JSON.stringify({ obj1: objRow(one, '#1').title, headline: headline(one).l })],
  ['the report names no gap and states how many KPIs have no figure',
    !!rep1 && rep1.items.length === 0 && !/no data/i.test(rep1.text) && /29 of 30 KPIs have no figure/.test(rep1.text) && rep1.kpiRows === 30,
    JSON.stringify({ items: rep1 && rep1.items.length, kpiRows: rep1 && rep1.kpiRows,
      note: rep1 && (rep1.text.match(/\d+ of \d+ KPIs have no figure[^.]*\./) || [''])[0] })],
  ['brake: a MEASURED KPI below half its target is still a gap, and still pulls its objective down',
    !!rep2 && rep2.items.length === 1 && /KPI 15/.test(rep2.items[0]) && /13%/.test(rep2.items[0]) &&
    objRow(two, '#1').pct === '57%' && objRow(two, '#1').pct !== '19%' && /2 of 6 KPIs measured/.test(objRow(two, '#1').title),
    JSON.stringify({ items: rep2 && rep2.items, obj1: objRow(two, '#1').pct, title: objRow(two, '#1').title })],
  ['in Arabic the same two claims are Arabic',
    arabic(headline(arabicOv).l) && !/measured/i.test(headline(arabicOv).l) &&
    arabic(objRow(arabicOv, '#1').title) && !/KPIs measured/.test(objRow(arabicOv, '#1').title) &&
    objRow(arabicOv, '#1').pct === '57%',
    JSON.stringify({ headline: headline(arabicOv).l, obj1: objRow(arabicOv, '#1').title })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d && d !== '[]' ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
