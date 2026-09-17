/* probe-signin-form-arabic.mjs — guards the 2026-09-17 (fire #72) js/02 change found live: a person who had
   chosen Arabic signed out and got the sign-in form in English — labels, button, hint and every message — with
   only the two brand lines in Arabic. The app remembers the language in localStorage ('dbLang'), readable
   before anything loads, so the form now follows it. Two fresh browsers on the mock: one with dbLang=ar set
   before the page loads, one with nothing set. Checks the Arabic form (labels, button, right-to-left card,
   the empty-submit and forgot-with-no-email messages in Arabic, inputs still left-to-right) and that the
   default form is unchanged English. Nothing is submitted to the auth endpoint.
   Sabotage-tested: with the js/02 edit stashed, 3 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-signin-form-arabic.mjs                                                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9056; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; let authCalls = 0;
async function formIn(lang) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  if (lang) await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  await p.route(u => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); if (/\/auth\/v1\/(token|recover)/.test(u.pathname)) authCalls++;
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route(u => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route(u => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route(u => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 }); await p.waitForTimeout(1200);
  const read = () => p.evaluate(() => { const card = document.getElementById('cl_email').parentElement; const labels = [...card.querySelectorAll('label')].map((l) => l.innerText.trim()); return { labels, button: document.getElementById('cl_go').innerText.trim(), forgot: document.getElementById('cl_forgot').innerText.trim(), dir: getComputedStyle(card).direction, inputDir: document.getElementById('cl_email').getAttribute('dir'), err: (document.getElementById('cl_err').innerText || '').trim(), text: card.innerText.replace(/\s+/g, ' ').slice(0, 260) }; });
  const before = await read();
  await p.click('#cl_go'); await p.waitForTimeout(500); const empty = (await read()).err;
  await p.evaluate(() => document.getElementById('cl_forgot').click()); await p.waitForTimeout(600); const forgot = (await read()).err;
  await ctx.close();
  return { before, empty, forgot };
}
const ar = await formIn('ar');
const en = await formIn(null);
await b.close(); srv.close?.();
const isAr = (s) => /[؀-ۿ]/.test(s || '');
const checks = [
  ['Arabic chooser: labels, button and "forgot" link are Arabic', ar.before.labels.length === 2 && ar.before.labels.every(isAr) && isAr(ar.before.button) && isAr(ar.before.forgot)],
  ['Arabic chooser: the card reads right-to-left while the email box stays left-to-right', ar.before.dir === 'rtl' && ar.before.inputDir === 'ltr'],
  ['Arabic chooser: the empty-submit and forgot-with-no-email messages are Arabic', isAr(ar.empty) && isAr(ar.forgot) && !/Enter your email|Type your email/.test(ar.empty + ar.forgot)],
  ['default (no saved language): the form is the unchanged English one', en.before.labels.join('|') === 'Email|Password' && en.before.button === 'Sign in' && en.before.dir === 'ltr' && /Enter your email and password/.test(en.empty)],
  ['nothing was sent to the auth endpoint (the empty submit and the no-email forgot are refused on the page)', authCalls === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ ar, en, authCalls })); if (errors.length) console.log('errors:', errors); }
process.exit(fail ? 1 : 0);
