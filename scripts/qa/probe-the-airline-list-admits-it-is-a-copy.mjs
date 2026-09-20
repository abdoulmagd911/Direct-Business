/* probe-the-airline-list-admits-it-is-a-copy.mjs — a list that quietly ends early is worse than a
   short list.

   Fire #171. There are two stores of airlines and the page reads the smaller one:

     · `app_state.data.airlines` — a copy inside the settings record. **136 airlines, 26 with
       contact details.** This is what the Airlines page draws; nothing in the app ever fetches the
       table.
     · the `airlines` table — **139 airlines, 30 with contact details**, contacts stamped
       2026-06-28.

   Measured live: `DB.airlines` holds 136 and the register holds 139. The three that never arrive
   are 6Y Sereen Air, **PF Air Sial — which the register marks as operating in Saudi Arabia** — and
   the legacy XX bucket row. The page said nothing; the list simply ended at 136.

   js/92 does not move the page onto the table (that means moving its saves too, and CLAUDE.md
   already carries that as a structural job). It makes the page admit the gap.

   What this holds:
     1. the line is there when the register holds more than the page shows;
     2. it gives both numbers, so the size of the gap is visible;
     3. it NAMES what is missing — "3 not shown" would leave you no wiser;
     4. it says contact people are missing too, when they are;
     5. it warns that editing here changes the copy, not the register;
     6. **it says NOTHING when the two agree** — so the day the page is moved onto the register this
        line disappears by itself instead of becoming decoration;
     7. the page still lists its airlines — the line is added, not substituted;
     8. in Arabic the line is Arabic;
     9. no JS errors.

   Check 6 is the brake that matters, and check 7 the one that stops this replacing the page.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): removing js/92's
   script line from index.html fails checks 1-5 and 8.
   Run: node scripts/qa/probe-the-airline-list-admits-it-is-a-copy.mjs                            */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9132; const BASE = 'http://localhost:' + PORT;

/* the copy the page draws: two airlines, one of them with a contact person */
const BLOB_AIRLINES = [
  { id: 'al1', code: 'AA', name: 'QA Alpha Air', country: 'Saudi Arabia', type: 'FSC', ksa: 'Operates', contacts: [{ name: 'QA Person', role: 'Sales' }] },
  { id: 'al2', code: 'BB', name: 'QA Bravo Air', country: 'Saudi Arabia', type: 'LCC', ksa: 'Operates', contacts: [] },
];
/* the register: the same two, plus two the page will never show — one of them with a contact */
const TABLE_AIRLINES = [
  { id: 'al1', legacy_id: 'a_alpha', code: 'AA', name: 'QA Alpha Air', contacts: [{ name: 'QA Person', role: 'Sales' }] },
  { id: 'al2', legacy_id: 'a_bravo', code: 'BB', name: 'QA Bravo Air', contacts: [] },
  { id: 'al3', legacy_id: 'a_charlie', code: 'CC', name: 'QA Charlie Air', contacts: [{ name: 'QA Missing Person', role: 'Ops' }] },
  { id: 'al4', legacy_id: 'a_delta', code: 'DD', name: 'QA Delta Air', contacts: [] },
];

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
  airlines: TABLE_AIRLINES,
  app_state: [{ id: 1, data: { airlines: BLOB_AIRLINES, meta: { name: 'QA' }, schemaVersion: 3, settings: {} } }],
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

await p.goto(BASE + '/airlines', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && typeof DB !== 'undefined', { timeout: 120000 });
await p.waitForTimeout(4000);

async function look() {
  await p.evaluate(() => { try { current = 'airlines'; render(); } catch (_) { } });
  await p.waitForTimeout(3200);
  await p.evaluate(() => { try { render(); } catch (_) { } });     /* the register arrives async */
  await p.waitForTimeout(2200);
  return p.evaluate(() => { const v = document.getElementById('view'); const l = v.querySelector('.v92-gap');
    return { line: !!l, text: l ? (l.innerText || '').replace(/\s+/g, ' ').trim() : '',
      rows: v.querySelectorAll('tbody tr').length }; });
}
const gap = await look();

/* the brake: once the page is showing everything the register holds, the line must go away */
await p.evaluate(() => { try {
  DB.airlines.push({ id: 'al3', code: 'CC', name: 'QA Charlie Air', contacts: [{ name: 'QA Missing Person', role: 'Ops' }] });
  DB.airlines.push({ id: 'al4', code: 'DD', name: 'QA Delta Air', contacts: [] });
} catch (_) { } });
const inStep = await look();

/* put the gap back, then check Arabic */
await p.evaluate(() => { try { DB.airlines = DB.airlines.filter((a) => a.code === 'AA' || a.code === 'BB');
  LANG = 'ar'; if (typeof applyLang === 'function') applyLang(); } catch (_) { } });
const arabic = await look();
await b.close(); srv.close?.();

const hasArabic = (s) => /[؀-ۿ]/.test(s);
const checks = [
  ['the line is there when the register holds more than the page shows', gap.line, String(gap.line)],
  ['it gives both numbers', /2/.test(gap.text) && /4/.test(gap.text), gap.text.slice(0, 70)],
  ['it names what is missing', /QA Charlie Air/.test(gap.text) && /QA Delta Air/.test(gap.text), gap.text.slice(0, 140)],
  ['it says contact people are missing too', /contact people for 1/i.test(gap.text), gap.text],
  ['it warns that editing here changes the copy', /changes the copy/i.test(gap.text), String(/changes the copy/i.test(gap.text))],
  ['it says NOTHING when the two agree', !inStep.line, inStep.line ? 'still shown: ' + inStep.text.slice(0, 80) : '(gone — right)'],
  ['the page still lists its airlines', gap.rows > 0 && inStep.rows > 0, JSON.stringify({ gap: gap.rows, inStep: inStep.rows })],
  ['in Arabic the line is Arabic', arabic.line && hasArabic(arabic.text), arabic.text.slice(0, 60)],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
