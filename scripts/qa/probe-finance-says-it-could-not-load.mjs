/* probe-finance-says-it-could-not-load.mjs — guards the 2026-09-19 (fire #97) fix in js/16.

   The round asked what the app does when a read simply FAILS — the team is often on mobile data or
   behind a company proxy. Driven against the real database with one table at a time answering 503:
   the leads load is honest and blocks sign-in with "Could not load leads: service unavailable", and
   Finance does report the failure too. Two things were wrong with how it reported it.

   1. Both of its cards were English only. The sentence directly above them was made bilingual in
      fire #78 and these two were left behind, so an Arabic reader got "Loading the finance ledger…"
      and "Could not load: …" in English.

   2. The advice was a guess. "Make sure you are signed in" was written in fire #56 for the one cause
      that really was a missing session. Every other cause — the server refusing, the connection
      dropping, a proxy in the way — is likelier, and the person IS signed in: it sent them off to
      sign out and back in for nothing while the real reason went unsaid. It is now offered only
      when there genuinely is no session; otherwise the card says nothing was loaded, warns against
      reading a figure off the page, and offers a button that tries again.

   Note for anyone re-driving this by hand: the error takes five to eight seconds to appear, because
   supabase-js retries a 503 several times first. An earlier run of this same round read the page at
   three seconds, saw "Loading the finance ledger…" and recorded a defect that was not there.

   Sabotage-tested: with the js/16 edit reverted, 7 checks go FAIL, exit 1.
   Run: node scripts/qa/probe-finance-says-it-could-not-load.mjs                                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9074; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  let refuseLedger = true;            /* flipped once the failure has been shown */
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    if (refuseLedger && /\/rest\/v1\/finance_invoices/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      await r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'service unavailable' }) }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof FIN !== 'undefined', { timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { current = 'finance'; render(); } catch (_) { } });

  /* the loading card, read while it is genuinely on screen */
  const loadingText = await p.evaluate(() => ((document.getElementById('view') || document.body).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120));

  /* the error takes several seconds: supabase-js retries the 503 before giving up */
  let failed = null;
  try {
    await p.waitForFunction(() => typeof FIN !== 'undefined' && !!FIN.loadErr, { timeout: 60000 });
    await p.waitForTimeout(1200);
    failed = await p.evaluate(() => ({
      signedIn: !!window.__finSessionOk,
      text: ((document.getElementById('view') || document.body).innerText || '').replace(/\s+/g, ' ').trim(),
      hasRetry: !!document.querySelector('#view button[onclick*="finRetryLoad"]'),
    }));
  } catch (e) { failed = { timedOut: String(e.message).slice(0, 60) }; }

  /* press Try again with the read still failing — it must fail again, not go blank */
  let again = null;
  if (failed && failed.hasRetry) {
    await p.evaluate(() => { try { FIN.loadErr = null; FIN.rows = null; window.finRetryLoad(); } catch (_) { } });
    await p.click('#view button[onclick*="finRetryLoad"]').catch(() => { });
    try { await p.waitForFunction(() => typeof FIN !== 'undefined' && !!FIN.loadErr, { timeout: 60000 }); again = 'failed again, as it should'; }
    catch (_) { again = 'NOTHING HAPPENED'; }
    await p.waitForTimeout(800);
  }

  /* now let the ledger through and press it again: it must actually load */
  refuseLedger = false;
  let recovered = null;
  if (failed && failed.hasRetry) {
    await p.click('#view button[onclick*="finRetryLoad"]').catch(() => { });
    try {
      await p.waitForFunction(() => typeof FIN !== 'undefined' && Array.isArray(FIN.rows) && FIN.rows.length > 0 && !FIN.loadErr, { timeout: 60000 });
      await p.waitForTimeout(1500);
      recovered = await p.evaluate(() => ({ rows: FIN.rows.length, text: ((document.getElementById('view') || document.body).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120) }));
    } catch (e) { recovered = { failed: String(e.message).slice(0, 60) }; }
  }
  await ctx.close();
  return { loadingText, failed, again, recovered };
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN loading card :', JSON.stringify(en.loadingText.slice(0, 60)));
console.log('  EN error card   :', JSON.stringify((en.failed && en.failed.text || '').slice(0, 130)));
console.log('  AR loading card :', JSON.stringify(ar.loadingText.slice(0, 60)));
console.log('  AR error card   :', JSON.stringify((ar.failed && ar.failed.text || '').slice(0, 130)));
console.log('  retry while still failing:', en.again, '· after the read recovers:', JSON.stringify(en.recovered));

const ARABIC = /[؀-ۿ]/;
const checks = [
  ['the failure really reached the screen in both languages, so nothing below passes by absence',
    !!(en.failed && en.failed.text && ar.failed && ar.failed.text)],
  ['the session really was alive — this is the case where blaming sign-in would be wrong',
    en.failed.signedIn === true && ar.failed.signedIn === true],
  ['it does NOT tell a signed-in person to make sure they are signed in', !/signed in|تسجيل الدخول/i.test(en.failed.text) && !/signed in|تسجيل الدخول/i.test(ar.failed.text)],
  ['it says plainly that nothing loaded, so no figure on the page is taken as fact',
    /Nothing was loaded/i.test(en.failed.text) && /لم يُحمَّل/.test(ar.failed.text)],
  ['and it names what went wrong rather than only that something did', /service unavailable/i.test(en.failed.text) && /service unavailable/i.test(ar.failed.text)],
  ['the Arabic card is in Arabic', ARABIC.test(ar.failed.text) && !/Could not load/i.test(ar.failed.text)],
  ['the Arabic loading card is in Arabic too — it was English until this fix', ARABIC.test(ar.loadingText) && !/Loading the finance ledger/i.test(ar.loadingText)],
  ['the English cards are still English', /Could not load/i.test(en.failed.text) && !ARABIC.test(en.loadingText)],
  ['there is a Try again button', en.failed.hasRetry === true && ar.failed.hasRetry === true],
  ['pressing it while the read is still down fails again rather than going quiet', en.again === 'failed again, as it should'],
  ['and once the read recovers, pressing it really loads the ledger', !!(en.recovered && en.recovered.rows > 0)],
  ['none of this wrote anything', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
