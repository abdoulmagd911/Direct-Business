/* probe-reports-say-they-are-local.mjs — a page of company percentages that is really one person's
   private notes has to say so.

   Fire #170. The Reports page shows "Achievements logged", "N / 30 KPIs with data", "Avg progress
   to 2026 targets" and a percentage against each of the company's 2026 objectives. All of it is
   stored in `localStorage` under `directReportsData_v1` (core-10's `rptLoad`/`rptSave`), and
   nothing else in the app touches that key — not the database, not Settings' "Full backup (JSON)".

   Measured with two browser profiles on the same account against the same live database: after one
   achievement was recorded, profile A read "1 Achievements logged · 1 / 30 KPIs with data · 3% Avg
   progress to 2026 targets" while profile B read zeros, and NO database write was attempted. So
   thirty KPIs filled in on the office desktop are invisible on a laptop, invisible to a colleague,
   and gone when the browser's data is cleared. Nothing on the page said so.

   What this holds:
     1. the line is there on the Reports page;
     2. it says the figures are in this browser only — the fact a person needs;
     3. it warns they are not in the backup, so nobody assumes the nightly copy has them;
     4. it points at Generate Report, so the warning comes with something to do;
     5. in Arabic the line is Arabic — no English left behind;
     6. the page still works: the tabs and the figures are all still there, and the line has not
        replaced the page;
     7. it appears ONLY on Reports — a warning about this data on Leads or Clients would be a lie;
     8. no JS errors.

   Checks 6 and 7 are the brakes: a banner pasted on every page, or one that displaced the report,
   would pass 1-5 and make the app worse.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/91's
   script line from index.html fails checks 1, 2, 3, 4 and 5.
   Run: node scripts/qa/probe-reports-say-they-are-local.mjs                                      */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9129; const BASE = 'http://localhost:' + PORT;

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

const srv = start(PORT, { businesses: [row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' })], contacts: [], activities: [] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'en-GB' });
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

await p.goto(BASE + '/reports', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
await p.waitForTimeout(4500);

async function onPage(which) {
  await p.evaluate((x) => { try { current = x; openLead = null; render(); } catch (_) { } }, which);
  await p.waitForTimeout(2400);
  return p.evaluate(() => { const v = document.getElementById('view');
    return { line: !!v.querySelector('.v91-local'),
      text: ((v.querySelector('.v91-local') || {}).innerText || '').replace(/\s+/g, ' ').trim(),
      page: (v.innerText || '').replace(/\s+/g, ' '),
      tabs: v.querySelectorAll('.rpt-tabs button').length }; });
}
const reports = await onPage('reports');
const leads = await onPage('leads');
const clients = await onPage('clients');

await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); if (typeof render === 'function') render(); } catch (_) { } });
await p.waitForTimeout(1200);
const arabic = await onPage('reports');
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s);
const englishWords = (s) => (s.replace(/Generate Report|KPI/g, '').match(/[A-Za-z]{4,}/g) || []);

const checks = [
  ['the line is there on the Reports page', reports.line, String(reports.line)],
  /* 2026-09-26 (Phase 3 release 2): achievements and proofs moved into the company database (js/111). The line's
     facts changed with them — it must now say THAT, and name the one thing still kept in this browser only (a
     KPI "actual" typed by hand). Saying "everything here is in this browser only" would now be the lie. */
  /* release 3 (2026-09-26): the KPI figures moved as well (js/112) — nothing on the page is browser-only any more */
  ['it says everything on the page is in the company database — achievements, proofs and KPI figures', /company database/i.test(reports.text) && /proofs/i.test(reports.text) && /KPI/i.test(reports.text), reports.text.slice(0, 120)],
  ['it says KPI actuals are never typed by hand', /nothing is typed by hand/i.test(reports.text), reports.text.slice(0, 260)],
  ['it no longer claims the whole page is private to this browser', !/Nothing on this page is saved to the company database/i.test(reports.text), String(/Nothing on this page is saved/i.test(reports.text))],
  ['in Arabic the line is Arabic — no English left behind',
    arabic.line && hasArabic(arabic.text) && englishWords(arabic.text).length === 0,
    JSON.stringify({ arabic: hasArabic(arabic.text), leftover: englishWords(arabic.text).slice(0, 4) })],
  ['the page still works — the tabs and the figures are still there',
    reports.tabs >= 4 && /Achievements logged/i.test(reports.page) && /KPIs with data/i.test(reports.page),
    JSON.stringify({ tabs: reports.tabs })],
  ['it appears ONLY on Reports', !leads.line && !clients.line,
    JSON.stringify({ leads: leads.line, clients: clients.line })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
