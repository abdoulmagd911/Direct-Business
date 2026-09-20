/* probe-a-share-link-is-not-handed-the-settings.mjs — the link promises the pipeline, and was
   handing over the filing cabinet behind it.

   Fire #167. #165 stopped a link holder READING our call notes off a card; #166 stopped them
   DOWNLOADING the pipeline. This is the third and last of the three: what the page was given in
   the first place.

   `share_view` — the database function a link calls, with no sign-in — returned the WHOLE
   `app_state` blob, and js/10 copied every key of it into `DB`. Measured on the live row: 35 keys,
   86,801 bytes, of which the link legitimately needs three. The rest included

     · `agency` — 25 fields: the company's bank IBAN, its Amadeus office and PIN, its Zakat/Tax ID;
     · `audit` — 799 rows of who-did-what-when, the same trail #141 kept from colleagues who
       cannot open Finance;
     · `serviceFeePricing` — how Direct prices its own service fee;
     · `integrations`, `sops`, `slas`, `vendors`, and the finance group map inside `settings`.

   None of that is Today, Leads or Clients. All four live links were switched off when this was
   found — which, as in #165, is exactly when to fix it.

   Two locks. The database function now builds an ALLOW-LIST blob, so the rest never leaves the
   database (35 keys → 3, 86,801 bytes → 836). js/10 allow-lists again on the way in, so a blob key
   added later does not leak by being forgotten and an older cached function cannot undo the fix.

   This probe tests the SECOND lock, deliberately: the mock's `share_view` still answers with the
   whole blob, exactly as the live function used to, so what is under test is the app refusing it.

   What this holds, for a link holder:
     1. the shared pages open and carry rows — without this nothing below means anything;
     2. not one of the internal blocks reaches `DB`;
     3. and none of their words appears anywhere on the page;
     4. `settings` arrives trimmed — the funnel list yes, the finance group map no;
     5. Clients renders too, so the fix is not "hide the app";
   And for a colleague:
     6. signed in, the whole blob is still there — a wall, not a deletion;
     7. no JS errors.

   Checks 1, 5 and 6 are the brakes. Dropping the blob entirely would pass 2, 3 and 4 and break
   the feature.

   Sabotage-tested against a COPY of the app (APP_DIR — the repository untouched): restoring js/10's
   old `Object.keys(d.blob).forEach` copy fails checks 2, 3 and 4, and check 2 prints the marker it
   should never have taken.
   Run: node scripts/qa/probe-a-share-link-is-not-handed-the-settings.mjs                        */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 9119; const BASE = 'http://localhost:' + PORT;
const TOKEN = 'qa-share-blob-token-0123456789abcd';

/* one marker per internal block, so a failure names which block leaked */
const M = {
  iban: 'QA-MARKER-BANK-IBAN-SA00', zakat: 'QA-MARKER-ZAKAT-ID', amadeus: 'QA-MARKER-AMADEUS-PIN',
  audit: 'QA-MARKER-AUDIT-TRAIL', pricing: 'QA-MARKER-SERVICE-FEE', vendor: 'QA-MARKER-VENDOR',
  sop: 'QA-MARKER-SOP', finmap: 'QA-MARKER-FINANCE-GROUP-MAP',
};

const BLOB = {
  meta: { name: 'QA', version: '1' }, schemaVersion: 3,
  agency: { name_en: 'QA Agency', vat: '300000000000003', iban: M.iban, bank: 'QA Bank',
    zakatId: M.zakat, amadeusPin: M.amadeus, amadeusOffice: 'QA-OFF' },
  audit: [{ at: '2026-09-01', who: 'QA Test Account', what: M.audit, amount: 123456 }],
  integrations: { amadeus: { office: M.amadeus, status: 'live' } },
  serviceFeePricing: [{ name: M.pricing, fee: 99 }],
  vendors: [{ id: 'v1', name: M.vendor }],
  sops: [{ id: 's1', title: M.sop }],
  slas: [{ id: 'sl1', title: 'QA SLA' }],
  settings: { funnels: ['travel_trade'], funnelSubs: {}, viewPresets: {},
    financeGroupMap: { g1: M.finmap }, financeExclusions: ['QA-EXCL'], commercialPool: ['QA-POOL'] },
  bookings: [], invoices: [], offers: [], projects: [], requests: [],
};

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

const BUSINESSES = [
  row({ id: 'b1', legacy_id: 'B1', name: 'QA Lead One' }),
  row({ id: 'b2', legacy_id: 'B2', name: 'QA Lead Two' }),
  row({ id: 'c1', legacy_id: 'C1', name: 'QA Client One', is_client: true, stage: 'won', converted_date: '2026-03-01' }),
];

const srv = start(PORT, { businesses: BUSINESSES, contacts: [], activities: [],
  app_state: [{ id: 1, data: BLOB }],
  share_links: [{ token: TOKEN, scope: 'all', active: true, created_by: 'u-qa', created_at: new Date().toISOString(), last_used_at: null }] });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors = [];

async function look(asShareLink) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 }, locale: 'en-GB' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push((asShareLink ? 'share' : 'signed-in') + ': ' + e.message)); p.on('dialog', (d) => d.dismiss());
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

  if (asShareLink) {
    await p.goto(BASE + '/s/' + TOKEN + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => document.body.getAttribute('data-share') === '1' && typeof DB !== 'undefined' && (DB.businesses || []).length > 0, { timeout: 60000 });
  } else {
    await p.goto(BASE + '/leads', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('#cl_email', { timeout: 60000 });
    await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
    await p.waitForFunction(() => typeof render === 'function' && (DB.businesses || []).length > 0, { timeout: 120000 });
  }
  await p.waitForTimeout(4500);

  const pageText = async (which) => {
    await p.evaluate((x) => { try { current = x; openLead = null; render(); } catch (_) { } }, which);
    await p.waitForTimeout(2200);
    return p.evaluate(() => { const v = document.getElementById('view');
      return { text: (v.innerText || '').replace(/\s+/g, ' '), rows: v.querySelectorAll('tbody tr').length }; });
  };
  const leads = await pageText('leads');
  const clients = await pageText('clients');
  const held = await p.evaluate(() => {
    const has = (x) => { try { return !!(x && (Array.isArray(x) ? x.length : Object.keys(x).length)); } catch (_) { return false; } };
    let blob = '';
    try { blob = JSON.stringify({ agency: DB.agency, audit: DB.audit, integrations: DB.integrations,
      serviceFeePricing: DB.serviceFeePricing, vendors: DB.vendors, sops: DB.sops, slas: DB.slas,
      settings: DB.settings }); } catch (_) { }
    return { blob: blob,
      agency: has(DB.agency), audit: has(DB.audit), integrations: has(DB.integrations),
      pricing: has(DB.serviceFeePricing), vendors: has(DB.vendors), sops: has(DB.sops),
      settingsKeys: (function () { try { return Object.keys(DB.settings || {}).sort(); } catch (_) { return []; } })() };
  });
  await ctx.close();
  return { leads, clients, held };
}

const guest = await look(true);
const staff = await look(false);
await b.close(); srv.close?.();

const MARKERS = Object.values(M);
const leaked = (hay) => MARKERS.filter((m) => String(hay || '').indexOf(m) >= 0);
const inDb = leaked(guest.held.blob);
const onPage = leaked(guest.leads.text + ' ' + guest.clients.text);

const checks = [
  ['the shared pages open and carry rows', guest.leads.rows > 0, 'leads rows: ' + guest.leads.rows],
  /* the test is that nothing from the SHARED blob got in, not that these keys are bare: the app
     seeds its own empty defaults into DB.agency, DB.vendors and DB.sops before any link loads,
     so "is it populated" would fail on an app that leaks nothing. One marker per block, so a
     failure names which block leaked. */
  ['not one internal block reaches DB — no marker from any of them is anywhere in it',
    inDb.length === 0, inDb.length ? 'LEAKED: ' + inDb.join(', ') : '(all 8 markers absent — right)'],
  ['and none of their words appears anywhere on the page', onPage.length === 0,
    onPage.length ? 'ON SCREEN: ' + onPage.join(', ') : '(absent — right)'],
  ['settings arrives trimmed — the funnel list yes, the finance group map no',
    guest.held.settingsKeys.indexOf('financeGroupMap') < 0 && guest.held.settingsKeys.indexOf('commercialPool') < 0
      && guest.held.settingsKeys.indexOf('funnels') >= 0, JSON.stringify(guest.held.settingsKeys)],
  ['Clients renders too — the fix is not "hide the app"', guest.clients.rows > 0, 'clients rows: ' + guest.clients.rows],
  ['signed in, the whole blob is still there — a wall, not a deletion',
    staff.held.agency && staff.held.audit && staff.held.pricing && leaked(staff.held.blob).length >= 4,
    JSON.stringify({ agency: staff.held.agency, audit: staff.held.audit, pricing: staff.held.pricing,
      markers: leaked(staff.held.blob).length })],
  ['no JS errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];
let bad = 0;
for (const [n, ok, d] of checks) { console.log((ok ? 'PASS' : 'FAIL') + ' · ' + n + (d ? ' — ' + d : '')); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
