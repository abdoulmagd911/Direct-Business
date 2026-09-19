/* probe-import-does-not-call-a-deleted-invoice-present.mjs — guards the 2026-09-19 (fire #102) fix
   in js/41, the Direct Payments import path.

   `finLoad()` selects finance_invoices with NO deleted_at filter on purpose — the Ledger offers
   Restore — so FIN.rows carries soft-deleted rows. The live database holds **45 of them today, and
   not one of those 45 numbers also has a live row**, so every one of them hit this path.

   js/41 built its "already imported" index from every row in FIN.rows, deleted ones included. Drop
   the same export again after deleting an invoice and the preview said
       ↩ Skipped (already in the ledger): 1
   which is not true of a row that was deleted. It is not in the ledger. Nothing said its number had
   ever been seen, and nothing said why it had not come back.

   js/65 — the oversight lane — fixed exactly this on 2026-09-02, and its comment records the owner's
   own words: "I deleted it, dropped the file again, it said updated, and the invoice never came
   back." This import path kept the unfixed twin. The line directly below the broken index already
   checked `!r.deleted_at` for its own purposes, so the distinction was known here and simply not
   applied.

   Deleted numbers are now kept apart and reported in plain words, never counted as ordinary
   duplicates and never silently resurrected — restoring one is the owner's decision. A number that
   has BOTH a live and a deleted row is still matched on the live one.

   Driven against the real database before the fix and after: 45 deleted rows / 46 live in memory,
   and re-importing a real deleted number now reads "Left alone — you deleted these invoice numbers
   before: 1". Everything in THIS file is invented; no real invoice number appears (rule 7).

   Sabotage-tested (measured 2026-09-19, with the index reverted to its one pre-fix line and only
   the test hook kept so the preview still runs): 4 checks go FAIL, exit 1 — "Skipped (already in
   the ledger)" reads 2 instead of 1, and the deleted line never appears, in either language.
   Run: node scripts/qa/probe-import-does-not-call-a-deleted-invoice-present.mjs                    */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9079; const srv = start(PORT); const BASE = 'http://localhost:' + PORT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = []; const wrote = [];

async function run(lang) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 950 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) { } }, lang);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(lang + ': ' + e.message));
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      wrote.push(u.pathname.replace('/rest/v1/', '')); await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof window.__v41_runDP === 'function' && window.FIN && Array.isArray(FIN.rows), { timeout: 120000 });
  await p.waitForTimeout(3000);

  const out = await p.evaluate(() => {
    /* three invented numbers: one already in the ledger, one the owner deleted, one brand new */
    const LIVE = 'QA-LIVE-1', DEL = 'QA-DELETED-1', NEW = 'QA-NEW-1';
    const base = (FIN.rows && FIN.rows[0]) ? JSON.parse(JSON.stringify(FIN.rows[0])) : {};
    const mk = (no, del) => Object.assign({}, base, { id: 'qa_' + no, invoice_no: no, client_group: 'QA Fixture Company', deleted_at: del ? '2026-09-01T00:00:00Z' : null });
    FIN.rows = (FIN.rows || []).concat([mk(LIVE, false), mk(DEL, true)]);

    const HEAD = ['Type', 'Invoice Reference #', 'Invoice Number', 'Invoice Create Date', 'Invoice Status',
      'Customer Name', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Invoice Total', 'Sale Branch', 'Salesman'];
    const pair = (no) => ([
      ['invoice', no, no, '2026-03-14', 'Paid', 'QA Fixture Company', 'Flights', '', '', '', '', '1150.00', 'QA Branch', 'QA Seller'],
      ['item', no, '', '', '', 'QA Fixture Company', 'Flights', 'Service fee', 'Yes', '0', '1150.00', '1150.00', 'QA Branch', 'QA Seller'],
    ]);
    const rows2d = [HEAD].concat(pair(LIVE), pair(DEL), pair(NEW));

    let box = document.getElementById('finImpOut');
    if (!box) { box = document.createElement('div'); box.id = 'finImpOut'; document.body.appendChild(box); }
    box.innerHTML = '';
    try { window.__v41_runDP(rows2d); } catch (e) { return { err: String(e.message) }; }
    return { text: (box.innerText || '').replace(/\s+/g, ' ').trim(), seeded: { LIVE, DEL, NEW } };
  });
  await ctx.close();
  return out;
}

const en = await run('en');
const ar = await run('ar');
await b.close(); srv.close?.();
console.log('  EN preview:', JSON.stringify(String(en.text || en.err).slice(0, 320)));
console.log('  AR preview:', JSON.stringify(String(ar.text || ar.err).slice(0, 320)));

const num = (t, re) => { const m = String(t || '').match(re); return m ? Number(m[1]) : null; };
const enReady = num(en.text, /Ready to import:\s*(\d+)/);
const enSkipped = num(en.text, /already in the ledger\):\s*(\d+)/);
const enDeleted = num(en.text, /you deleted these invoice numbers before:\s*(\d+)/);
const arDeleted = num(ar.text, /أرقام فواتير سبق أن حذفتها:\s*(\d+)/);
const checks = [
  ['the preview really ran in both languages, so nothing below passes by absence', !!en.text && !!ar.text && !en.err && !ar.err],
  ['the one brand-new invoice is the only one offered for import', enReady === 1],
  ['the number already in the ledger is reported as already there — exactly one', enSkipped === 1],
  ['the number the owner DELETED is reported separately, not as "already in the ledger"', enDeleted === 1],
  ['and it is said in plain words: left alone, nothing written, restoring is the owner\'s decision',
    /Left alone/i.test(en.text) && /not in the ledger/i.test(en.text) && /your decision/i.test(en.text)],
  ['Arabic says the same thing in Arabic', arDeleted === 1 && /لم تُلمس/.test(ar.text) && !/Left alone/i.test(ar.text)],
  ['previewing wrote nothing', wrote.filter((w) => !/finance_client_links/.test(w)).length === 0],
  ['no JS errors', errors.length === 0],
];
let fail = 0; for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n); if (!ok) fail++; }
if (fail) { console.log('detail:', JSON.stringify({ enReady, enSkipped, enDeleted, arDeleted, en, ar }, null, 1)); if (errors.length) console.log('errors:', errors.slice(0, 5)); }
process.exit(fail ? 1 : 0);
