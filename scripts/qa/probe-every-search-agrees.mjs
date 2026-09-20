/* probe-every-search-agrees.mjs — one company, three searches, one answer.

   Fire #180. This app searches companies from three places, and each had grown its own list of
   fields:

     · the **Clients page** filter — widened by fire #148 (name, Arabic name, legal name, Direct
       client ID, CR/VAT, the people);
     · the **Ctrl/Cmd+K palette** — matched the English name ONLY until fire #179;
     · the **top-bar box**, which promises "Search leads, clients, requests, airlines, providers,
       SOPs" — name, Arabic name, segment and the people, but **not** the legal name, **not** the
       Direct client ID and **not** the CR/VAT number.

   So typing a company's Direct client ID or CR/VAT into the top-bar box found nothing while the
   very same text found it on the Clients page. Three lists drift; one does not. All three now share
   `recordHay` (core-01), and this probe is what keeps them sharing it.

   What this holds — for each of five ways to name the same company (Arabic name, legal name,
   Direct client ID, CR/VAT number, and a person who works there):
     1-5. the top-bar box finds it;
     6-10. the palette finds it;
     and the brakes:
     11. nonsense finds nothing in either — widening a search must not make it match everything;
     12. an archived company is offered by neither, however wide the haystack;
     13. phone-digit matching still works in the top-bar box (fire #113's mechanism is separate
         from the field list and must survive the merge);
     14. no JS errors.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): narrowing
   `recordHay` back to the name alone fails the four field checks on both surfaces.
   Run: node scripts/qa/probe-every-search-agrees.mjs                                             */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9165; const BASE = 'http://localhost:' + PORT;

const NAME = 'QA Northgate Contracting';
const AR = 'شركة البوابة للمقاولات';
const LEGAL = 'QA Northgate Contracting and Sons Limited';
const DID = 'DCID-90817';
const CRV = '3009988776655';
const PERSON = 'Hanan Alotaibi';
const PHONE = '+966 50 777 6543';

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

const BID = 'r1000000-0000-4000-8000-000000000001';
const BUSINESSES = [
  row({ id: BID, legacy_id: 'R1', name: NAME, name_ar: AR, legal_name: LEGAL,
        direct_client_id: DID, cr_vat: CRV, is_client: true, stage: 'won', converted_date: '2026-04-01' }),
  row({ id: 'r2', legacy_id: 'R2', name: 'QA Unrelated Company' }),
  row({ id: 'r3', legacy_id: 'R3', name: 'QA Archived Northgate', name_ar: AR, cr_vat: CRV,
        archived_at: '2026-05-01T00:00:00Z' }),
];
const CONTACTS = [
  { id: 'rc1', business_id: BID, name: PERSON, role: 'Procurement', email: 'h@qa.test', phone: PHONE,
    needs_manual_confirmation: false, confirmation_reason: null, verification_source: null },
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: CONTACTS, activities: [] });
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

await p.goto(BASE + '/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('#cl_email', { timeout: 60000 });
await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
await p.waitForFunction(() => { try { const x = getLead('R1'); return !!(x && x.contacts && x.contacts.length); } catch (_) { return false; } }, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);

const topBar = (q) => p.evaluate((x) => {
  try {
    const g = document.getElementById('gsearch'); if (g) g.value = x;
    runGlobalSearch(x);
    const box = document.getElementById('gres');
    return [].slice.call(box ? box.children : []).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim());
  } catch (e) { return ['ERR ' + e.message]; }
}, q);
const palette = (q) => p.evaluate((x) => {
  try {
    return (CMD_RESULTS(String(x).toLowerCase().trim()) || [])
      .filter((r) => r.kind === 'Lead' || r.kind === 'Client').map((r) => String(r.lbl || ''));
  } catch (e) { return ['ERR ' + e.message]; }
}, q);

const hit = (list) => list.some((x) => x.indexOf(NAME) >= 0);
const WAYS = [['its Arabic name', AR.slice(0, 10)], ['its legal name', 'Northgate Contracting and Sons'],
  ['its Direct client ID', DID], ['its CR/VAT number', CRV], ['a person who works there', PERSON]];

const res = [];
for (const [label, q] of WAYS) res.push({ label, top: hit(await topBar(q)), pal: hit(await palette(q)) });
const nonsenseTop = await topBar('zzzqqqxnothingatall');
const nonsensePal = await palette('zzzqqqxnothingatall');
const archTop = await topBar('QA Archived Northgate');
const archPal = await palette('QA Archived Northgate');
const byDigits = await topBar('7776543');
await b.close(); srv.close?.();

const checks = [];
for (const r of res) checks.push(['the top-bar box finds it by ' + r.label, r.top, String(r.top)]);
for (const r of res) checks.push(['the palette finds it by ' + r.label, r.pal, String(r.pal)]);
checks.push(['nonsense finds nothing in either',
  !hit(nonsenseTop) && !hit(nonsensePal) && nonsensePal.length === 0,
  JSON.stringify({ top: nonsenseTop.length, pal: nonsensePal.length })]);
checks.push(['an archived company is offered by neither',
  !archTop.some((x) => /QA Archived Northgate/.test(x)) && !archPal.some((x) => /QA Archived Northgate/.test(x)),
  JSON.stringify({ top: archTop.slice(0, 2), pal: archPal.slice(0, 2) })]);
checks.push(['phone-digit matching still works in the top-bar box', hit(byDigits),
  JSON.stringify(byDigits.slice(0, 2))]);
checks.push(['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')]);

let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
