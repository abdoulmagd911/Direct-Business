/* probe-ledger-empty-speaks.mjs (2026-09-09, live test finding F1) — the Ledger's empty state
   must say WHY it is empty. Attack area (ad).

   PORT NOTE: 8701–8748 are taken. This is 8749, verified free by scanning every PORT= in
   scripts/qa.

   Found on the live site, by hand: the Ledger tab read "No transactions match." with 0
   transactions across 0 companies. Nothing matched because nothing was there — every row had been
   soft-deleted on 21 Aug (verified in the database) — but "match" tells a person a filter is
   hiding rows, and the person starts clearing filters that are not set. The Collections card on
   the Overview already says "none recorded yet" in the same situation.

   Under test, with the ledger driven through the app's own filters (TXN.f + render, the same
   path finTxnF uses):
     1. Ledger holds no rows at all → the sentence says the ledger is EMPTY and NOT FILTERED; the
        word "match" does not appear.
     2. Ledger holds rows, a filter hides them all → the sentence says the FILTERS hide them and
        states how many are recorded, so the person knows what clearing a filter brings back.
     3. Ledger holds rows and no filter is set (nothing hidden) → the normal table renders; no
        empty-state card at all. (Control: the empty card never appears with rows on screen.)
     4. Arabic: the same three situations carry Arabic sentences, and the empty-ledger one does
        not say "مطابقة" (match).

   Run:  node scripts/qa/probe-ledger-empty-speaks.mjs        (port 8749)
   Sabotage: in rLedger's empty branch replace the three-way choice with the old single
   'No transactions match.' string AFTER the chain (overriding _msg — a sabotage that breaks the
   if/else syntax proves nothing, the page never loads) — checks 1, 2 and 4 go red (5 lines).
   Assert the sabotage APPLIED with a
   marker unique to it; confirm the restore by marker count and git status.  */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8749;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const srv = start(PORT, {});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  const p = await ctx.newPage();
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 120000 });
  try { await p.waitForSelector('#cl_email', { timeout: 90000 }); } catch (_) { }
  try { await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go'); } catch (_) { }
  if (!(await p.waitForFunction(() => typeof window.finGo === 'function' && Array.isArray(FIN.rows), { timeout: 90000 }).then(() => true).catch(() => false)))
    fail('finGo / FIN.rows never appeared, so nothing below examined anything');
  const settle = async () => { let last = '', same = 0; for (let i = 0; i < 30; i++) { const h = await p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerHTML.length : 0); if (h === last) { same++; if (same >= 2) return; } else same = 0; last = h; await p.waitForTimeout(150); } };

  /* Open the ledger once so TXN.rows / TXN.profiles exist, then take the rows over. */
  await p.evaluate(() => { if (window.finGo) finGo('ledger'); });
  for (let i = 0; i < 40 && !(await p.evaluate(() => window.TXN && TXN.rows && TXN.profiles)); i++) await p.waitForTimeout(250);
  await settle();

  const setRows = (rows) => p.evaluate((rows) => {
    TXN.rows = rows.map((r, i) => Object.assign({ id: 'le-' + i, business_id: r.biz, client_profile_id: null, transaction_ref: 'LE-' + i, amount_sar: r.amt, cost_confirmed_sar: 0, cost_estimate_sar: 0, expense_status: 'ready', invoice_no: '', product: 'Flights', deleted_at: null }, r.extra || {}));
    TXN.f = { q: '', profileType: 'all', business: 'all', stage: 'all' };
    if (window.finGo) finGo('ledger'); else render();
  }, rows);
  const setFilter = (k, v) => p.evaluate((c) => { finTxnF(c.k, c.v); }, { k, v });
  const readEmpty = () => p.evaluate(() => {
    const e = document.querySelector('#view #txn-empty');
    const tables = document.querySelectorAll('#view table').length;
    return { present: !!e, text: e ? e.textContent.trim() : '', held: e && e.getAttribute('data-held'), live: e && e.getAttribute('data-live'), filtered: e && e.getAttribute('data-filtered'), tables, viewText: (document.querySelector('#view').innerText || '').replace(/\s+/g, ' ') };
  });

  /* ---- 1. nothing recorded at all ---- */
  await setRows([]); await settle();
  let e = await readEmpty();
  if (e.present && /empty/i.test(e.text) && /not filtered/i.test(e.text) && !/match/i.test(e.text))
    ok(`empty ledger says so: "${e.text}" — the word "match" is gone`);
  else fail(`empty ledger reads "${e.text || e.viewText.slice(0, 160)}" — expected "empty, not filtered" and no "match" (the live-site defect: 0 rows described as a filter miss)`);

  /* ---- 2. rows exist, a filter hides them all ---- */
  await setRows([{ biz: 'biz-A', amt: 1000 }, { biz: 'biz-A', amt: 2500 }, { biz: 'biz-B', amt: 300 }]); await settle();
  await setFilter('q', 'zzz-nothing-has-this-text'); await settle();
  e = await readEmpty();
  if (e.present && /filter/i.test(e.text) && /\b3\b/.test(e.text) && /recorded/i.test(e.text))
    ok(`filters hiding 3 rows: "${e.text}" — names the filters and the count`);
  else fail(`with 3 rows hidden by the search box the ledger reads "${e.text || e.viewText.slice(0, 160)}" — expected the filters named and "3 … recorded"`);
  await setFilter('q', ''); await setFilter('stage', 'overdue'); await settle();
  e = await readEmpty();
  if (e.present && /filter/i.test(e.text) && /\b3\b/.test(e.text)) ok(`a select filter (stage = overdue) gets the same sentence: "${e.text}"`);
  else fail(`stage filter hiding everything reads "${e.text || e.viewText.slice(0, 160)}"`);

  /* ---- 3. control: rows and no filter → the table, no empty card ---- */
  await setFilter('stage', 'all'); await settle();
  e = await readEmpty();
  if (!e.present && e.tables >= 1 && /biz-A|biz-B/.test(e.viewText)) ok('control: with rows and no filter the table renders and no empty-state card exists');
  else fail(`control: expected a table and no empty card, got present=${e.present} tables=${e.tables}`);

  /* ---- 4. Arabic ---- */
  await p.evaluate(() => { try { if (typeof setLang === 'function') setLang('ar'); else if (typeof applyLang === 'function') { LANG = 'ar'; applyLang(); } else { LANG = 'ar'; } } catch (_) { LANG = 'ar'; } });
  await setRows([]); await settle();
  e = await readEmpty();
  if (e.present && /فارغ/.test(e.text) && !/مطابقة/.test(e.text)) ok(`Arabic, empty ledger: "${e.text}"`);
  else fail(`Arabic empty ledger reads "${e.text || e.viewText.slice(0, 160)}" — expected "فارغ" and no "مطابقة"`);
  await setRows([{ biz: 'biz-A', amt: 1000 }, { biz: 'biz-B', amt: 300 }]); await settle();
  await setFilter('q', 'zzz-nothing'); await settle();
  e = await readEmpty();
  if (e.present && /الفلاتر|فلتر/.test(e.text) && /\b2\b/.test(e.text)) ok(`Arabic, filters hiding 2 rows: "${e.text}"`);
  else fail(`Arabic filtered-empty reads "${e.text || e.viewText.slice(0, 160)}"`);

  await b.close(); srv.close();
  if (failures) { console.log(`\nFAILED — ${failures} check(s) did not pass.`); process.exit(1); }
  console.log('\nledger-empty-speaks OK — an empty ledger says whether it is empty or filtered, and how much a filter hides');
  process.exit(0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
