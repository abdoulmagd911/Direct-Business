/* probe-the-ledger-says-it-could-not-load.mjs — "the ledger is empty, not filtered" must be true.

   Found on 2026-09-21 (fire #158) by failing one request on purpose against the real database. The
   Finance → Ledger tab already distinguishes three situations carefully, and says each in its own
   sentence: the ledger is empty; every row is hidden by the exclusion rule; the filters hide the
   rows that are there. There is a fourth, and it was wearing the first one's words:

       No transactions recorded yet — the ledger is empty, not filtered.

   …printed after the transactions request FAILED. `txnLoad` turned an error into `TXN.rows=[]`,
   exactly as js/72's people bridge did before fire #155, and a sentence written to reassure —
   "empty, NOT filtered" — became the most confident wrong statement on the money screen. Beside it
   sat "Confirmed revenue 0 SAR · Confirmed cost 0 SAR · Confirmed profit 0 SAR": three money
   figures of zero, presented as facts, because a request did not come back.

   The Finance page already knows how to do this properly — when the invoices fail it says "Nothing
   was loaded — do not read any figure from this page until it loads" and shows nothing else. This
   holds the Ledger tab to the same standard.

   What this holds:
     1. when the transactions request fails, the tab does NOT claim the ledger is empty;
     2. it says it could not load, and offers a way to try again;
     3. and it does NOT print a money figure of zero as a fact — nothing is shown at all;
     4. in Arabic too;
     5. when the request succeeds and there are genuinely none, the ordinary sentence comes back —
        the two states must stop looking the same;
     6. and when there ARE transactions they render, so the outage card never swallows real rows.

   Checks 5 and 6 are what keep it from being a blanket: the cheap way to pass 1-3 is to stop
   trusting the ledger at all.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): restoring
   `if(r.error){ TXN.rows=[]; }` without remembering the failure fails checks 1, 2, 3 and 4, and
   check 1 prints the sentence it should not have said.
   Run: node scripts/qa/probe-the-ledger-says-it-could-not-load.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9109; const BASE = 'http://localhost:' + PORT;

const srv = start(PORT, {});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

/* mode: 'fail' → the request errors; 'empty' → it succeeds with no rows; 'rows' → it passes through */
async function run(lang, mode) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  await p.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  p.on('pageerror', (e) => errors.push(lang + '/' + mode + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (/\/rest\/v1\/finance_transactions/.test(u.pathname) && ['GET', 'HEAD'].includes(m)) {
      if (mode === 'fail') { await r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated outage' }) }); return; }
      if (mode === 'empty') { await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Content-Range': '0-0/0' }, body: '[]' }); return; }
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
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
  await p.waitForFunction(() => typeof render === 'function', { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { openLead = null; current = 'finance'; render(); } catch (_) { } });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { try { finGo('ledger'); } catch (_) { } });
  await p.waitForTimeout(3500);
  const out = await p.evaluate(() => {
    const v = document.getElementById('view');
    const t = (v.innerText || '').replace(/\s+/g, ' ');
    return { txt: t,
      rows: v.querySelectorAll('tbody tr').length,
      retry: /try again|أعد المحاولة/i.test(t),
      zeroMoney: /Confirmed revenue 0|الإيراد المؤكد 0/i.test(t) };
  });
  await ctx.close();
  return out;
}

const fail = await run('en', 'fail');
const failAr = await run('ar', 'fail');
const empty = await run('en', 'empty');
const rows = await run('en', 'rows');
await b.close(); srv.close?.();

const EMPTY_EN = /the ledger is empty, not filtered/i;
const EMPTY_AR = /\u0627\u0644\u0633\u062c\u0644 \u0641\u0627\u0631\u063a/;          /* «السجل فارغ» */
const COULDNT_AR = /\u062a\u0639\u0630\u0651\u0631|\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u062d\u0645\u064a\u0644/;  /* «تعذّر» / «لم يتم التحميل» */
const checks = [
  ['with the request failing, the tab does not claim the ledger is empty',
    !EMPTY_EN.test(fail.txt), (fail.txt.match(/No transactions[^.]{0,70}\./) || [''])[0]],
  ['it says it could not load, and offers a way to try again',
    /could not load/i.test(fail.txt) && fail.retry, (fail.txt.match(/Could not load[^.]{0,80}\./) || [''])[0]],
  ['and it does not print a money figure of zero as a fact',
    !fail.zeroMoney, fail.txt.slice(0, 100)],
  ['in Arabic too — it says so in Arabic, and does not print the Arabic "the ledger is empty"',
    COULDNT_AR.test(failAr.txt) && !EMPTY_AR.test(failAr.txt) && !failAr.zeroMoney,
    failAr.txt.slice(0, 90)],
  ['when it succeeds with none, the ordinary sentence comes back — the two states must differ',
    EMPTY_EN.test(empty.txt) && !/could not load/i.test(empty.txt), (empty.txt.match(/No transactions[^.]{0,70}\./) || [''])[0]],
  ['and when there are transactions they render — the outage card never swallows real rows',
    rows.rows >= 2 && !/could not load/i.test(rows.txt), rows.rows + ' rows on screen'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
