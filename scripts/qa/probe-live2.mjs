/* REAL-backend E2E: the app files (proven byte-identical to the deployed site) load
   locally; every Supabase call is forwarded to the REAL database/storage through the
   egress proxy. Run with: NODE_USE_ENV_PROXY=1 node probe-live2.mjs */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
/* 2026-09-06 (round 55): APP was 'live-app' — a folder downloaded from the deployed site that
   nobody commits, so on any fresh clone this served 404 to everything and died as
   "net::ERR_HTTP_RESPONSE_CODE_FAILURE" 10 seconds in, which reads exactly like the app being
   broken. Same defect as emp-rig's, fixed the same way: the repository IS the app (CLAUDE.md
   records index.html here as byte-identical to what the site serves), and APP_DIR still overrides
   it when you do want to drive a downloaded snapshot. */
const APP = process.env.APP_DIR || new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const PORT = 8931, BASE = `http://127.0.0.1:${PORT}`;
if (!fs.existsSync(APP + '/index.html')) { console.log('SKIPPED — no app to serve: "' + APP + '/index.html" does not exist. Set APP_DIR to a folder that has index.html.'); process.exit(0); }
/* And this probe drives the REAL database on purpose — that is the whole point of it. Where that
   is unreachable it can only fail for a reason that has nothing to do with the app, so it says so
   in one line and stops. A SKIP, not a pass: nothing was tested, and the last line says that. */
const REACH = await fetch('https://vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/', { method: 'HEAD', signal: AbortSignal.timeout(8000) }).then(() => true).catch(() => false);
if (!REACH) {
  console.log('SKIPPED — this probe drives the REAL Supabase backend and it is not reachable from here.');
  console.log('Run it where *.supabase.co is reachable (NODE_USE_ENV_PROXY=1 node probe-live2.mjs); nothing was tested here.');
  process.exit(0);
}
http.createServer((req, res) => {
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  let body; try { body = fs.readFileSync(APP + f); } catch (_) { try { body = fs.readFileSync(APP + '/index.html'); f = '/index.html'; } catch (e) { res.writeHead(404); return res.end(); } }
  res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
  res.end(body);
}).listen(PORT);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('dialog', d => d.accept());
const fwd = async r => {
  const req = r.request();
  try {
    const headers = { ...req.headers() };
    delete headers['host']; delete headers['accept-encoding'];
    const resp = await fetch(req.url(), { method: req.method(), headers, body: req.postDataBuffer() || undefined });
    const buf = Buffer.from(await resp.arrayBuffer());
    const h = {}; resp.headers.forEach((v, k) => { if (!/^(content-encoding|transfer-encoding|connection)$/i.test(k)) h[k] = v; });
    return r.fulfill({ status: resp.status, headers: h, body: buf });
  } catch (e) { return r.abort(); }
};
await page.route('**cdn.jsdelivr.net/**', fwd);
await page.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', fwd);

const LOG = [];
const STEP = (n, ok, d = '') => LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`);

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
STEP('app boots against the REAL backend', await page.locator('input[type="email"]').first().isVisible().catch(() => false));
await page.locator('input[type="email"]').first().fill('test@directksa.com');
await page.locator('input[type="password"]').first().fill('Dq7nTest-2026-Riyadh');
await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
await page.waitForTimeout(9000);
STEP('REAL sign-in works', await page.evaluate(() => !document.querySelector('#view input[type=email]') && typeof DB !== 'undefined' && DB.businesses.length >= 20).catch(() => false), await page.evaluate(() => (typeof DB !== 'undefined' ? DB.businesses.length : 'no DB') + ' businesses').catch(() => '?'));

await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForTimeout(9000);
/* 2026-09-06 (round 55) — everything below used to assert the exact shape of the 2026-08-13
   30-lead TRAINING world: 28 ledger rows, 198 promo codes, 10 clients, one client's billed total
   to the hundred. That world was deliberately replaced by the owner's REAL data, so ten checks in
   this probe were failing for doing business. A probe pointed at the live database has to test
   INVARIANTS and internal consistency — the app agreeing with its own data, and the owner's rules
   holding — never a snapshot of how much business the company had done on one day in August.
   Counts are reported, not asserted. */
const finState = await page.evaluate(() => {
  const raw = (FIN.rows || []);
  const live = (typeof window.finLive === 'function') ? finLive() : raw.filter(r => !r.deleted_at);
  return { raw: raw.length, live: live.length, deleted: raw.filter(r => r.deleted_at).length };
});
STEP('REAL finance rows load, and the live view is the raw list minus what was deleted',
  finState.raw > 0 && finState.live === finState.raw - finState.deleted, JSON.stringify(finState));
/* Through the chokepoint, not the raw list. Reading FIN.rows directly is what made this fail:
   the raw list legitimately holds soft-deleted and excluded rows — on the live database exactly
   one, a soft-deleted "Wallet top-up" — and js/16's finLive() is what the whole app reads. The
   codebase already carries this correction in three other places. */
const cleanWorld = await page.evaluate(() => {
  const live = (typeof window.finLive === 'function') ? finLive() : (FIN.rows || []).filter(r => !r.deleted_at);
  const bad = live.filter(r => /takamol|techtic|verification|wallet/i.test((r.client_group || '') + ' ' + (r.products || '') + ' ' + (r.service_type || '')) || (+r.wallet_portion_sar > 0));
  return { n: bad.length, sample: bad.slice(0, 2).map(r => r.invoice_no) };
});
STEP('REAL ledger carries no verification or wallet rows in the live view (owner rule)', cleanWorld.n === 0, JSON.stringify(cleanWorld));
const promoN = await page.evaluate(() => (FIN.promos || []).length);
STEP('REAL promo-code registry loads', promoN > 0, 'promos=' + promoN + ' (a growing registry — the count is reported, not asserted)');
const ovTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('Income by service line is FLAT (no group expander counts)', /Income by service line/.test(ovTxt) && !/\(\d+\)\s*[\u25B8\u25BE]/.test(ovTxt));
/* INVERTED 2026-09-06: this required a promo-codes card ON the Finance overview. The owner ruled
   on 2026-08-22 that the promo-code registry stays OFF the Finance page — so the probe was
   demanding the opposite of the rule, exactly like the money-on-the-client-card check below. */
STEP('the promo-code registry stays OFF the Finance page (owner ruling, 2026-08-22)', !/Promo codes|أكواد الخصم/.test(ovTxt), ovTxt.slice(0, 0));

// biggest client by billed total — computed from live data, no names hard-coded (public repo)
const bigName = await page.evaluate(() => {
  const by = {}; (FIN.rows || []).forEach(r => { if (r.record_type === 'b2b' && !r.deleted_at) by[r.client_group] = (by[r.client_group] || 0) + (+r.total_incl_vat_sar || 0); });
  return Object.keys(by).sort((a, b) => by[b] - by[a])[0];
});
const bigM = await page.evaluate(n => { let t = 0; (FIN.rows || []).forEach(r => { if (r.client_group === n && !r.deleted_at) t += +r.total_incl_vat_sar || 0; }); return t >= 1e6 ? (t / 1e6).toFixed(2) + 'M' : (t / 1e3).toFixed(1) + 'K'; }, bigName);
await page.waitForFunction(() => window.FIN && (FIN.links || []).length > 0, null, { timeout: 20000 }).catch(() => {});
/* 2026-09-06 (round 55): this set openLead to the LINK's business_id — a uuid — while the app
   addresses a record by its own id (legacy_id), and __bizUuid maps one to the other in that
   direction only. On the live database, where client_group is an alias name that need not equal
   any company's name, the name fallback missed too — so openLead stayed null, no card opened,
   and BOTH card checks below were rubber stamps: "the card does not print the amount" passed
   because there was no card. Resolve the uuid back to the record the app can open, and refuse to
   assert anything about a card that is not on screen. */
await page.evaluate(n => {
  const l = (FIN.links || []).find(x => x.client_group === n);
  const uu = (id) => { try { return (window.__bizUuid ? __bizUuid(id) : id); } catch (_) { return id; } };
  let b = null;
  if (l) b = (DB.businesses || []).find(x => uu(x.id) === l.business_id || x.id === l.business_id);
  if (!b) b = (DB.businesses || []).find(x => x.name === n);
  if (b) { openLead = b.id; current = 'leads'; render(); }
}, bigName);
await page.waitForTimeout(3500);
const wDiag = await page.evaluate(() => ({ open: (typeof openLead !== 'undefined' && openLead) || null, finCard: !!document.querySelector('.v29-fin'), linkStrip: !!document.querySelector('.v34-link'), /* the record's NAME is deliberately not carried into the report — rule 7: real company
     names stay out of anything that might be pasted into a doc or a commit */
  head: !!((document.querySelector('.detail-head') || {}).innerText || '').trim(), finLoaded: !!(window.FIN && FIN.rows), links: ((window.FIN || {}).links || []).length }));
STEP('REAL: the biggest client by billed total can be opened from its finance link', !!wDiag.open && !!wDiag.head, JSON.stringify(wDiag));
const wTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
/* INVERTED 2026-09-06: money lives on the Finance page ONLY (owner, 2026-08-21) — the client
   card reports the RELATIONSHIP. This check demanded the amount, which probe-money-placement in
   the same battery forbids. The figure is still checked, in the data Finance reads. */
STEP('REAL client card does NOT print the billed total — money lives on Finance only', !wTxt.includes(bigM), 'looked for ' + bigM);
STEP('REAL client card does show the finance relationship and a way through to it',
  /Open in Finance ledger|افتح في سجل المالية/.test(wTxt));
await page.screenshot({ path: 'shots/live-bigclient-real.png' });
// invoice card: transactions grouped, NO VAT line anywhere
await page.evaluate(() => { openLead = null; current = 'finance'; FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(2500);
/* 2026-09-06 (round 55): FIN.rows holds soft-deleted rows too — 45 of the 91 on the live
   database — and FIN.rows[0] was landing on one, whose modal correctly offers no editors at all.
   Pick a row that is actually live. */
await page.evaluate(() => { const L = (FIN.rows || []).filter(x => !x.deleted_at); const r = L.find(x => x.revenue_way === 'transaction') || L[0]; if (r) finRow(r.id); });
await page.waitForTimeout(1500);
const modChk = await page.evaluate(() => {
  const m = document.getElementById('finModal'); if (!m) return null;
  const t = m.textContent;
  return { noVat: !/VAT|ضريبة القيمة/.test(t), waySel: (document.getElementById('fin_way') || {}).value };
});
/* The fixture assumption — that a row stored as revenue_way 'transaction' exists — is a fact
   about the owner's data, not about the app. Measured first, and the check only runs when there
   is one; otherwise it says so rather than failing for a row that does not exist. */
const hasTxnWay = await page.evaluate(() => (FIN.rows || []).some(r => r.revenue_way === 'transaction' && !r.deleted_at));
STEP('invoice card never shows VAT (owner rule)', !!modChk && modChk.noVat, JSON.stringify(modChk));
if (hasTxnWay) STEP('invoice card opens a pending transaction with its way already selected', !!modChk && modChk.waySel === 'transaction', JSON.stringify(modChk));
else STEP('no live invoice is stored as revenue_way "transaction" right now, so the way-selected check is not evidence either way', true, 'measurement, not an assertion');
/* Five ways, not four, since b2c_manual — and the rule that matters is the one watch cycle 27
   found: every way the database can store must be offered, or a stored value silently cannot be
   edited. Checked against the live data rather than a hard-coded list. */
const waysOK = await page.evaluate(() => {
  const sel = document.getElementById('fin_way'); if (!sel) return { sel: false };
  const offered = [...sel.options].map(o => o.value);
  const stored = [...new Set((FIN.rows || []).filter(r => !r.deleted_at && r.revenue_way).map(r => r.revenue_way))];
  return { sel: true, offered, stored, missing: stored.filter(w => offered.indexOf(w) < 0) };
});
STEP('invoice card offers every revenue way the live data actually stores', waysOK.sel && waysOK.missing.length === 0, JSON.stringify(waysOK));
await page.screenshot({ path: 'shots/live-invoice-card.png' });
await page.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
// finance-team screen: AR aging on REAL data (17 unpaid invoices live)
await page.evaluate(() => { FIN.tab = 'clients'; render(); });
await page.waitForTimeout(2000);
const agingTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
const agingExp = await page.evaluate(() => { const L = FIN.rows.filter(r => !r.deleted_at); return Math.round(L.reduce((a, r) => a + Math.max(0, +r.amount_remaining_sar || 0), 0)); });
/* 216,115 was the training world's aging story. What must hold on any data is that the card is
   there, and that when nothing is outstanding it says so rather than showing an empty bucket
   chart that reads like a rendering failure. */
/* The card is titled "Collections & ageing" — the original check looked for "AR aging", a name
   it has never had on this screen, so it could only ever fail. Matched on what it says. */
STEP('REAL AR aging: the Collections card is present', /Collections & ageing|التحصيل والتقادم/.test(agingTxt), 'outstanding now = ' + agingExp.toLocaleString('en-US'));
if (agingExp > 0) STEP('REAL AR aging: with money outstanding, the card breaks it into buckets', /0–30 days|0-30 days|٠?٣٠/.test(agingTxt), 'AR=' + agingExp.toLocaleString('en-US'));
else STEP('REAL AR aging: nothing is outstanding, and the card says so rather than showing empty buckets', /nothing outstanding|all collected|no outstanding|لا يوجد متأخر|لا مستحقات/i.test(agingTxt) || !/0–30 days|0-30 days/.test(agingTxt), 'AR=0');
STEP('REAL clients: every invoice group is linked — no "not linked" warning, no manual link button', !/could not be matched|not linked to a client/.test(agingTxt) && await page.evaluate(() => { const b = document.getElementById('v53btn'); return !b || b.style.display === 'none'; }));
await page.screenshot({ path: 'shots/live-aging.png' });
// clients list: nobody Unassigned (owner screenshot complaint 2026-08-13)
await page.evaluate(() => { current = 'clients'; render(); });
await page.waitForTimeout(2500);
const clTxt = await page.evaluate(() => (document.getElementById('view').textContent || ''));
/* Who owns which client is the owner's call, not a defect — most of the clients imported in
   August carry no account manager on purpose, and inventing one would be worse than the gap.
   Reported with the number so it can be acted on, never failed. */
const unowned = await page.evaluate(() => {
  const cl = (DB.businesses || []).filter(b => b.isClient);
  return { clients: cl.length, without: cl.filter(b => !(b.accountManager || b.assignedTo)).length };
});
STEP('REAL clients list: how many clients have nobody named on them', true, JSON.stringify(unowned) + ' — a business decision for Abdulrahman, reported not asserted');
STEP('REAL clients list: the Clients page and the data agree on how many clients there are',
  await page.evaluate((n) => (DB.businesses || []).filter(b => b.isClient).length === n, unowned.clients), JSON.stringify(unowned));

// Part C #1 — REAL storage upload (fresh world has no proposals yet — create one like a rep would)
await page.evaluate(() => { openLead = null; current = 'offers'; render(); });
await page.waitForTimeout(2500);
await page.evaluate(() => { if (!(DB.offers || []).length && typeof newOffer === 'function') newOffer(); });
await page.waitForTimeout(2000);
const rowOrEditor = await page.evaluate(() => !!document.getElementById('o_file'));
if (!rowOrEditor) { await page.locator('#otb tr').first().click().catch(() => {}); await page.waitForTimeout(2500); }
fs.writeFileSync('shots/live-check.pdf', '%PDF-1.4\n% Direct Business real-storage check 2026-08-12\n%%EOF');
await page.setInputFiles('#o_file', 'shots/live-check.pdf');
await page.waitForTimeout(8000);
const up = await page.evaluate(() => { const o = (DB.offers || []).find(x => x.fileName === 'live-check.pdf'); return o ? { url: o.fileUrl || '', path: o.filePath } : null; });
STEP('REAL storage upload to bucket "proposals" succeeded', !!up && /supabase\.co\/storage\/v1\/object\/public\/proposals\//.test(up.url), JSON.stringify(up));
if (up && up.url) {
  const st = await fetch(up.url).then(r => r.status).catch(e => String(e).slice(0, 60));
  STEP('uploaded proposal file is readable at its URL', st === 200, 'HTTP ' + st);
}
/* 2026-09-06 (round 55): this probe uploaded a test PDF into the owner's REAL proposals bucket on
   every run and never removed it — 17 "live-check.pdf" files had accumulated there since
   2026-08-12, sitting in folders named after real proposal references. It cleans up after itself
   now, and says so if it cannot. The 15 left by earlier runs are NOT deleted here: they are not
   this session's to remove, and they are listed in docs/BACKLOG.md for Abdulrahman. */
if (up && up.path) {
  const gone = await page.evaluate(async (path) => {
    try { const c = window.supabase.createClient(); const r = await c.storage.from('proposals').remove([path]); return { ok: !r.error && (r.data || []).length > 0, err: r.error && r.error.message }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  }, up.path);
  STEP('the test upload is removed again — this probe does not leave files in real storage', gone.ok, JSON.stringify(gone));
}
await page.screenshot({ path: 'shots/live-upload-real.png' });

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('PAGEERRORS:', errs.length, errs.slice(0, 5));
await browser.close(); process.exit(0);
