/* probe-provider-caps-arabic.mjs — guards the 2026-09-16 (fire #64) core-03 fix found live: the seven servicing-
   capability chips on a provider's card and in its editor (Book, Reissue, Refund, EMD, Seats, Bags, Split PNR)
   were English on the Arabic page. The stored key stays English; the word on screen follows the language, the
   two codes (EMD, PNR) stay as codes. Opens the first provider's card and editor in EN (English words intact,
   checkbox VALUES still the English keys) and in AR (Arabic words on the card chips and the editor labels).
   Sabotage-tested: with the core-03 edit stashed, 2 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-provider-caps-arabic.mjs                                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9049; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
await p.goto(BASE + '/vendors', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && (DB.vendors || []).length > 0 && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
const read = async () => p.evaluate(() => { const id = (DB.vendors || [])[0].id; openSupFn('prov', id); return new Promise((res) => setTimeout(() => { const chips = [...document.querySelectorAll('#view button[onclick*="setCap("]')].map((x) => x.innerText.replace(/^✓\s*/, '').trim()); editSupplier('prov', id); setTimeout(() => { const labels = [...document.querySelectorAll('#modal label')].filter((l) => l.querySelector('input.p_cap')).map((l) => ({ text: l.innerText.trim(), value: l.querySelector('input.p_cap').value })); closeModal(); closeSup(); res({ chips, labels }); }, 500); }, 900)); });
const en = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
const ar = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const KEYS = ['Book', 'Reissue', 'Refund', 'EMD', 'Seats', 'Bags', 'Split PNR']; const AR = ['حجز', 'إعادة إصدار', 'استرداد', 'EMD', 'مقاعد', 'أمتعة', 'تقسيم PNR'];
const checks = [
  ['EN card chips read the seven English capability words', KEYS.every((k) => en.chips.includes(k))],
  ['EN editor labels read the same words (the editor upper-cases them) and the checkbox values are the English keys', KEYS.every((k) => en.labels.some((l) => l.text.toLowerCase() === k.toLowerCase() && l.value === k))],
  ['AR card chips read the Arabic words (codes EMD / PNR kept)', AR.every((k) => ar.chips.includes(k)) && !/^(Book|Reissue|Refund|Seats|Bags)$/.test(ar.chips.join('|')) && !ar.chips.some((c) => /^(Book|Reissue|Refund|Seats|Bags|Split PNR)$/.test(c))],
  ['AR editor labels are Arabic while the checkbox values stay the English keys', AR.every((k, i) => ar.labels.some((l) => l.text === k && l.value === KEYS[i]))],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
