/* probe-import-does-not-call-a-deleted-invoice-present.mjs — an invoice the owner DELETED must never
   be reported as one the app already has, on either of the two import paths. 2026-09-19, fire #102.

   `finLoad()` selects finance_invoices with NO deleted_at filter on purpose — the Ledger offers
   Restore — so FIN.rows carries soft-deleted rows. The live database holds **45 of them today, and
   not one of those 45 numbers also has a live row**.

   There are two paths, and they were not in the same state. READ THIS BEFORE CHANGING EITHER.

   1. THE PATH A PERSON USES. On the Import tab, js/65 replaces the drop zone node, sets the file
      input's own onchange and rewrites the "Check file" button to `v65CheckFiles()`, so every real
      drop goes to js/65's router. js/65 fixed the deleted case on 2026-09-02, and its comment
      records the owner's own words: "I deleted it, dropped the file again, it said updated, and the
      invoice never came back." A real drop was driven here and reads, correctly:
          Excluded by rule 1 — <no>: deleted in this app — restore it first, then re-import;
          nothing was written
      That is the behaviour on screen today, and the first half of this probe holds it there.

   2. THE FALLBACK. js/41 wraps `window.finParse` — js/16's older single-file checker — and that
      wrapper is what js/65's wiring supersedes. Its index was built from EVERY row in FIN.rows,
      deleted ones included, so it answered "↩ Skipped (already in the ledger): 1" for a row that is
      not in the ledger. Nothing said the number had ever been seen, and nothing said why it had not
      come back. The line directly below that index already checked `!r.deleted_at` for its own
      purposes: the distinction was known there and simply not applied.

      This was **not reachable from the Import tab as it is drawn today** — that was measured, by
      dropping a file, not assumed — so it is a landmine rather than a defect anyone was hitting.
      It was fixed anyway, because the whole point of a fallback is the day the thing in front of it
      does not wire, and js/65's wiring is itself only guarded by one probe.

   Deleted numbers are now kept apart on both paths and reported in plain words, never counted as
   ordinary duplicates and never silently resurrected — restoring one is the owner's decision. A
   number that has BOTH a live and a deleted row is still matched on the live one.

   Everything invented in THIS file is invented; the real-drop half reads a real deleted number out
   of the page and never prints it (rule 7).

   Sabotage-tested (measured 2026-09-19), both halves, each restored byte-for-byte afterwards:
     · fallback half — js/41's index reverted to its one pre-fix line, only the test hook kept so
       the preview still runs: 4 checks FAIL. "Skipped (already in the ledger)" reads 2 instead of
       1 and the deleted line never appears, in either language.
     · real-drop half — js/65's deleted branch disabled (read and run only, never committed; the
       oversight lane is not edited): 3 checks FAIL, and the preview reads "New 1 · Excluded by
       rule 0 · Confirm import — 1 new", offering to put the deleted invoice straight back. That
       is the owner's original complaint, reproduced on demand.
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

/* the other half: the path a person actually uses — a file really dropped on the Import tab, which
   js/65's wiring owns. No test hook is involved; if the wiring ever stopped owning it, the wiring
   check below says so instead of this quietly falling through to js/41. */
async function realDrop() {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'en-GB' });
  await ctx.addInitScript(() => { try { localStorage.setItem('dbLang', 'en'); } catch (_) { } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('drop: ' + e.message));
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
  await p.waitForFunction(() => window.FIN && Array.isArray(FIN.rows) && FIN.rows.length > 0, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { FIN.tab = 'import'; render(); } catch (_) { } });
  await p.waitForTimeout(2500);

  /* who owns the Import tab's file controls — measured, not assumed */
  const wiring = await p.evaluate(() => {
    const inp = document.getElementById('finFile'); const dz = document.getElementById('finDrop');
    const btn = [].slice.call(document.querySelectorAll('#view button')).find((x) => /finParse|v65CheckFiles/.test(x.getAttribute('onclick') || ''));
    return { input: !!inp, dropzone: !!dz, ownedByRouter: !!(dz && dz.__v65) && !!(inp && inp.onchange), button: btn ? btn.getAttribute('onclick') : null };
  });

  /* a REAL deleted number, read in the page and never printed (rule 7); the harness seed has none,
     so one is made — a check that never meets its own case is not a check */
  const seeded = await p.evaluate(() => {
    const live = {}; FIN.rows.forEach((r) => { if (r.invoice_no && !r.deleted_at) live[r.invoice_no] = 1; });
    let d = FIN.rows.find((r) => r.invoice_no && r.deleted_at && !live[r.invoice_no]);
    let invented = false;
    if (!d) { invented = true;
      d = Object.assign({}, FIN.rows[0], { id: 'qa_del_drop', invoice_no: 'QA-DELETED-DROP', deleted_at: '2026-09-01T00:00:00Z', client_group: 'QA Fixture Company' });
      FIN.rows = FIN.rows.concat([d]); }
    window.__qaNo = d.invoice_no; window.__qaCust = d.client_group || d.customer_raw_name || 'QA Fixture Company';
    return { invented };
  });

  const droppedOk = await p.evaluate(() => {
    const no = window.__qaNo, cust = window.__qaCust;
    const HEAD = ['Type', 'Invoice Reference #', 'Invoice Number', 'Invoice Create Date', 'Invoice Status',
      'Customer Name', 'Product', 'Name', 'Item Is Taxable', 'Item Discount', 'Item Total', 'Invoice Total', 'Sale Branch', 'Salesman'];
    const rows = [HEAD,
      ['invoice', no, no, '14/03/2026', 'Paid', cust, 'Direct Flights', '', '', '', '', '1150.00', 'QA Branch', 'QA Seller'],
      ['item', no, '', '', '', cust, 'Direct Flights', 'Service fee', 'Yes', '0', '1150.00', '1150.00', 'QA Branch', 'QA Seller']];
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const dt = new DataTransfer(); dt.items.add(new File([csv], 'dp-export.csv', { type: 'text/csv' }));
    const dz = document.getElementById('finDrop'); if (!dz) return false;
    dz.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  });
  await p.waitForTimeout(9000);
  const text = await p.evaluate(() => {
    const el = document.getElementById('finImpOut');
    let t = (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
    if (window.__qaNo) t = t.split(window.__qaNo).join('<INVOICE-NO>');   /* rule 7 */
    return t;
  });
  await ctx.close();
  return { wiring, seeded, droppedOk, text };
}

const en = await run('en');
const ar = await run('ar');
const drop = await realDrop();
await b.close(); srv.close?.();
console.log('  drop wiring:', JSON.stringify(drop.wiring));
console.log('  drop preview:', JSON.stringify(String(drop.text).slice(0, 320)));
console.log('  EN preview:', JSON.stringify(String(en.text || en.err).slice(0, 320)));
console.log('  AR preview:', JSON.stringify(String(ar.text || ar.err).slice(0, 320)));

const num = (t, re) => { const m = String(t || '').match(re); return m ? Number(m[1]) : null; };
const enReady = num(en.text, /Ready to import:\s*(\d+)/);
const enSkipped = num(en.text, /already in the ledger\):\s*(\d+)/);
const enDeleted = num(en.text, /you deleted these invoice numbers before:\s*(\d+)/);
const arDeleted = num(ar.text, /أرقام فواتير سبق أن حذفتها:\s*(\d+)/);
const checks = [
  /* the path a person uses: a file really dropped on the Import tab */
  ['a real drop on the Import tab is handled by the router, not by the older single-file checker',
    drop.wiring.input && drop.wiring.dropzone && drop.wiring.ownedByRouter && /v65CheckFiles/.test(String(drop.wiring.button))],
  ['dropping an export that contains a number the owner deleted really produced a preview',
    drop.droppedOk === true && String(drop.text).length > 20],
  ['and that preview refuses the deleted number instead of importing it or calling it already-there',
    /Excluded by rule/i.test(drop.text) && /deleted in this app/i.test(drop.text) && !/already/i.test(drop.text)],
  ['it says what to do about it, and that nothing was written',
    /restore it first/i.test(drop.text) && /nothing was written/i.test(drop.text)],
  ['nothing was imported from that file', /New 0/.test(drop.text)],
  /* the fallback path, driven directly */
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
