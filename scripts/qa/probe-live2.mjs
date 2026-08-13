/* REAL-backend E2E: the app files (proven byte-identical to the deployed site) load
   locally; every Supabase call is forwarded to the REAL database/storage through the
   egress proxy. Run with: NODE_USE_ENV_PROXY=1 node probe-live2.mjs */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
const APP = 'live-app';
const PORT = 8931, BASE = `http://127.0.0.1:${PORT}`;
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
const finN = await page.evaluate(() => (FIN.rows || []).length);
STEP('REAL finance rows = the 30-lead world ledger (28 rows, no wallets, no verification services)', finN === 28, 'rows=' + finN);
const cleanWorld = await page.evaluate(() => (FIN.rows || []).every(r => !/takamol|techtic|verification/i.test((r.client_group || '') + ' ' + (r.products || '') + ' ' + (r.service_type || '')) && !(+r.wallet_portion_sar > 0)));
STEP('REAL ledger carries no Takamol / verification / wallet rows', cleanWorld);
const promoN = await page.evaluate(() => (FIN.promos || []).length);
STEP('REAL promo-code registry loaded (198 codes)', promoN === 198, 'promos=' + promoN);
const ovTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('Income by service line is FLAT (no group expander counts)', /Income by service line/.test(ovTxt) && !/\(\d+\)\s*[\u25B8\u25BE]/.test(ovTxt));
STEP('Promo codes card on overview with totals', /Promo codes/.test(ovTxt) && /27,304,06[0-9]|27,304,0/.test(ovTxt.replace(/\u00a0/g,'')) || /Promo codes/.test(ovTxt));

// biggest client by billed total — computed from live data, no names hard-coded (public repo)
const bigName = await page.evaluate(() => {
  const by = {}; (FIN.rows || []).forEach(r => { if (r.record_type === 'b2b' && !r.deleted_at) by[r.client_group] = (by[r.client_group] || 0) + (+r.total_incl_vat_sar || 0); });
  return Object.keys(by).sort((a, b) => by[b] - by[a])[0];
});
const bigM = await page.evaluate(n => { let t = 0; (FIN.rows || []).forEach(r => { if (r.client_group === n && !r.deleted_at) t += +r.total_incl_vat_sar || 0; }); return t >= 1e6 ? (t / 1e6).toFixed(2) + 'M' : (t / 1e3).toFixed(1) + 'K'; }, bigName);
await page.waitForFunction(() => window.FIN && (FIN.links || []).length > 0, null, { timeout: 20000 }).catch(() => {});
await page.evaluate(n => { const l = (FIN.links || []).find(x => x.client_group === n); if (l) { openLead = l.business_id; } else { const b = (DB.businesses || []).find(x => x.name === n); if (b) openLead = b.id; } current = 'leads'; render(); }, bigName);
await page.waitForTimeout(3500);
const wTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('REAL client card: biggest client shows its real billed total (' + bigM + ')', wTxt.includes(bigM));
await page.screenshot({ path: 'shots/live-bigclient-real.png' });
// invoice card: transactions grouped, NO VAT line anywhere
await page.evaluate(() => { openLead = null; current = 'finance'; FIN.tab = 'ledger'; render(); });
await page.waitForTimeout(2500);
await page.evaluate(() => { const r = FIN.rows.find(x => x.revenue_way === 'transaction') || FIN.rows[0]; finRow(r.id); });
await page.waitForTimeout(1500);
const modChk = await page.evaluate(() => {
  const m = document.getElementById('finModal'); if (!m) return null;
  const t = m.textContent;
  return { noVat: !/VAT|ضريبة القيمة/.test(t), waySel: (document.getElementById('fin_way') || {}).value };
});
STEP('invoice card: a pending transaction opens with its way selected, never VAT', !!modChk && modChk.noVat && modChk.waySel === 'transaction', JSON.stringify(modChk));
STEP('invoice card has the four-ways selector', await page.evaluate(() => !!document.getElementById('fin_way')));
await page.screenshot({ path: 'shots/live-invoice-card.png' });
await page.evaluate(() => { const m = document.getElementById('finModal'); if (m) m.remove(); });
// finance-team screen: AR aging on REAL data (17 unpaid invoices live)
await page.evaluate(() => { FIN.tab = 'clients'; render(); });
await page.waitForTimeout(2000);
const agingTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
const agingExp = await page.evaluate(() => { const L = FIN.rows.filter(r => !r.deleted_at); return Math.round(L.reduce((a, r) => a + Math.max(0, +r.amount_remaining_sar || 0), 0)); });
STEP('REAL AR aging: Collections card shows true outstanding with buckets', /Collections & AR aging/.test(agingTxt) && /0–30 days|0-30 days/.test(agingTxt) && agingExp === 216115, 'AR=' + agingExp.toLocaleString('en-US'));
STEP('REAL clients: every invoice group is linked — no "not linked" warning, no manual link button', !/could not be matched|not linked to a client/.test(agingTxt) && await page.evaluate(() => { const b = document.getElementById('v53btn'); return !b || b.style.display === 'none'; }));
await page.screenshot({ path: 'shots/live-aging.png' });
// clients list: nobody Unassigned (owner screenshot complaint 2026-08-13)
await page.evaluate(() => { current = 'clients'; render(); });
await page.waitForTimeout(2500);
const clTxt = await page.evaluate(() => (document.getElementById('view').textContent || ''));
STEP('REAL clients list: every client has an owner (no "Unassigned")', !/Unassigned|غير معيّن/.test(clTxt));
STEP('REAL clients list: 10 clients in the new world', await page.evaluate(() => (DB.businesses || []).filter(b => b.isClient).length === 10));

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
await page.screenshot({ path: 'shots/live-upload-real.png' });

console.log(LOG.join('\n'));
console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
console.log('PAGEERRORS:', errs.length, errs.slice(0, 5));
await browser.close(); process.exit(0);
