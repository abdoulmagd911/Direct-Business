/* probe-sop-arabic-and-bidi.mjs — guards js/81. Found live 2026-09-15 (fire #51) on the Arabic SOP
   library, by eye on its screenshot: the English procedure texts sat in an RTL container, so every
   sentence's full stop jumped to the left end of the line; and the two comparison-box headers
   ("Saudi common practice baseline", "Our standard" — built by core-08's English rewrite chain, unknown
   to js/21's Arabic dictionary) plus the "Purpose." lead-in were the only English chrome left on the page.
   Asserts on the Arabic page: every SOP paragraph / command block / box paragraph has unicode-bidi:
   plaintext; every box header is Arabic (none matches the two English strings); the lead-in reads
   "الغرض."; and on the ENGLISH page nothing is touched (headers still English, no plaintext rule).
   Sabotage-tested: with the js/81 script line removed from index.html, 4 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-sop-arabic-and-bidi.mjs                                              */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9038; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
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
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined' && Array.isArray(DB.sops), { timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2500);
const read = () => p.evaluate(() => {
  document.querySelectorAll('#view details.sop').forEach((d) => { d.open = true; });
  const paras = [...document.querySelectorAll('#view .sop .body p, #view .sop pre, #view .sop .box p')];
  const heads = [...document.querySelectorAll('#view .sop .box .h')].map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim());
  const leadIns = [...document.querySelectorAll('#view .sop .body p > b')].map((x) => (x.textContent || '').trim()).filter((t) => /^(Purpose\.|الغرض\.)$/.test(t));
  const rests = [...document.querySelectorAll('#view .sop .body p > span[data-v81-rest]')];
  const englishRestsLtr = rests.filter((s) => /^[A-Za-z]/.test((s.textContent || '').trim()) && getComputedStyle(s).direction === 'ltr').length;
  const englishRests = rests.filter((s) => /^[A-Za-z]/.test((s.textContent || '').trim())).length;
  return { lang: LANG, dir: document.documentElement.dir, sops: document.querySelectorAll('#view details.sop').length, paras: paras.length, plaintext: paras.filter((x) => getComputedStyle(x).unicodeBidi === 'plaintext').length, heads: heads.length, englishHeads: heads.filter((t) => /common practice|our standard|market standard|business edge/i.test(t)).length, arabicHeads: heads.filter((t) => /[؀-ۿ]/.test(t)).length, leadIns: leadIns.length, arabicLeadIns: leadIns.filter((t) => t === 'الغرض.').length, rests: rests.length, englishRests, englishRestsLtr };
});
await p.evaluate(() => { current = 'sopsla'; openLead = ''; window.sopslaTab = 'sops'; render(); }); await p.waitForTimeout(1200);
const en = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'ar') toggleLang(); }); await p.waitForTimeout(1500);
await p.evaluate(() => { current = 'sopsla'; window.sopslaTab = 'sops'; render(); }); await p.waitForTimeout(1200);
const ar = await read();
await p.evaluate(() => { if (typeof toggleLang === 'function' && LANG !== 'en') toggleLang(); });
await b.close(); srv.close?.();
const checks = [
  ['SOP library rendered with entries, paragraphs and box headers', en.sops > 3 && en.paras > 6 && en.heads > 3],
  ['EN: box headers untouched (still English), no plaintext rule applied', en.englishHeads === en.heads && en.plaintext === 0],
  ['AR: page is Arabic RTL', ar.lang === 'ar' && ar.dir === 'rtl'],
  ['AR: every SOP paragraph / command / box paragraph is unicode-bidi: plaintext', ar.paras > 6 && ar.plaintext === ar.paras],
  ['AR: every comparison-box header is Arabic (0 English left)', ar.heads > 3 && ar.englishHeads === 0 && ar.arabicHeads === ar.heads],
  ['AR: every "Purpose." lead-in reads "الغرض."', ar.leadIns > 0 && ar.arabicLeadIns === ar.leadIns],
  ['AR: the English sentence after the Arabic lead-in is isolated and still reads left-to-right', ar.rests === ar.leadIns && ar.englishRests > 0 && ar.englishRestsLtr === ar.englishRests],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
