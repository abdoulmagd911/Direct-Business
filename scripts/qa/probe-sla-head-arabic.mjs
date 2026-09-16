/* probe-sla-head-arabic.mjs — guards the 2026-09-16 (fire #65) core-03 fix found live: on the Service Levels
   tab the brand column head read "DIRECT BUSINESS" on the Arabic page while every other head was Arabic; it now
   reads «دايركت أعمال», the same words the sidebar uses. EN unchanged.
   Sabotage-tested: with the core-03 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-sla-head-arabic.mjs                                                  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9050; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url());
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
await p.goto(BASE + '/sopsla', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
const heads = async () => { await p.evaluate(() => { current = 'sopsla'; window.sopslaTab = 'slas'; render(); }); await p.waitForTimeout(900); return p.evaluate(() => [...document.querySelectorAll('#view table.sla-table thead th')].map((t) => t.innerText.trim())); };
const en = await heads();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
const ar = await heads();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const checks = [
  ['EN Service Levels heads still read Event / Direct Business / …', en.some((h) => /^Direct Business$/i.test(h)) && en.some((h) => /^Event$/i.test(h))],
  ['AR Service Levels: the brand column reads «دايركت أعمال», not "Direct Business"', ar.some((h) => h === 'دايركت أعمال') && !ar.some((h) => /Direct Business/i.test(h))],
  ['AR: no other English head either', !ar.some((h) => /^[A-Za-z ]{3,}$/.test(h))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
