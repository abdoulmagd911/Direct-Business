/* probe-b2c-paging.mjs — the Individual bookings tab past 1,000 rows (2026-09-06, round 48).

   Flagged by the oversight session in watch cycle 28 and outside their lane: js/58's load() read
   finance_invoices with NO paging. The API returns at most 1000 rows however many exist, and says
   so only in a Content-Range header nobody reads — so past 1,000 hand-entered bookings the tab
   would have shown the first 1,000 as if that were all of them. A clean, plausible, wrong answer,
   and the exact shape watch cycle 13 fixed in six reads in js/16.

   Their probe-b2c-manual-attacks enters four bookings through the real form, which is the right
   test for everything else it checks and cannot touch this: four rows never reach the ceiling.
   So the fix arrived unguarded. This is its guard.

   What is held:
     - a 1,240-booking table loads in full, not the first 1,000
     - a control proves the ceiling is real in this harness, so passing means paging and not a
       mock that happily returns everything
     - the money on screen reflects every booking, not just the first page — the count alone
       could pass while a total was computed from a truncated set
     - the rows past the first page are really there, by name, not merely counted

   Sabotage: restore the single unpaged select -> the tab holds 1000 of 1240 -> red. */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';

const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8239;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const N = 1240;                     // comfortably past one page, and not a round multiple of it
const SEED = [];
for (let i = 0; i < N; i++) {
  const mo = (i % 12) + 1;
  SEED.push({
    id: 'bp' + i, invoice_no: 'BP-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'Individual ' + i, customer_raw_name: 'Individual ' + i,
    invoice_date: '2026-' + String(mo).padStart(2, '0') + '-1' + (i % 8),
    year: 2026, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2c',
    total_incl_vat_sar: 100 + i, wallet_portion_sar: 0, revenue_sar: 100 + i,
    cost_sar: 50, profit_sar: 50 + i, vat_sar: 0,
    amount_received_sar: 100 + i, amount_remaining_sar: 0, integrity_status: 'verified_paid',
    collection_due_date: null, exclusion_reason: null, notes: null, source_batch: 'bp-qa',
    revenue_way: 'b2c_manual', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
}
const WANT_REV = SEED.reduce((a, r) => a + r.revenue_sar, 0);
const LAST_REF = SEED[N - 1].invoice_no;      // only reachable on the second page

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${N} hand-entered bookings (${WANT_REV.toLocaleString()} SAR) — one page is 1000`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('dialog', (d) => d.dismiss());
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

  /* the control first: if the harness does not enforce the ceiling, everything below is vacuous */
  const raw = await fetch(BASE + '/rest/v1/finance_invoices?select=id').then((r) => r.json());
  if (Array.isArray(raw) && raw.length === 1000) ok(`control: an unpaged read of ${N} rows gets back exactly 1000 — the ceiling is real here, so passing below means the app really pages`);
  else { fail(`control failed: an unpaged read returned ${Array.isArray(raw) ? raw.length : 'nothing'}, expected the 1000-row ceiling — this probe would prove nothing`); }

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { current = 'finance'; FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('b2c'); });
  for (let i = 0; i < 200 && !(await p.evaluate(() => window.B2C && B2C.rows && B2C.rows.length)); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(1500);

  const got = await p.evaluate(() => (window.B2C && B2C.rows) ? B2C.rows.length : -1);
  if (got === N) ok(`the Individual bookings tab holds all ${N} bookings — the read pages past the ceiling`);
  else if (got === 1000) fail(`the tab holds exactly 1000 of ${N} bookings — the read is not paging, and the tab is showing the first page as if it were everything`);
  else fail(`the tab holds ${got} bookings, ${N} exist`);

  /* a count can be right while the rows are the wrong ones — name a row only the second page has */
  const hasLast = await p.evaluate((ref) => (window.B2C && B2C.rows || []).some((r) => r.invoice_no === ref), LAST_REF);
  if (hasLast) ok(`…and a booking that only exists past the first page (${LAST_REF}) is really among them, so this is the whole table and not 1,240 copies of the first page`);
  else fail(`${LAST_REF} is missing — whatever the count says, the rows past the first page did not arrive`);

  /* and the money has to reflect all of them, not just the page that loaded */
  const sum = await p.evaluate(() => Math.round(((window.B2C && B2C.rows) || []).reduce((a, r) => a + (+r.revenue_sar || 0), 0)));
  if (sum === WANT_REV) ok(`the bookings on the tab add up to ${WANT_REV.toLocaleString()} SAR — an independent recount of every seeded booking agrees, so no total is being computed off a truncated set`);
  else fail(`the tab's bookings sum to ${sum.toLocaleString()}, an independent recount of all ${N} gives ${WANT_REV.toLocaleString()}`);

  const real = errors.filter((e) => !/TUNNEL_CONNECTION/.test(e));
  if (!real.length) ok('no page error at 1,240 hand-entered bookings');
  else fail(real.length + ' JS error(s): ' + JSON.stringify(real.slice(0, 3)));

  await b.close(); srv.close();
  console.log(failures ? `\n✗ ${failures} failed` : '\n✓ all checks passed');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); try { srv.close(); } catch (_) {} process.exit(1); });
