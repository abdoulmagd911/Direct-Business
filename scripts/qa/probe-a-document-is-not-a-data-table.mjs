/* probe-a-document-is-not-a-data-table.mjs — a client's copy of a quotation is not a screen you
   page through.

   Fire #186. The app decorates tables with a pager: a row count, a "10 / page" dropdown, "Show all"
   and Prev/Next. `scan()` in js/04 walked `document.querySelectorAll('table')` — every table on the
   page — and the Generator's five client-facing documents are built out of tables. Read off the
   live database, the ARABIC technical proposal carried

       Showing 1–15 of 15 · [10 / page ▾] · ‹ Prev · Next ›

   inside `div.td-page.ar` — on the document a client receives, in English, on an Arabic document,
   and it prints.

   The worse half is silent. The page size is remembered per browser (`db_pageSize`), so anybody who
   had once chosen "10 / page" on the Leads list carried that into every document they generated: a
   fifteen-row fee table printed ten rows and dropped five, with nothing to say so but an English
   line the client would read as part of the document.

   What this holds:
     1. no table inside a generated document carries a pager bar;
     2. and no page of a generated document contains the pager's wording, in either language;
     3. a document shows EVERY row it has even when the remembered page size is 10 — the silent
        truncation is the part that could have gone out to a client;
     4. an ordinary data table still gets its pager — this is a convenience the team uses on long
        lists and it must not have been taken away;
     5. and that pager still counts and still truncates: N shown out of M, not M shown;
     6. the service-fee document's empty-state lines follow the DOCUMENT's language, not the app's.
        Both used `fl()`, which reads the app's, so an Arabic document carried an English
        instruction while the app was in English. There are two such lines and either satisfies
        this check, because the same fix covers both;
     7. and the English document still reads English, so the fix is not "always Arabic";
     8. no JS errors.

   Checks 4, 5 and 7 are the brakes: deleting the pager outright, or breaking its arithmetic, or
   flipping every document string to Arabic, would each pass the rest.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/04's
   document-page exclusion fails checks 1, 2 and 3; putting `fl()` back in js/68 fails check 6.
   Run: node scripts/qa/probe-a-document-is-not-a-data-table.mjs                                 */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9203; const BASE = 'http://localhost:' + PORT;

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

/* 24 companies, so the Leads table is long enough to deserve a pager (check 4) */
const BUSINESSES = [];
for (let i = 1; i <= 24; i++) BUSINESSES.push(row({ id: 'd' + i, legacy_id: 'D' + i, name: 'QA Doc Table Co ' + i }));

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-GB' });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
  const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
  const isRpc = /\/rpc\//.test(u.pathname);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state|next_document_number/.test(u.pathname))) {
    await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
  try { const resp = await fetch(BASE + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
    const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
    await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
});
await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());

/* the dangerous setting: somebody once chose "10 / page" on a list, and it is remembered */
await p.addInitScript(() => { try { localStorage.setItem('db_pageSize', '10'); } catch (_) {} });
await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForTimeout(3000);

const PAGER_WORDS = /Showing\s+\d|\/ page|Show all|Prev|Next\s*›|عرض\s+\d/;

async function document_(tab, lang, extraLines) {
  await p.evaluate((t) => { try { openLead = null; current = 'documents'; render(); } catch (_) {} setTimeout(() => { try { dgGo(t); } catch (_) {} }, 400); }, tab);
  await p.waitForTimeout(3600);
  await p.evaluate((want) => {
    const el = [].slice.call(document.getElementById('view').querySelectorAll('button'))
      .find((x) => (x.textContent || '').trim() === (want === 'ar' ? 'العربية' : 'English'));
    if (el) el.click();
  }, lang);
  await p.waitForTimeout(2200);
  if (extraLines && tab === 'offer') {
    /* 12 priced service lines, through the app's own row API. A line only becomes a row on the
       document once it carries a service name or a price — calc() in js/67 skips empty ones — so
       each is named and priced, which is what a real quotation would hold anyway. */
    await p.evaluate((n) => {
      try {
        for (let i = 0; i < n; i++) poLine('add');
        for (let i = 0; i < n + 1; i++) { poSetLine(i, 'svc', 'QA service ' + (i + 1)); poSetLine(i, 'qty', 1); poSetLine(i, 'price', 100 + i); }
      } catch (_) {}
    }, extraLines);
    await p.waitForTimeout(1800);
  }
  await p.evaluate(() => {
    const v = document.getElementById('view');
    const el = [].slice.call(v.querySelectorAll('button,[role=button],.step,a')).find((x) => /^3\s*·|Review|المراجعة/i.test((x.innerText || '').trim()));
    if (el) el.click();
  });
  await p.waitForTimeout(3200);
  return p.evaluate(() => {
    const pg = document.querySelector('[id$="Pages"]');
    if (!pg) return { missing: true };
    const rows = [].slice.call(pg.querySelectorAll('tbody tr'));
    return { id: pg.id,
      pagerBars: pg.querySelectorAll('.pg-bar').length,
      text: (pg.innerText || '').replace(/\s+/g, ' ').trim(),
      rowsTotal: rows.length,
      rowsHidden: rows.filter((r) => r.style.display === 'none').length,
      /* .sf-lead is ALSO the "About Direct" paragraph, so the class alone picks the wrong element —
         the first version of this probe read that one. Find the empty-state by its own words. */
      emptyLine: ([].slice.call(pg.querySelectorAll('.sf-lead'))
        .map((x) => (x.innerText || '').trim())
        .find((tx) => /Pick a scenario|appear here|اختر سيناريو|تظهر الجداول/.test(tx)) || '') };
  });
}

const docs = {};
for (const tab of ['offer', 'fees', 'contract', 'tender']) docs[tab] = await document_(tab, 'ar');
const feesEn = await document_('fees', 'en');
const twelve = await document_('offer', 'en', 11);   /* one blank line exists already */

/* an ordinary data table: 24 companies, page size 10 */
const list = await p.evaluate(() => {
  try { current = 'leads'; openLead = null; render(); } catch (_) {}
  return new Promise((res) => setTimeout(() => {
    const v = document.getElementById('view');
    const bar = v.querySelector('.pg-bar');
    const rows = [].slice.call(v.querySelectorAll('tbody tr'));
    res({ pager: !!bar, label: bar ? ((bar.querySelector('span') || {}).textContent || '').trim() : '',
      total: rows.length, shown: rows.filter((r) => r.style.display !== 'none').length });
  }, 2800));
});
await b.close(); srv.close?.();

/* The pager only attaches to a table with MORE THAN TEN rows (js/04 skips short ones), so the
   evidence has to be the TWELVE-row quotation. The first version of this probe judged only the
   four documents the harness can build, whose tables are all short — and it PASSED against a
   deliberately re-broken app. A check that cannot fire is worse than no check. The four short
   documents are still swept, as a second pass, but they are not the evidence. */
const all = Object.assign({}, docs, { 'offer (12 rows)': twelve });
const withBars = Object.entries(all).filter(([, d]) => !d.missing && d.pagerBars > 0).map(([t]) => t);
const withWords = Object.entries(all).filter(([, d]) => !d.missing && PAGER_WORDS.test(d.text)).map(([t]) => t);
const hasArabic = (s) => /[؀-ۿ]/.test(s || '');

const checks = [
  ['no table inside a generated document carries a pager bar, including a twelve-row one',
    Object.keys(all).length === 5 && Object.values(all).every((d) => !d.missing) &&
    twelve.rowsTotal > 10 && withBars.length === 0,
    (withBars.join(', ') || 'none') + ' · the long document had ' + twelve.rowsTotal + ' rows'],
  ['and no document page contains the pager\'s wording, in either language',
    withWords.length === 0 && twelve.rowsTotal > 10, withWords.join(', ') || 'none'],
  ['a document shows every row it has, with the remembered page size at 10',
    twelve.rowsTotal >= 12 && twelve.rowsHidden === 0,
    JSON.stringify({ rows: twelve.rowsTotal, hidden: twelve.rowsHidden })],
  ['an ordinary data table still gets its pager', list.pager === true, JSON.stringify(list.label)],
  ['and that pager still counts and still truncates',
    list.total === 24 && list.shown === 10 && /1[–-]10 of 24|1[–-]10 من 24/.test(list.label),
    JSON.stringify({ total: list.total, shown: list.shown, label: list.label })],
  ['an empty-state line on the Arabic fee document is Arabic',
    hasArabic(docs.fees.emptyLine) && !/Pick a scenario|appear here/i.test(docs.fees.emptyLine),
    docs.fees.emptyLine.slice(0, 60) || '(no empty-state line)'],
  ['and the English one still reads English',
    /Pick a scenario|appear here/i.test(feesEn.emptyLine) && !hasArabic(feesEn.emptyLine),
    feesEn.emptyLine.slice(0, 60) || '(no empty-state line)'],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
