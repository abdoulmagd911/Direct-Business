/* probe-empty-mirrors-do-not-speak-for-direct.mjs — an empty page must not report zeros in another
   system's name.

   Fire #175. Bookings, Invoices and Tickets mirror records that Direct owns. Driven live, each one
   printed a row of confident totals — "INVOICES 0 · BILLED 0 SAR · PAID 0 · OUTSTANDING 0 · ZATCA
   CLEARED 0/0", "BOOKINGS 0 · TOTAL SALE 0 SAR", "TICKETS 0 · OPEN 0 · REFUNDED 0" — under a banner
   reading **"Live from the Direct system — read-only."**

   Nothing is live. The Sync page of this same app says so outright: "Live two-way sync arrives with
   the hosted backend phase." There is no connection to Direct; the lists are empty because nothing
   has ever been brought in. The company's own finance ledger holds 46 invoices, so "BILLED 0 SAR"
   was not even this app's own answer.

   So a person opening Invoices was told the figures came live from the system of record, and that
   the system of record had billed nothing. Both halves were false.

   Two fixes: the banner no longer claims to be live (core-08 — it now says Direct is the system of
   record and this is read-only, true either way), and js/94 says, above the totals, that nothing
   has been brought in.

   What this holds, on each of the three pages:
     1. the banner no longer says the page is live from Direct;
     2. it still says Direct is the system of record and this page is read-only — the useful half
        was not thrown away with the false half;
     3. while the page holds nothing, a line says so before the totals are read;
     4. that line says the zeros are not Direct's figures — the specific wrong conclusion;
     5. the line comes BEFORE the totals in reading order, not below them;
     6. **the line disappears once the page holds records**, so it cannot become furniture the day
        an import or a real sync arrives;
     7. in Arabic the line is Arabic;
     8. no JS errors.

   Check 6 is the brake, and check 2 stops the banner fix from becoming a deletion.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/94's
   script line fails checks 3, 4, 5 and 7; restoring the old banner wording fails check 1.
   Run: node scripts/qa/probe-empty-mirrors-do-not-speak-for-direct.mjs                           */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9148; const BASE = 'http://localhost:' + PORT;

const row = (o) => Object.assign({
  id: 'x', legacy_id: 'X', name: 'X', name_ar: '', source: 'Import', stage: 'contacted', status: 'active',
  category: 'Corporate', segment: 'MICE / Events', assigned_to: 'QA Test Account', account_manager: 'QA Test Account',
  tier: 'B', entity_type: null, legal_name: '', cr_vat: '', payment_terms: null, credit_limit: null,
  contract_start: null, contract_end: null, contract_scope: null, contract_sla: '', next_review: null, total_sar: 0,
  website: '', corp_email_flag: 'no', is_client: false, converted_date: null, direct_client_id: null,
  channels: [], prefs: {}, airline_deals: [], pricing: [], notes: null, created_at: '2026-02-01T10:00:00Z',
  updated_at: '2026-02-01T10:00:00Z', raw: {}, verification_source: null, needs_manual_confirmation: false,
  confirmation_reason: null, confirmed_by: null, confirmed_at: null, scrub_run_id: null, funnel_id: null,
  funnel_details: {}, stage_legacy: null, next_action_date: null, next_action_note: '', archived_at: null,
}, o);

const srv = start(PORT, {
  businesses: [row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' })], contacts: [], activities: [],
  app_state: [{ id: 1, data: { bookings: [], invoices: [], meta: { name: 'QA' }, schemaVersion: 3, settings: {} } }],
});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

await p.goto(BASE + '/bookings', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
await p.waitForTimeout(4000);

async function look(page, emptyIt) {
  await p.evaluate(({ pg, empty }) => { try {
    if (empty) { DB.bookings = []; DB.invoices = []; }
    current = pg; openLead = null; render();
  } catch (_) { } }, { pg: page, empty: emptyIt });
  await p.waitForTimeout(2400);
  return p.evaluate(() => {
    const v = document.getElementById('view');
    const line = v.querySelector('.v94-empty');
    const banner = v.querySelector('.ro-sync-banner');
    const txt = (v.innerText || '').replace(/\s+/g, ' ');
    const lineTxt = line ? (line.innerText || '').replace(/\s+/g, ' ').trim() : '';
    /* is the line above the totals in reading order? */
    const firstTotal = txt.search(/BOOKINGS|INVOICES|TICKETS \d|TOTAL SALE|BILLED/);
    const linePos = lineTxt ? txt.indexOf(lineTxt.slice(0, 24)) : -1;
    return { line: !!line, lineTxt,
      banner: banner ? (banner.innerText || '').replace(/\s+/g, ' ').trim() : '',
      beforeTotals: linePos >= 0 && (firstTotal < 0 || linePos < firstTotal) };
  });
}

const empty = {};
for (const pg of ['bookings', 'invoices', 'tickets']) empty[pg] = await look(pg, true);

/* now give the page records — the line must go */
await p.evaluate(() => { try {
  DB.bookings = [{ id: 'bk1', ref: 'QA-1', client: 'QA Client', totalSale: 1000, status: 'Confirmed', tickets: [] }];
  DB.invoices = [{ id: 'iv1', no: 'QA-1', client: 'QA Client', total: 1000, status: 'Paid' }];
} catch (_) { } });
const filled = {};
for (const pg of ['bookings', 'invoices']) filled[pg] = await look(pg, false);

await p.evaluate(() => { try { DB.bookings = []; DB.invoices = [];
  LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) { } });
const arabic = await look('invoices', true);
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const all = ['bookings', 'invoices', 'tickets'];
const checks = [
  ['the banner no longer says the page is live from Direct',
    all.every((k) => !/live from the direct/i.test(empty[k].banner)),
    all.map((k) => k + ': ' + empty[k].banner.slice(0, 46)).join(' | ')],
  ['it still says Direct is the system of record, and read-only',
    all.every((k) => /system of record/i.test(empty[k].banner) && /read-only/i.test(empty[k].banner)),
    empty.invoices.banner.slice(0, 80)],
  ['while the page holds nothing, a line says so', all.every((k) => empty[k].line),
    JSON.stringify(all.map((k) => empty[k].line))],
  ['that line says the zeros are not Direct\'s figures',
    all.every((k) => /not Direct’s figures|not Direct's figures/i.test(empty[k].lineTxt)),
    empty.invoices.lineTxt.slice(0, 110)],
  ['the line comes before the totals', all.every((k) => empty[k].beforeTotals),
    JSON.stringify(all.map((k) => empty[k].beforeTotals))],
  ['the line disappears once the page holds records',
    !filled.bookings.line && !filled.invoices.line,
    JSON.stringify({ bookings: filled.bookings.line, invoices: filled.invoices.line })],
  ['in Arabic the line is Arabic', arabic.line && hasArabic(arabic.lineTxt), arabic.lineTxt.slice(0, 60)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
