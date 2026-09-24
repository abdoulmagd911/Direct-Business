/* probe-an-empty-mirror-points-at-the-ledger.mjs — the Invoices page does not say "nothing from
   Direct" while the Finance ledger holds invoices from Direct; it says where they are.

   Fire #242. Driven live: the sidebar's "Invoices" entry — the obvious name for someone looking
   for an invoice — opened on **"Nothing has been brought in from Direct yet"** and **"BILLED 0 SAR"**.
   Two clicks away, Finance held 46 invoices captured from the Direct Payments export registry,
   worth over 2 M SAR of revenue. The layer that prints that line (js/94, fire #175) even says in
   its own header that the ledger holds 46 invoices — and then printed a sentence that contradicts
   it. An empty page was speaking for a system that is not empty, which is exactly what #175 was
   written to stop.

   Invoices now asks the ledger through finLive() — the same gate Finance reads through, so the
   number is Finance's own — and answers one of three honest ways: the count and a button to Finance
   when the ledger holds rows; the original line when it is empty (then true); and neither claim
   while the rows are still on their way. Bookings and Tickets have no ledger and keep their line.

   What this holds:
     1. with the ledger holding rows and this page empty, the line names the count and says they
        are on the Finance page;
     2. the count is the ledger's LIVE count — a soft-deleted invoice is not counted. This is the
        brake that matters: the number on the Invoices page must be the number on Finance;
     3. the button goes to Finance;
     4. the old claim — "nothing has been brought in from Direct yet" — is not on the page while the
        ledger has rows;
     5. with an EMPTY ledger the original line comes back, because it is then true;
     6. brake: with this page holding records of its own, no line at all (#175's rule, untouched);
     7. Bookings and Tickets keep their original wording — the change is scoped to the one page
        that has a ledger behind it;
     8. in Arabic the line is Arabic and carries the number;
     9. no JS errors.

   Sabotage-tested against COPIES of the app (APP_DIR — the repository untouched), two real runs:
     · the ledger not consulted at all (ledgerState returns "none") — fails 1, 2, 3, 4 and 8: the
       old sentence is back on the Invoices page, with no count and no button;
     · the count read from FIN.rows instead of finLive() — fails 1, 2 and 8: five invoices claimed
       where Finance shows three, because two soft-deleted rows were counted.
   Run: node scripts/qa/probe-an-empty-mirror-points-at-the-ledger.mjs                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
/* PORTS_RESERVED: 9267 — one mock. */
const PORT = 9267; const BASE = 'http://localhost:' + PORT;

const mk = (n, x) => Object.assign({
  id: 'f0000000-0000-4000-8000-00000000024' + n, invoice_no: 'QA242-' + n,
  client_group: 'QA Client', customer_raw_name: 'QA Client', invoice_date: '2026-05-1' + n,
  month: 'May', quarter: 'Q2', year: 2026, products: 'QA service', service_type: 'Other',
  record_type: 'invoice', total_incl_vat_sar: 1000, wallet_portion_sar: 0,
  revenue_sar: 1000, cost_sar: 600, profit_sar: 400, amount_received_sar: 1000,
  amount_remaining_sar: 0, integrity_status: 'verified_paid', revenue_way: 'invoice',
  deleted_at: null, vat_sar: null,
}, x || {});
/* three live, two soft-deleted: Finance shows 3, and so must this page */
const LEDGER_ROWS = [mk(1), mk(2), mk(3), mk(4, { deleted_at: '2026-08-22T00:00:00Z' }), mk(5, { deleted_at: '2026-08-22T00:00:00Z' })];
const LIVE_N = LEDGER_ROWS.filter((r) => !r.deleted_at).length;

const biz = { id: 'b1', legacy_id: 'B1', name: 'QA Lead One', stage: 'contacted', is_client: false, archived_at: null,
  raw: {}, funnel_details: {}, created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z' };
const srv = start(PORT, {
  businesses: [biz], contacts: [], activities: [],
  app_state: [{ id: 1, data: { bookings: [], invoices: [], meta: { name: 'QA' }, schemaVersion: 3, settings: {} } }],
});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function run(lang, ledger, fillOwn) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('dbLang', l); } catch (_) {} }, lang);
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(lang + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (u.pathname === '/rest/v1/finance_invoices' && m === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ledger) }); return; }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {};
      resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd });
    } catch (_) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(BASE + '/bookings', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
  await p.waitForTimeout(4000);

  const look = () => p.evaluate(() => {
    const v = document.getElementById('view'); const el = v && v.querySelector('.v94-empty');
    return { line: !!el, ledger: el ? el.getAttribute('data-v94-ledger') : null,
             text: el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '',
             hasButton: !!(el && el.querySelector('button')) };
  });

  await p.evaluate((fill) => { try {
    DB.bookings = []; DB.invoices = fill ? [{ id: 'iv1', no: 'QA-1', client: 'QA Client', total: 1000, status: 'Paid' }] : [];
    current = 'invoices'; openLead = null; render();
  } catch (_) {} }, !!fillOwn);
  /* the ledger arrives after the page does — wait until the line is no longer "loading", or is
     absent because the page holds its own records */
  await p.waitForFunction(() => { const el = document.querySelector('#view .v94-empty');
    return !el || el.getAttribute('data-v94-ledger') !== 'loading'; }, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800);
  const invoices = await look();

  let landed = null;
  if (invoices.hasButton) {
    await p.evaluate(() => { const bt = document.querySelector('#view .v94-empty button'); if (bt) bt.click(); });
    await p.waitForTimeout(1500);
    landed = await p.evaluate(() => (typeof current !== 'undefined') ? current : null);
  }

  const others = {};
  for (const pg of ['bookings', 'tickets']) {
    await p.evaluate((r) => { try { current = r; openLead = null; render(); } catch (_) {} }, pg);
    await p.waitForTimeout(1800);
    others[pg] = await look();
  }
  await ctx.close();
  return { invoices, landed, others, errors };
}

const bad = []; const fail = (n, d) => { console.log('FAIL · ' + n + (d ? ' — ' + d : '')); bad.push(n); };
const pass = (n, d) => console.log('PASS · ' + n + (d ? ' — ' + d : ''));

const en = await run('en', LEDGER_ROWS, false);
const ar = await run('ar', LEDGER_ROWS, false);
const emptyLedger = await run('en', [], false);
const own = await run('en', LEDGER_ROWS, true);
await b.close(); srv.close?.();

console.log('  four runs: ledger of ' + LEDGER_ROWS.length + ' rows (' + LIVE_N + ' live) in EN and AR, an empty ledger, and a page holding its own record');

const OLD = /Nothing has been brought in from Direct yet/i;
const countRe = new RegExp('\\b' + LIVE_N + ' invoices? captured from Direct are on the Finance page', 'i');

(en.invoices.line && countRe.test(en.invoices.text))
  ? pass('with the ledger holding rows, the line names the count and says they are on the Finance page', JSON.stringify(en.invoices.text.slice(0, 90)))
  : fail('with the ledger holding rows, the line names the count and says they are on the Finance page', JSON.stringify(en.invoices));

(en.invoices.ledger === String(LIVE_N))
  ? pass('the count is the ledger\'s LIVE count — soft-deleted invoices are not counted', LIVE_N + ' of ' + LEDGER_ROWS.length + ' rows')
  : fail('the count is the ledger\'s LIVE count — soft-deleted invoices are not counted', JSON.stringify({ ledger: en.invoices.ledger, expected: LIVE_N }));

(en.invoices.hasButton && en.landed === 'finance')
  ? pass('the button goes to Finance')
  : fail('the button goes to Finance', JSON.stringify({ button: en.invoices.hasButton, landed: en.landed }));

(!OLD.test(en.invoices.text))
  ? pass('the old claim is not on the page while the ledger has rows')
  : fail('the old claim is not on the page while the ledger has rows', JSON.stringify(en.invoices.text.slice(0, 90)));

(emptyLedger.invoices.line && OLD.test(emptyLedger.invoices.text) && emptyLedger.invoices.ledger === '0')
  ? pass('with an empty ledger the original line comes back, because it is then true', JSON.stringify(emptyLedger.invoices.text.slice(0, 60)))
  : fail('with an empty ledger the original line comes back, because it is then true', JSON.stringify(emptyLedger.invoices));

(!own.invoices.line)
  ? pass('brake: with this page holding its own records, no line at all')
  : fail('brake: with this page holding its own records, no line at all', JSON.stringify(own.invoices));

(['bookings', 'tickets'].every((k) => en.others[k].line && OLD.test(en.others[k].text) && !en.others[k].hasButton))
  ? pass('Bookings and Tickets keep their original wording — the change is scoped to the page with a ledger')
  : fail('Bookings and Tickets keep their original wording — the change is scoped to the page with a ledger', JSON.stringify(en.others));

(ar.invoices.line && /[؀-ۿ]/.test(ar.invoices.text) && ar.invoices.text.indexOf(String(LIVE_N)) >= 0 && /المالية/.test(ar.invoices.text) && !/[A-Za-z]{4,}/.test(ar.invoices.text.replace(/QA/g, '')))
  ? pass('in Arabic the line is Arabic and carries the number', JSON.stringify(ar.invoices.text.slice(0, 70)))
  : fail('in Arabic the line is Arabic and carries the number', JSON.stringify(ar.invoices.text));

const errs = en.errors.concat(ar.errors, emptyLedger.errors, own.errors);
errs.length === 0 ? pass('no JS errors') : fail('no JS errors', errs.slice(0, 2).join(' | '));

process.exit(bad.length ? 1 : 0);
