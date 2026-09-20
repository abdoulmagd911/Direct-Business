/* probe-the-palette-knows-the-arabic-name.mjs — two searches in one app must agree about what a
   company is called.

   Fire #179. Ctrl/Cmd+K opens a command palette whose placeholder promises "Search anything —
   leads, clients, bookings, invoices, airlines, actions…". Driven against the live database, it
   matched a company on its **English name only**:

     · typing the English name  → found;
     · typing the SAME company's ARABIC name → "No matches." — and 18 of the 108 live companies
       carry an Arabic name;
     · the Direct client ID, the CR/VAT number and the person you actually know there: all deaf.

   Fire #148 fixed exactly this for the Clients page search. The palette was never given the same
   treatment, so the app's two searches disagreed about what a company is called — and the one
   behind a keyboard shortcut, used by the people who work fastest, was the poorer of the two.

   What this holds:
     1. a company is found by its English name;
     2. the SAME company is found by its Arabic name;
     3. and by its Direct client ID;
     4. and by its CR/VAT number;
     5. and by the name of a person who works there;
     6. a search that matches nothing still says "No matches." — widening a search must not make it
        match everything;
     7. an archived company is still not offered;
     8. no JS errors.

   Checks 6 and 7 are the brakes: a haystack that swallowed every field, or dropped the archived
   filter, would pass 1-5 and make the palette useless.

   Note for whoever runs this: the palette overlay is `position:fixed`, so `offsetParent` is null
   even while it is open — the first version of this probe reported the palette as never opening at
   all. Its state is the `show` class, which is what is read here.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): putting back the
   name-only filter fails checks 2, 3, 4 and 5.
   Run: node scripts/qa/probe-the-palette-knows-the-arabic-name.mjs                               */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9163; const BASE = 'http://localhost:' + PORT;

const AR = 'شركة القمة للتعدين';
const DID = 'DCID-77421';
const CRV = '3001234567891';
const PERSON = 'Faisal Alharbi';

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

const BID = 'q1000000-0000-4000-8000-000000000001';
const BUSINESSES = [
  row({ id: BID, legacy_id: 'Q1', name: 'QA Summit Minerals', name_ar: AR,
        direct_client_id: DID, cr_vat: CRV, is_client: true, stage: 'won', converted_date: '2026-03-01' }),
  row({ id: 'q2', legacy_id: 'Q2', name: 'QA Other Company' }),
  /* archived: must never be offered, however wide the haystack gets */
  row({ id: 'q3', legacy_id: 'Q3', name: 'QA Archived Summit', name_ar: AR, archived_at: '2026-05-01T00:00:00Z' }),
];
const CONTACTS = [
  { id: 'qc1', business_id: BID, name: PERSON, role: 'Procurement', email: 'f@qa.test', phone: '+966500000011',
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
/* the people bridge attaches contacts on its own timer — the person check needs them */
await p.waitForFunction(() => { try { const x = getLead('Q1'); return !!(x && x.contacts && x.contacts.length); } catch (_) { return false; } }, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(2500);

async function search(q) {
  /* the overlay is position:fixed — its state is the `show` class, not offsetParent */
  const isOpen = () => p.evaluate(() => { const o = document.getElementById('v19palette');
    return !!(o && o.classList.contains('show')); });
  if (await isOpen()) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.keyboard.press('Control+K');
  await p.waitForTimeout(600);
  const open = await isOpen();
  if (!open) return { open: false, hits: [] };
  await p.fill('#v19pinput', '');
  await p.type('#v19pinput', q, { delay: 10 });
  await p.waitForTimeout(800);
  const hits = await p.evaluate(() => {
    const l = document.getElementById('v19plist');
    return [].slice.call(l ? l.children : []).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim());
  });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  return { open: true, hits };
}

const found = (r) => r.hits.some((h) => /QA Summit Minerals/.test(h));
const byEn = await search('QA Summit');
const byAr = await search(AR.slice(0, 8));
const byId = await search(DID);
const byCr = await search(CRV.slice(0, 8));
const byPerson = await search('Faisal');
const nonsense = await search('zzzqqqxnothingatall');
const archived = await search('QA Archived Summit');
await b.close(); srv.close?.();

const checks = [
  ['a company is found by its English name', byEn.open && found(byEn), JSON.stringify(byEn.hits.slice(0, 2))],
  ['the same company is found by its Arabic name', byAr.open && found(byAr), JSON.stringify(byAr.hits.slice(0, 2))],
  ['and by its Direct client ID', byId.open && found(byId), JSON.stringify(byId.hits.slice(0, 2))],
  ['and by its CR/VAT number', byCr.open && found(byCr), JSON.stringify(byCr.hits.slice(0, 2))],
  ['and by the name of a person who works there', byPerson.open && found(byPerson), JSON.stringify(byPerson.hits.slice(0, 2))],
  ['a search that matches nothing still says "No matches."',
    nonsense.open && nonsense.hits.length === 1 && /No matches/i.test(nonsense.hits[0] || ''),
    JSON.stringify(nonsense.hits.slice(0, 2))],
  ['an archived company is still not offered',
    archived.open && !archived.hits.some((h) => /QA Archived Summit/.test(h)),
    JSON.stringify(archived.hits.slice(0, 2))],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
