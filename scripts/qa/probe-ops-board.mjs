/* probe-ops-board.mjs — the Operations board and the Proposals list WITH DATA (2026-09-02,
   attack round 10). Until this round the mock served nothing for app_requests / app_offers, so
   every harness run of these two pages was on an empty page and nothing here had ever been
   checked with a record on it. Asserts, against the seeded tables:
     - the seven requests reach the board (js/35 table-read), one per column, counts right
     - the six KPI tiles are the right arithmetic: open = not Closed; SLA overdue = older than
       2 h and not Delivered/Closed; Awaiting client; pipeline = Σ sell; booked margin =
       Σ (sell − cost) with the right %; delivered/closed
     - "Advance →" on a request moves it one column AND the change reaches the app_requests
       table (M13: a refused write is reported, not recorded as synced —
       run with MOCK_REFUSE_OPS_WRITES=1 for that path)
     - Arabic: the column headers and KPI labels are Arabic; phone width has no sideways scroll
     - Proposals: the three seeded proposals list with their status; the editor opens in EN and AR
   Sabotage: empty the app_requests seed → counts red; drop js/35's .select('id') → refusal red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const REFUSE = process.env.MOCK_REFUSE_OPS_WRITES === '1';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = REFUSE ? 8296 : 8295;
const srv = start(PORT);
const BASE = 'http://localhost:' + PORT;
const SHOTS = '/tmp/claude-0/-home-user-Direct-Business/c6b2dbb4-5df9-5075-b6c8-d5f2b7cdb838/scratchpad/shots10';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
let failures = 0;
function fail(msg) { failures++; console.log('  ✗ ' + msg); }
function ok(msg) { console.log('  ✓ ' + msg); }

async function mkPage(b, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.__errors = [];
  p.on('pageerror', (e) => p.__errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.dismiss());
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
  await p.goto(BASE + '/ops', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2000);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  // js/35 loads the record tables ~1.2 s after sign-in and re-asserts them for ~20 s
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => (typeof DB !== 'undefined' && DB.requests) ? DB.requests.length : 0).catch(() => 0); if (n >= 7) break; }
  await p.waitForTimeout(600);
  return p;
}
async function show(p, view, lang) {
  await p.evaluate(({ view, lang }) => { LANG = lang; if (typeof applyLang === 'function') applyLang(); current = view; openOffer = null; render(); }, { view, lang });
  await p.waitForTimeout(900);
}
const readBoard = () => {
  const cols = [...document.querySelectorAll('#reqboard .col')].map((c) => ({ head: (c.querySelector('.ch .t') || {}).textContent?.trim(), n: +((c.querySelector('.ch .n') || {}).textContent || 0), cards: c.querySelectorAll('.reqcard').length }));
  const kpis = [...document.querySelectorAll('#view .kpi')].map((k) => ({ l: (k.querySelector('.l') || {}).textContent?.trim(), v: (k.querySelector('.v') || {}).textContent?.trim() }));
  return { cols, kpis, hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4 };
};

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await mkPage(b, { width: 1366, height: 900 });
  await show(p, 'ops', 'en');

  const n = await p.evaluate(() => DB.requests.length);
  if (n === 7) ok('the seven seeded requests reached the app from the app_requests table');
  else fail('expected 7 requests from the table, DB.requests has ' + n);

  // expected figures computed from the SAME records the screen shows, with the app's own formatter
  const exp = await p.evaluate(() => {
    const R = DB.requests; const open = R.filter((r) => r.stage !== 'Closed');
    const over = open.filter((r) => r.stage !== 'Delivered' && Date.now() > (r.createdAt || Date.now()) + 2 * 3600e3).length;
    const sell = R.reduce((s, r) => s + (+r.sell || 0), 0); const margin = R.reduce((s, r) => s + ((+r.sell || 0) - (+r.cost || 0)), 0);
    const pct = sell ? Math.round(margin / sell * 100) : 0;
    return { open: open.length, over, awaiting: R.filter((r) => r.stage === 'Awaiting client').length, pipeline: moneyShort(sell) + ' SAR', pipelineMargin: moneyShort(margin) + ' SAR', done: R.filter((r) => r.stage === 'Delivered' || r.stage === 'Closed').length, sellN: sell, marginN: margin, pct };
  });
  let bd = await p.evaluate(readBoard);
  await p.screenshot({ path: SHOTS + '/ops-data-en-desk.png' });
  const perCol = bd.cols.map((c) => c.head + ':' + c.n).join(' ');
  if (bd.cols.length === 7 && bd.cols.every((c) => c.n === 1 && c.cards === 1)) ok('one request per board column — ' + perCol);
  else fail('board columns wrong — ' + perCol);
  // the margin tile carries the % on its own small line: "10k SAR" + "margin 15%"
  const want = [String(exp.open), String(exp.over), String(exp.awaiting), exp.pipeline, String(exp.done)];
  const got = bd.kpis.filter((_, i) => i !== 4).map((k) => k.v.replace(/\s+/g, ' ').trim());
  const marginTile = (bd.kpis[4] || {}).v || '';
  const marginOk = marginTile.replace(/\s+/g, ' ').startsWith(exp.pipelineMargin) && new RegExp('margin ' + exp.pct + '%$').test(marginTile.replace(/\s+/g, ' ').trim());
  if (JSON.stringify(got) === JSON.stringify(want) && marginOk) ok('KPI tiles match the arithmetic — open ' + exp.open + ', overdue ' + exp.over + ', pipeline ' + exp.pipeline + ', margin ' + exp.pipelineMargin + ' / ' + exp.pct + '% (Σ sell ' + exp.sellN + ', Σ margin ' + exp.marginN + ')');
  else fail('KPI tiles off — got ' + JSON.stringify(got) + ' + margin "' + marginTile + '" wanted ' + JSON.stringify(want) + ' + "' + exp.pipelineMargin + ' … margin ' + exp.pct + '%"');
  if (exp.over !== 3) fail('fixture drift: expected 3 overdue requests from the seed, computed ' + exp.over);

  // Advance → moves the New request to Quoting and the change must reach the table
  await p.evaluate(() => { advanceReq('req0'); });
  await p.waitForTimeout(1800);
  bd = await p.evaluate(readBoard);
  const byHead = Object.fromEntries(bd.cols.map((c) => [c.head, c.n]));
  if (byHead.New === 0 && byHead.Quoting === 2) ok('Advance → moved the request from New to Quoting on screen');
  else fail('Advance → did not move the card — ' + JSON.stringify(byHead));
  const row = await (await fetch(BASE + '/rest/v1/app_requests?id=eq.req0')).json();
  const stored = row && row[0] && row[0].data && row[0].data.stage;
  const toastText = await p.evaluate(() => document.body.innerText || '');
  if (!REFUSE) {
    if (stored === 'Quoting') ok('the new stage reached the app_requests table (M13: rows confirmed back)');
    else fail('the table still says stage "' + stored + '" after the advance');
    if (/refused the requests change/.test(toastText)) fail('a confirmed write was reported as refused');
  } else {
    if (stored === 'New') ok('REFUSAL: the table was left untouched by the mock');
    // the toast is short-lived — look for it in a small window after the sync
    let seen = /refused the requests change|لم يُحفظ التغيير/.test(toastText);
    for (let i = 0; !seen && i < 10; i++) { await p.waitForTimeout(250); seen = /refused the requests change|لم يُحفظ التغيير/.test(await p.evaluate(() => document.body.innerText || '')); }
    if (seen) ok('REFUSAL: the person was told the database refused the change (not recorded as synced)');
    else fail('REFUSAL: the database accepted 0 of 1 records and the app said nothing');
  }

  // Arabic board
  await show(p, 'ops', 'ar');
  bd = await p.evaluate(readBoard);
  await p.screenshot({ path: SHOTS + '/ops-data-ar-desk.png' });
  const AR = /[؀-ۿ]/;
  const engHeads = bd.cols.filter((c) => !AR.test(c.head || ''));
  if (bd.cols.length === 7 && !engHeads.length) ok('Arabic board: all seven column headers Arabic — ' + bd.cols.map((c) => c.head).join(' | '));
  else fail('Arabic board: English column header(s) — ' + engHeads.map((c) => c.head).join(' | '));
  const engKpi = bd.kpis.filter((k) => !AR.test(k.l || ''));
  if (!engKpi.length) ok('Arabic board: KPI labels Arabic');
  else fail('Arabic board: English KPI label(s) — ' + engKpi.map((k) => k.l).join(' | '));

  // Proposals list + editor
  await show(p, 'offers', 'en');
  const offers = await p.evaluate(() => ({ n: DB.offers.length, rows: [...document.querySelectorAll('#view table tbody tr')].filter((tr) => !tr.querySelector('.empty')).length, text: document.getElementById('view').innerText }));
  await p.screenshot({ path: SHOTS + '/offers-data-en-desk.png' });
  if (offers.n === 3 && offers.rows === 3) ok('the three seeded proposals list from the app_offers table');
  else fail('proposals: DB.offers ' + offers.n + ', rows on screen ' + offers.rows);
  if (/Draft/.test(offers.text) && /Sent/.test(offers.text) && /Won/.test(offers.text)) ok('proposal statuses shown (Draft / Sent / Won)');
  else fail('proposal statuses missing from the list');
  for (const lang of ['en', 'ar']) {
    await show(p, 'offers', lang);
    await p.evaluate(() => { openOfferFn('off1'); }); await p.waitForTimeout(900);
    const ed = await p.evaluate(() => ({ has: !!document.getElementById('of_client'), client: (document.getElementById('of_client') || {}).value, head: (document.querySelector('#view h3') || {}).textContent, hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 4, text: document.getElementById('view').innerText.slice(0, 2000) }));
    await p.screenshot({ path: SHOTS + '/offer-editor-' + lang + '-desk.png' });
    if (ed.has && ed.client === 'Test Company 1' && !ed.hOverflow) ok('proposal editor opens in ' + lang + ' with the record loaded');
    else fail('proposal editor ' + lang + ': ' + JSON.stringify({ has: ed.has, client: ed.client, hOverflow: ed.hOverflow }));
    if (lang === 'ar' && !/العرض/.test(ed.text)) fail('proposal editor AR: no Arabic heading');
    await p.evaluate(() => { openOffer = null; });
  }

  // Phone
  const ph = await mkPage(b, { width: 390, height: 844 });
  for (const lang of ['en', 'ar']) {
    await show(ph, 'ops', lang);
    const pb = await ph.evaluate(readBoard);
    await ph.screenshot({ path: SHOTS + '/ops-data-' + lang + '-phone.png' });
    if (!pb.hOverflow && pb.cols.length === 7) ok('phone ' + lang + ': board renders with no sideways page scroll');
    else fail('phone ' + lang + ': hOverflow=' + pb.hOverflow + ' cols=' + pb.cols.length);
  }

  const errs = [...p.__errors, ...ph.__errors].filter((e) => !/TUNNEL_CONNECTION/.test(e));
  console.log('\nJS errors:', errs.length ? JSON.stringify(errs.slice(0, 5)) : 'none');
  if (errs.length) fail(errs.length + ' JS error(s)');
  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log(`\nops-board OK (${REFUSE ? 'refusal path' : 'happy path'}) — board, KPIs, advance→table, Arabic, phone, proposals`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
