/* probe-sector-key-attacks.mjs (2026-09-03, watch cycle 18) - which field decides a sector.

   finSectorOf() used to decide "Tenders" by matching the word "tender" against a client's
   FREE-TEXT payment terms. client_profiles.profile_type exists for exactly that purpose and
   carries an explicit 'tender' value. Measured against the live database on 3 Sep: 6 clients
   carry that profile, 4 of them have invoices, 9 invoices belong to them - and the free-text
   rule called only 4 of those 9 a tender. Five real tender invoices were reported as ordinary
   B2B. (No company name appears in this file - rule 7. The fixture is synthetic.)

   All four combinations are seeded and each is asserted separately:
     A. profile says tender, terms do NOT      -> Tenders  (the five-invoice case, fixed here)
     B. profile says postpaid, terms DO say it -> B2B      (the explicit field must win)
     C. both say tender                        -> Tenders
     D. no profile at all, terms say tender    -> Tenders  (the old rule kept as a fallback,
                                                            so nothing already classified stops)
   Plus: an archived profile must not decide anything; a School Commission line is Academies
   whatever the client is; and the chips still scope every derived number losslessly.

   Run:  node scripts/qa/probe-sector-key-attacks.mjs        (port 8221)
   Sabotage (file-level): make finSectorOf read the payment terms first again -> A and B go red;
   drop the archived-profile skip -> the archived check goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8221;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

const CASES = [
  { key: 'A', group: 'Profile Tender Co',  biz: 'sk-a', terms: 'Net 30',              profile: 'tender',   want: 'tenders' },
  { key: 'B', group: 'Terms Only Co',      biz: 'sk-b', terms: 'Tender award, net 60', profile: 'postpaid', want: 'b2b' },
  { key: 'C', group: 'Both Say Tender Co', biz: 'sk-c', terms: 'Tender, net 90',       profile: 'tender',   want: 'tenders' },
  { key: 'D', group: 'No Profile Co',      biz: 'sk-d', terms: 'Tender framework',     profile: null,       want: 'tenders' },
  { key: 'E', group: 'Archived Profile Co',biz: 'sk-e', terms: 'Net 30',               profile: 'tender', archived: true, want: 'b2b' },
];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function inv(id, group, total, extra) {
  return Object.assign({
    id, invoice_no: 'SK-' + id, line_no: 1, zatca_dpin: null,
    client_group: group, customer_raw_name: group, invoice_date: '2026-04-10', year: 2026,
    month: 'April', quarter: 'Q2', products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total, cost_sar: 0, profit_sar: total,
    vat_sar: 0, amount_received_sar: total, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    exclusion_reason: null, notes: null, source_batch: 'sector-qa', revenue_way: 'invoice',
    created_at: '2026-04-10T00:00:00Z', updated_at: '2026-04-10T00:00:00Z', deleted_at: null
  }, extra || {});
}
const SEED = CASES.map((c, i) => inv(c.key, c.group, (i + 1) * 1000));
SEED.push(inv('SCH', 'Profile Tender Co', 7000, { service_type: 'School Commission', products: 'School Commission' }));
const srv = start(PORT, {
  finance_invoices: SEED,
  finance_client_links: CASES.map((c, i) => ({ id: 'skl' + i, client_group: c.group, business_id: c.biz, is_client: true, confirmed_by: 'auto-match' })),
  client_profiles: CASES.filter(c => c.profile).map((c, i) => ({ id: 'skp' + i, business_id: c.biz, direct_client_id: 'DC-' + i, profile_type: c.profile, payment_terms: c.terms, billing_cycle: 'monthly', status: c.archived ? 'archived' : 'active' }))
});
const BASE = 'http://localhost:' + PORT;

async function main() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', (r) => r.abort());
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  // the payment terms live on the business records the app keeps in DB.businesses
  await p.evaluate((cases) => {
    DB.businesses = DB.businesses || [];
    cases.forEach(c => DB.businesses.push({ id: c.biz, name: 'Sector Client ' + c.key, isClient: true, paymentTerms: c.terms }));
  }, CASES);
  await p.evaluate(() => { current = 'finance'; FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length && FIN.profileTypeByBiz)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); render(); }); await p.waitForTimeout(1200);

  const loaded = await p.evaluate(() => Object.keys((window.FIN && FIN.profileTypeByBiz) || {}).length);
  if (loaded > 0) ok('the client profiles are loaded and indexed by client (' + loaded + ' live profiles) — the sector key is available before anyone opens the Ledger');
  else fail('FIN.profileTypeByBiz is empty: the sector still has only free text to go on');

  const got = await p.evaluate(() => {
    const out = {};
    (FIN.rows || []).forEach(r => { out[r.id] = { sector: window.finSectorOf(r), basis: window.finSectorBasis ? window.finSectorBasis(r) : null }; });
    return out;
  });
  const EXPLAIN = {
    A: 'a client whose profile says tender but whose payment terms never mention it is a TENDER — this is the five-invoice case that was being reported as ordinary B2B',
    B: 'a client whose profile says postpaid is B2B even though the words "Tender award" appear in its payment terms — the explicit field wins over the prose',
    C: 'a client where both agree is a tender, as before',
    D: 'a client with no profile yet still falls back to the payment-terms match — nothing that used to be classified stops being classified',
    E: 'an ARCHIVED profile decides nothing; the client falls through to its payment terms (which say nothing) and stays B2B'
  };
  CASES.forEach(c => {
    const g = got[c.key];
    if (g && g.sector === c.want) ok(EXPLAIN[c.key]);
    else fail(c.key + ': sector is ' + (g && g.sector) + ', expected ' + c.want + ' (' + EXPLAIN[c.key] + ')');
  });
  const basisA = got.A && got.A.basis, basisD = got.D && got.D.basis;
  if (basisA === 'profile' && basisD === 'terms') ok('the page can say which key answered for each row — profile for A, payment terms for D — instead of mixing the two silently');
  else fail('basis reads ' + JSON.stringify([basisA, basisD]) + ', expected ["profile","terms"]');
  if (got.SCH && got.SCH.sector === 'academies') ok('a School Commission line is Academies whatever the client profile says'); else fail('the School Commission line reads ' + (got.SCH && got.SCH.sector));

  /* the chips still scope every derived number, losslessly */
  const tot = async (sector) => p.evaluate((sector) => {
    FIN.p.sector = sector; if (typeof clearFinCanon === 'function') clearFinCanon();
    const rows = (window.finLive ? finLive() : []).filter(window.finInPeriod);
    return Math.round(rows.reduce((a, r) => a + (+r.revenue_sar || 0), 0) * 100) / 100;
  }, sector);
  const all = await tot('all'), t = await tot('tenders'), b2b = await tot('b2b'), ac = await tot('academies');
  await p.evaluate(() => { FIN.p.sector = 'all'; render(); });
  if (Math.abs((t + b2b + ac) - all) < 0.02) ok('the three chips add up to the unfiltered total (' + all.toLocaleString() + ') — no invoice lost between sectors, none counted twice');
  else fail('tenders ' + t + ' + b2b ' + b2b + ' + academies ' + ac + ' = ' + (t + b2b + ac) + ', all sectors = ' + all);
  const wantTenders = SEED.filter(r => ['A', 'C', 'D'].indexOf(r.id) >= 0).reduce((a, r) => a + r.revenue_sar, 0);
  if (Math.abs(t - wantTenders) < 0.02) ok('the Tenders chip totals ' + wantTenders.toLocaleString() + ' — exactly the three clients that really are tenders');
  else fail('the Tenders chip totals ' + t + ', an independent recount gives ' + wantTenders);

  if (!errors.length) ok('no page errors through the run'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));
  await b.close(); srv.close();
  console.log(failures ? ('\n' + failures + ' FAILURE(S)') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
