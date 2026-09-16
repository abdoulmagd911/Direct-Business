/* probe-ingest-title-arabic.mjs — guards the 2026-09-16 (fire #66) core-06 fix found live: the ingest forms
   (invoice / booking / offer, reached from Today's "New booking" tile and the record pages) carried an English
   title — "Ingest booking" — on the Arabic page while every label inside was Arabic. The title (and the file
   note) now follow the page language; EN unchanged. Opens each form, reads its title, closes it, never saves.
   Sabotage-tested: with the core-06 edit stashed, 1 check goes FAIL, exit 1.
   Run: node scripts/qa/probe-ingest-title-arabic.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9051; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof ingestModal === 'function' && document.querySelectorAll('#nav button').length > 0, { timeout: 90000 }).catch(() => { });
await p.waitForTimeout(1500);
const titles = async () => { const out = {}; for (const k of ['invoice', 'booking', 'offer']) { out[k] = await p.evaluate((k) => { ingestModal(k, '', null); const t = ((document.querySelector('#modal .mh h3') || {}).innerText || '').trim(); const labels = [...document.querySelectorAll('#modal label')].length; closeModal(); return { t, labels }; }, k); } return out; };
const en = await titles();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(800);
const ar = await titles();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const checks = [
  ['EN titles still read "Ingest invoice / booking / offer"', en.invoice.t === 'Ingest invoice' && en.booking.t === 'Ingest booking' && en.offer.t === 'Ingest offer'],
  ['AR titles are Arabic («إدخال فاتورة / حجز / عرض»), no "Ingest"', ar.invoice.t === 'إدخال فاتورة' && ar.booking.t === 'إدخال حجز' && ar.offer.t === 'إدخال عرض'],
  ['each form still carries its fields (labels > 0) in both languages', ['invoice', 'booking', 'offer'].every((k) => en[k].labels > 0 && ar[k].labels === en[k].labels)],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
