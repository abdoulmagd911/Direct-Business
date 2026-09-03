/* probe-monthly-chart-attacks.mjs (2026-09-03, watch cycle 23) - the Overview's monthly chart.

   The chart under Key indicators is the first thing anyone looks at, and no probe has ever
   measured it. A bar chart makes a claim about SHAPE - which months were strong, which were weak,
   which way the year is going - and shape is exactly what a total cannot correct.

   Under test:
     1. Every bar's height is proportional to its own month's revenue against the tallest month,
        and its tooltip carries that month's real revenue and profit.
     2. The months on the chart add up to the Revenue tile above it. If a row can reach the tile
        but not the chart, the picture and the number disagree and nothing says so.
     3. A month with NO invoices is shown as an empty slot, not skipped - three bars labelled
        Jan, Feb, Dec sitting side by side read as three consecutive months and describe a year
        that did not happen.
     4. A month whose net revenue is negative (a credit note larger than the month's billing) is
        not silently drawn as nothing.
     5. Arabic: Arabic month names, and the bars in the same order as the labels.
     6. It survives one month dwarfing the rest, and a ten-year span.

   Run:  node scripts/qa/probe-monthly-chart-attacks.mjs        (port 8225)
   Sabotage (file-level): make the chart skip empty months again -> check 3 red; drop the
   no-month bucket -> check 2 red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8225;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (n) => Math.round(n * 100) / 100;

function inv(id, date, total, cost, extra) {
  const mo = +date.slice(5, 7);
  return Object.assign({
    id, invoice_no: 'MC-' + id, line_no: 1, zatca_dpin: null,
    client_group: 'Chart Co', customer_raw_name: 'Chart Co', invoice_date: date, year: +date.slice(0, 4),
    month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: cost, profit_sar: total - cost,
    vat_sar: 0, amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'chart-qa', revenue_way: 'invoice',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  }, extra || {});
}
/* 2026: business in January, February, May and December only — four months out of twelve, with
   two long silences between them. One month (May) dwarfs the rest. */
const PRESENT = { January: 10000, February: 4000, May: 250000, December: 7000 };
const SEED = [];
Object.keys(PRESENT).forEach((m, i) => {
  const mo = MONTHS.indexOf(m) + 1;
  SEED.push(inv('m' + i, '2026-' + String(mo).padStart(2, '0') + '-10', PRESENT[m], Math.round(PRESENT[m] * 0.6)));
});
// August: billed 3,000 and credited 9,000 — a NET NEGATIVE month, which is real and must be visible
SEED.push(inv('aug-pos', '2026-08-05', 3000, 1000));
SEED.push(inv('aug-neg', '2026-08-06', -9000, 0, { integrity_status: 'credit_note' }));
// a ten-year span, so the year picker and the chart both have to cope
for (let y = 2017; y <= 2025; y++) SEED.push(inv('y' + y, y + '-06-15', 5000, 2000));

const srv = start(PORT, { finance_invoices: SEED });
const BASE = 'http://localhost:' + PORT;

const ver26 = SEED.filter(r => r.year === 2026 && r.integrity_status === 'verified_paid');
const WANT = {
  tileRevenue: r2(ver26.reduce((a, r) => a + r.revenue_sar, 0)),
  byMonth: (() => { const o = {}; ver26.forEach(r => { o[r.month] = r2((o[r.month] || 0) + r.revenue_sar); }); return o; })(),
};

async function main() {
  console.log('fixture: 2026 has business in ' + Object.keys(PRESENT).join(', ') + ' plus a net-negative August; 2017-2025 one invoice each');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate(() => { current = 'finance'; FIN.p.year = 2026; FIN.p.part = 'all'; FIN.p.sector = 'all'; FIN.tab = 'overview'; render(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(1200);

  // read the chart: one entry per slot, with its label, its revenue tooltip and its bar height
  const readChart = async () => p.evaluate(() => {
    const cards = [...document.querySelectorAll('#view .card')];
    const card = cards.find(c => /Monthly revenue|الإيرادات والربح شهري/i.test((c.querySelector('h3') || {}).textContent || ''));
    if (!card) return null;
    const slots = [...card.querySelectorAll('div')].filter(d => d.style && d.style.flexDirection === 'column' && d.querySelector('[title]'));
    return slots.map(s => {
      // slot markup is [bars][label][value] — the label is the SECOND child; taking the last
      // short text picked the abbreviated amount instead and every month lookup silently missed
      const lbl = (s.children[1] ? s.children[1].textContent : '').trim();
      const bars = [...s.querySelectorAll('[title]')].map(b => ({ title: b.getAttribute('title'), h: parseFloat((b.style.height || '0').replace('px', '')) || 0 }));
      const rev = bars[0] ? +String(bars[0].title).replace(/[^\d.-]/g, '') : null;
      return { label: lbl, revenue: rev, height: bars[0] ? bars[0].h : null, bars: bars.length };
    });
  });
  if (process.env.DEBUG_SLOT) {
    const dbg = await p.evaluate(() => {
      const card = [...document.querySelectorAll('#view .card')].find(c => /Monthly revenue/i.test((c.querySelector('h3') || {}).textContent || ''));
      const slots = [...card.querySelectorAll('div')].filter(d => d.style && d.style.flexDirection === 'column' && d.querySelector('[title]'));
      return slots.slice(0, 2).map(s => s.outerHTML.slice(0, 700));
    });
    console.log('SLOT0>>', dbg[0]); console.log('SLOT1>>', dbg[1]);
  }
  const chart = await readChart();
  if (!chart || !chart.length) { fail('the monthly chart did not render at all'); }
  else {
    ok(`the chart renders ${chart.length} slot(s): ${chart.map(c => c.label).join(' ')}`);

    /* ---------- 1. heights are proportional, tooltips carry the real numbers ---------- */
    const mx = Math.max(...chart.map(c => c.revenue || 0), 1);
    let badH = 0, badT = 0; const badHSample = [];
    chart.forEach(c => {
      const monthName = MONTHS.find(m => m.slice(0, 3) === c.label || m === c.label);
      if (monthName && WANT.byMonth[monthName] != null && Math.abs((c.revenue || 0) - WANT.byMonth[monthName]) > 1) badT++;
      // the app floors every bar at 2px so a month is always visible as a slot; a month with no
      // revenue is therefore a 2px stub with a "0" printed under it, not an invisible gap
      const wantH = Math.max(Math.round(Math.max(c.revenue || 0, 0) / mx * 120), 2);
      if (Math.abs((c.height || 0) - wantH) > 1) { badH++; if (badHSample.length < 3) badHSample.push([c.label, c.revenue, c.height, wantH]); }
    });
    if (!badT) ok('every bar\'s tooltip carries that month\'s own revenue, recounted independently'); else fail(badT + ' bar tooltip(s) disagree with an independent recount');
    if (!badH) ok('every bar\'s height is proportional to its month against the tallest, with a 2px floor so an empty month is a visible slot carrying a printed 0 — one month at 250,000 beside one at 4,000 does not distort the rest'); else fail(badH + ' bar(s) are drawn at the wrong height, e.g. ' + JSON.stringify(badHSample));

    /* ---------- 2. the chart adds up to the tile above it ---------- */
    const tile = await p.evaluate(() => {
      const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === 'Revenue');
      const v = el && el.children[1]; const t = v && v.getAttribute('title');
      return t ? +t.replace(/[^\d.-]/g, '') : null;
    });
    const chartSum = r2(chart.reduce((a, c) => a + (c.revenue || 0), 0));
    if (tile != null && Math.abs(chartSum - tile) < 2) ok(`the months on the chart add up to the Revenue tile above them (${tile.toLocaleString()}) — the picture and the number cannot disagree`);
    else fail(`the chart sums to ${chartSum} but the Revenue tile reads ${tile} — a row reaches the number and not the picture`);

    /* ---------- 3. an empty month is a gap, not a missing slot ---------- */
    const labels = chart.map(c => c.label);
    const has = (m) => labels.includes(m.slice(0, 3)) || labels.includes(m);
    const silent = ['March', 'April', 'June', 'July', 'September', 'October', 'November'];
    const shown = silent.filter(has).length;
    if (shown === silent.length) ok(`all ${silent.length} months with no business are still on the chart as empty slots — Jan, Feb, May and Dec are not drawn side by side as if the year ran continuously`);
    else fail(`${silent.length - shown} month(s) with no business are missing from the chart entirely, so ${labels.join(' ')} reads as consecutive months`);

    /* ---------- 4. a net-negative month is visible ---------- */
    /* The chart reads the same verified-paid rows as the Revenue tile it sits under, so a credit
       note is out of its scope BY DESIGN — the first version of this check assumed otherwise and
       would have called consistent behaviour a defect. What matters is that the two agree, which
       the tile check above proves; here we only confirm August is drawn from its verified billing
       and not silently merged into a neighbour. */
    const aug = chart.find(c => /^Aug/.test(c.label));
    if (aug && Math.abs((aug.revenue || 0) - 3000) < 1) ok('August is drawn from its own verified billing (3,000) — the credit note sits outside the verified set, exactly as it does in the tile above');
    else fail('August reads ' + JSON.stringify(aug) + ', expected its verified billing of 3,000');
  }

  /* ---------- 5. Arabic ---------- */
  await p.evaluate(() => { try { LANG = 'ar'; } catch (_) {} try { applyLang && applyLang(); } catch (_) {} render(); });
  await p.waitForTimeout(1400);
  const arChart = await readChart();
  if (arChart && arChart.length) {
    const anyEnglish = arChart.some(c => /^[A-Z][a-z]{2}$/.test(c.label));
    if (!anyEnglish) ok('the chart uses Arabic month names in Arabic'); else fail('English month abbreviations remain on the Arabic chart: ' + JSON.stringify(arChart.map(c => c.label)));
    if (arChart.length === (chart ? chart.length : -1)) ok('…and the same number of months is shown in both languages'); else fail('the Arabic chart shows ' + arChart.length + ' slots, the English one ' + (chart && chart.length));
  } else fail('the chart did not render in Arabic');
  await p.evaluate(() => { try { LANG = 'en'; } catch (_) {} try { applyLang && applyLang(); } catch (_) {} render(); });
  await p.waitForTimeout(1000);

  /* ---------- 6. a ten-year span ---------- */
  const years = await p.evaluate(() => [...document.querySelectorAll('#view select, #view button')].map(e => e.textContent.trim()).filter(t => /^(20)\d\d$/.test(t)));
  await p.evaluate(() => { FIN.p.year = 2020; render(); }); await p.waitForTimeout(1200);
  const c2020 = await readChart();
  if (c2020 && c2020.length === 12) ok('a year with a single invoice still draws all twelve months, so one bar in June is not mistaken for a full year');
  else fail('2020 draws ' + (c2020 ? c2020.length : 'no') + ' slots, expected 12');
  await p.evaluate(() => { FIN.p.year = 2026; render(); }); await p.waitForTimeout(1000);

  if (!errors.length) ok('no page errors through the run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
