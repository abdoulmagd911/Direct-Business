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
STEP('REAL sign-in works', await page.evaluate(() => !document.querySelector('#view input[type=email]') && typeof DB !== 'undefined' && DB.businesses.length > 30).catch(() => false), await page.evaluate(() => (typeof DB !== 'undefined' ? DB.businesses.length : 'no DB') + ' businesses').catch(() => '?'));

await page.evaluate(() => { current = 'finance'; render(); });
await page.waitForTimeout(9000);
const finN = await page.evaluate(() => (FIN.rows || []).length);
STEP('REAL PostgREST: finance pager loads ALL rows past the 1000-row cap', finN >= 1279, 'rows=' + finN);

await page.evaluate(() => { const b = DB.businesses.find(x => x.name === 'Al-Mutlaq Holding Group'); openLead = b.id; current = 'leads'; render(); });
await page.waitForTimeout(3500);
const wTxt = await page.evaluate(() => (document.getElementById('view').textContent || '').replace(/\s+/g, ' '));
STEP('REAL whale: 24.39M billed · 1200 invoices · billing accounts on the card', wTxt.includes('24.39M') && wTxt.includes('1200') && wTxt.includes('#950'));
await page.screenshot({ path: 'shots/live-whale-real.png' });

// Part C #1 — REAL storage upload
await page.evaluate(() => { openLead = null; current = 'offers'; render(); });
await page.waitForTimeout(2500);
await page.locator('#otb tr').first().click();
await page.waitForTimeout(2500);
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
