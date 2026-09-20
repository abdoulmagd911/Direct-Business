/* probe-the-average-says-what-it-averaged.mjs — an average over a third of the records is not the
   company's number unless it says so.

   Fire #181. The Leads page carries four headline figures. One read **"26 days · Avg time to win"**.

   Measured on the live database: of the **28 clients**, only **8** have a conversion date on or
   after the day this app first held the record. The other **20 converted before the app ever had
   them** — they were imported after the fact — so the wait is genuinely unmeasurable for them, and
   the code correctly skips them. Skipping them **silently** is the defect: 26 days is the honest
   average of 8 records, presented as the company's time to win.

   The tile beside it already learned exactly this lesson on 2026-09-09 and reads "Became clients ·
   28 of 108". This one never did. Same treatment: the basis goes in the label, and one line
   underneath says why the rest are not counted.

   What this holds:
     1. the tile carries the basis — "N of M", not a bare number;
     2. N is the number actually averaged, not the number of clients;
     3. the average itself is still correct for those N;
     4. a line underneath says how many are excluded and why;
     5. it says nothing when nothing is excluded — a clean dataset gets no apology;
     6. when NOTHING can be measured the tile shows "—", never a made-up 0;
     7. in Arabic both the label and the line are Arabic;
     8. no JS errors.

   Checks 5 and 6 are the brakes: a line that always shows, or a 0 standing in for "unknown", would
   pass the rest and make the page worse.

   Note for whoever changes this card: its injector used to insert only the FIRST node the builder
   produced, so the basis line was built and then silently dropped — found by driving, not by
   reading. It now inserts every node.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting the bare
   label back fails checks 1, 2 and 7; dropping the basis line fails check 4.
   Run: node scripts/qa/probe-the-average-says-what-it-averaged.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9169; const BASE = 'http://localhost:' + PORT;

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

/* four clients: two measurable (10 and 20 days), two imported after they had already converted */
const MEASURABLE = [
  row({ id: 'c1', legacy_id: 'C1', name: 'QA Measurable One', is_client: true, stage: 'won',
        created_at: '2026-03-01T00:00:00Z', converted_date: '2026-03-11' }),
  row({ id: 'c2', legacy_id: 'C2', name: 'QA Measurable Two', is_client: true, stage: 'won',
        created_at: '2026-03-01T00:00:00Z', converted_date: '2026-03-21' }),
];
const BACKWARDS = [
  row({ id: 'c3', legacy_id: 'C3', name: 'QA Backwards One', is_client: true, stage: 'won',
        created_at: '2026-06-01T00:00:00Z', converted_date: '2026-01-05' }),
  row({ id: 'c4', legacy_id: 'C4', name: 'QA Backwards Two', is_client: true, stage: 'won',
        created_at: '2026-06-01T00:00:00Z', converted_date: '2026-02-05' }),
];
const LEADS = [row({ id: 'l1', legacy_id: 'L1', name: 'QA Plain Lead' })];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function look(businesses, port, arabic) {
  const srv = start(port, { businesses, contacts: [], activities: [] });
  const base = 'http://localhost:' + port;
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('dialog', (d) => d.dismiss());
  await p.route((u) => u.href.includes('vkxoeeoauexyfpzqufqd.supabase.co'), async (r) => {
    const rq = r.request(); const u = new URL(rq.url()); const m = rq.method();
    const isRpc = /\/rpc\//.test(u.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(m) && u.pathname.startsWith('/rest/v1/') && (!isRpc || /save_state/.test(u.pathname))) {
      await r.fulfill({ status: 200, contentType: 'application/json', body: isRpc ? '""' : '[]' }); return; }
    try { const resp = await fetch(base + u.pathname + u.search, { method: m, headers: rq.headers(), body: ['GET', 'HEAD'].includes(m) ? undefined : rq.postData() });
      const bd = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: bd }); } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route((u) => u.href.includes('cdn.jsdelivr.net'), (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route((u) => u.href.includes('fonts.googleapis.com'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route((u) => u.href.includes('fonts.gstatic.com') || u.href.includes('clearbit.com'), (r) => r.abort());
  await p.goto(base + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#cl_email', { timeout: 60000 });
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  if (arabic) await p.evaluate(() => { try { LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) { } });
  await p.evaluate(() => { try { current = 'leads'; openLead = null; render(); } catch (_) { } });
  await p.waitForTimeout(3200);
  const out = await p.evaluate(() => {
    const v = document.getElementById('view');
    const card = v.querySelector('.v31-conv');
    const basis = v.querySelector('.v31-basis');
    return { card: card ? (card.innerText || '').replace(/\s+/g, ' ').trim() : '',
      basis: basis ? (basis.innerText || '').replace(/\s+/g, ' ').trim() : '' };
  });
  await ctx.close(); srv.close?.();
  return out;
}

const mixed = await look(LEADS.concat(MEASURABLE, BACKWARDS), PORT, false);
const clean = await look(LEADS.concat(MEASURABLE), PORT + 1, false);
const none = await look(LEADS.concat(BACKWARDS), PORT + 2, false);
const arabic = await look(LEADS.concat(MEASURABLE, BACKWARDS), PORT + 3, true);
await b.close();

const hasArabic = (s) => /[؀-ۿ]/.test(s || '');
const checks = [
  ['the tile carries the basis, not a bare number', /Avg time to win · \d+ of \d+/.test(mixed.card),
    (mixed.card.match(/Avg time to win[^A-Z]*/) || ['(missing)'])[0]],
  ['the basis is what was averaged, not the number of clients', /Avg time to win · 2 of 4/.test(mixed.card),
    (mixed.card.match(/Avg time to win · \d+ of \d+/) || ['(missing)'])[0]],
  ['the average is still correct for those records', /15 days/.test(mixed.card),
    (mixed.card.match(/\d+ days/) || ['(missing)'])[0]],
  ['a line underneath says how many are excluded and why',
    /2 of the 4 are not counted/.test(mixed.basis) && /cannot be measured/.test(mixed.basis),
    mixed.basis.slice(0, 110)],
  ['it says nothing when nothing is excluded', clean.basis === '' && /Avg time to win · 2 of 2/.test(clean.card),
    JSON.stringify({ basis: clean.basis, card: (clean.card.match(/Avg time to win · \d+ of \d+/) || [''])[0] })],
  ['when nothing can be measured the tile shows a dash, never a made-up 0',
    /— Avg time to win/.test(none.card) || /Avg time to win · 0 of 2/.test(none.card) && !/0 days/.test(none.card),
    (none.card.match(/(—|\d+ days) Avg time to win[^A-Z]*/) || ['(no tile found)'])[0]],
  ['in Arabic both the label and the line are Arabic',
    hasArabic(arabic.card) && hasArabic(arabic.basis) && !/not counted/i.test(arabic.basis),
    arabic.basis.slice(0, 70)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
