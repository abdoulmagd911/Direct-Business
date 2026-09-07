/* probe-received-outstanding-attacks.mjs (2026-09-03, watch cycle 27) - the Received and
   Outstanding tiles, recounted independently at scale.

   Why this exists. Revenue, Cost and Profit have been recounted by probe after probe. Received
   had never been recounted by ANY probe - diag-ledger.mjs asserts only that a tile with that
   label exists; probe-overview-attacks.mjs and probe-outstanding-split.mjs both run on the
   15-row default seed and neither recomputes it. Outstanding has been recounted, but only
   across the Clients ageing table, never off the Overview tile at a size where the 1000-row
   ceiling bites.

   These two tiles are the pair most likely to drift, because they alone are computed on
   DIFFERENT bases and js/16 says so in its own comment: the five money indicators read
   verified-paid invoices ("actual - from verified invoices", their own subtitle), but
   Outstanding is recomputed over EVERY live invoice in the period - because an invoice is only
   verified-paid once nothing is left to pay, so summing what remains across verified rows is
   always zero. That is deliberate and documented. This probe holds each tile to its OWN stated
   basis rather than to a single one, and check 3 proves the two bases genuinely differ on this
   fixture - otherwise checks 1 and 2 would be the same check wearing two labels.

   Under test:
     1. Received == sum of amount_received_sar over verified-paid rows in period.
     2. Outstanding == sum of amount_remaining_sar over every LIVE row in period.
     3. The two bases differ here (control), and Received != Revenue (control that the tile is
        not simply re-reading revenue).
     4. Neither tile counts a soft-deleted row or a standing-excluded client's row, at scale.
     5. Both obey the period bar, checked against a recount per period.
     6. Unreadable money ("1,250.50", "", null, "abc", Infinity) is repaired the same way for
        both tiles, and the page says how many rows carried it.
     7. Both reflect ALL 3,200 rows, not the first 1000 - the API ceiling is real in the harness.

   Run:  node scripts/qa/probe-received-outstanding-attacks.mjs        (port 8233)
   Sabotage (file-level): compute Outstanding over verified() instead of live() -> it collapses
   to zero and check 2 goes red; drop `rec+=` from the tile loop -> check 1 goes red; count the
   excluded client -> check 4 goes red. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start, settingsLoaded } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8233;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const r2 = (n) => Math.round(n * 100) / 100;
const N_INV = 3200;
const EXCLUDED_GROUP = 'Takamol Received QA';

/* the same repair js/16's finSanitizeMoney performs, written out here independently so the
   recount is not the app's own arithmetic borrowed back */
const num = (v) => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).trim();
  const n = parseFloat(s.replace(/[,\s]/g, ''));
  return (isFinite(n) && /^-?[\d.,\s]+$/.test(s)) ? n : 0;
};

const SEED = [];
for (let i = 0; i < N_INV; i++) {
  /* year and month must not be correlated: an earlier draft used (i%3) for the year and
     (i%12) for the month, which maps each month to exactly ONE year — so "2026 · Q2" and
     "2026 · June" returned identical figures and the quarter check proved nothing the month
     check had not already. Stepping the year once per twelve rows breaks that. */
  const y = 2024 + (Math.floor(i / 12) % 3), mo = (i % 12) + 1;
  const total = 500 + (i % 977) * 13;
  const paid = i % 5 !== 0;                       // 80% settled, 20% still owed
  const part = paid ? total : Math.round(total * ((i % 4) / 10));   // partial payments on the unpaid ones
  SEED.push({
    id: 'ro' + i, invoice_no: 'RO-' + i, line_no: 1, zatca_dpin: null,
    client_group: 'RO Client ' + (i % 120), customer_raw_name: 'RO Client ' + (i % 120),
    invoice_date: y + '-' + String(mo).padStart(2, '0') + '-1' + (i % 8),
    year: y, month: MONTHS[mo - 1], quarter: 'Q' + (Math.floor((mo - 1) / 3) + 1),
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total,
    cost_sar: Math.round(total * 0.8), profit_sar: total - Math.round(total * 0.8), vat_sar: 0,
    amount_received_sar: paid ? total : part,
    amount_remaining_sar: paid ? 0 : total - part,
    integrity_status: paid ? 'verified_paid' : 'pending',
    exclusion_reason: null, notes: null, source_batch: 'ro-qa', revenue_way: 'invoice',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  });
}
/* unreadable money, in both fields, on rows of both statuses */
const HOSTILE = [
  ['ro-h1', 'verified_paid', '1,250.50', 0],
  ['ro-h2', 'verified_paid', '', 0],
  ['ro-h3', 'pending', 0, '3,000'],
  ['ro-h4', 'pending', null, 'not a number'],
  ['ro-h5', 'verified_paid', 'abc', 0]
];
HOSTILE.forEach(([id, st, rec, rem], k) => {
  SEED.push(Object.assign({}, SEED[0], { id, invoice_no: id.toUpperCase(), invoice_date: '2026-06-1' + k,
    year: 2026, month: 'June', quarter: 'Q2', integrity_status: st,
    total_incl_vat_sar: 4000, revenue_sar: 4000, cost_sar: 0, profit_sar: 4000,
    amount_received_sar: rec, amount_remaining_sar: rem, deleted_at: null }));
});
/* a soft-deleted row and a standing-excluded client's row, both carrying money big enough that
   counting either one would be unmissable */
SEED.push(Object.assign({}, SEED[0], { id: 'ro-del', invoice_no: 'RO-DEL', year: 2026, month: 'June', quarter: 'Q2', invoice_date: '2026-06-01', integrity_status: 'verified_paid', total_incl_vat_sar: 777777, revenue_sar: 777777, amount_received_sar: 777777, amount_remaining_sar: 555555, deleted_at: '2026-07-01T00:00:00Z' }));
SEED.push(Object.assign({}, SEED[0], { id: 'ro-excl', invoice_no: 'RO-EXCL', client_group: EXCLUDED_GROUP, customer_raw_name: EXCLUDED_GROUP, year: 2026, month: 'June', quarter: 'Q2', invoice_date: '2026-06-02', integrity_status: 'verified_paid', total_incl_vat_sar: 999999, revenue_sar: 999999, amount_received_sar: 999999, amount_remaining_sar: 888888, deleted_at: null }));

/* 2026-09-07 (round 60) — the standing exclusion used to be written into the page with
   p.evaluate AFTER sign-in, which races js/35's app_settings loader: that loader merges the
   served blob key by key over DB.settings, so on a busy machine it landed second and replaced
   'fx-ro' with the mock's own entry. The excluded 999,999 row then counted, and six checks went
   red with a gap of exactly 999,999 — reported for cycles as environmental. Watch cycle 37 found
   the cause and gave the harness a way to seed through app_settings, so the app's own loader
   delivers the fixture and there is no ordering left to get wrong. */
const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [],
  __settings: { financeExclusions: [{ id: 'fx-ro', clientId: 'ro-excl', matchNames: [EXCLUDED_GROUP], reason: 'QA fixture — standing exclusion', addedBy: 'probe', addedAt: '2026-09-07T00:00:00Z' }] } });
const BASE = 'http://localhost:' + PORT;

const liveRows = SEED.filter(r => !r.deleted_at && r.client_group !== EXCLUDED_GROUP);
function inPeriod(r, year, part) {
  if (year !== 'all' && String(r.year) !== String(year)) return false;
  if (part === 'all') return true;
  if (/^Q[1-4]$/.test(part)) return r.quarter === part;
  if (part.indexOf('M:') === 0) return r.month === part.slice(2);
  return true;
}
const wantReceived = (y, pt) => r2(liveRows.filter(r => r.integrity_status === 'verified_paid' && inPeriod(r, y, pt)).reduce((a, r) => a + num(r.amount_received_sar), 0));
const wantOutstanding = (y, pt) => r2(liveRows.filter(r => inPeriod(r, y, pt)).reduce((a, r) => a + num(r.amount_remaining_sar), 0));
const wantRevenue = (y, pt) => r2(liveRows.filter(r => r.integrity_status === 'verified_paid' && inPeriod(r, y, pt)).reduce((a, r) => a + num(r.revenue_sar), 0));
/* what Outstanding would read if it were (wrongly) computed on the verified-paid basis the
   other five tiles use — check 3 proves the two bases are not the same number here */
const outstandingOnVerifiedBasis = r2(liveRows.filter(r => r.integrity_status === 'verified_paid').reduce((a, r) => a + num(r.amount_remaining_sar), 0));

async function main() {
  console.log(`fixture: ${SEED.length} invoices · ${liveRows.length} live · ${HOSTILE.length} carrying unreadable money · 1 soft-deleted · 1 standing-excluded`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push('JS: ' + e.message));
  await p.route('**vkxoeeoauexyfpzqufqd.supabase.co/**', async (r) => {
    const rq = r.request(); const u = new URL(rq.url());
    try {
      const resp = await fetch(BASE + u.pathname + u.search, { method: rq.method(), headers: rq.headers(), body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() });
      const body = await resp.text(); const h = {}; resp.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body });
    } catch (e) { await r.fulfill({ status: 500, body: '{}' }); }
  });
  await p.route('**cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: LIB }));
  await p.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await p.route('**fonts.gstatic.com/**', r => r.abort());

  /* the ceiling has to be real here, or nothing below means anything */
  const raw = await fetch(BASE + '/rest/v1/finance_invoices?select=*');
  const rawRows = await raw.json();
  if (rawRows.length === 1000) ok(`an unpaged read of ${SEED.length} invoices gets back exactly 1000 — the API ceiling is real in this harness`);
  else fail(`unpaged read returned ${rawRows.length}, expected the 1000-row ceiling — every check below would be meaningless`);

  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  /* wait for the app's own loader to deliver it, and fail loudly if it never does, rather than
     measuring an unexcluded world and blaming the app for it (see settingsLoaded's note) */
  if (!(await settingsLoaded(p, 90000, () => { try { return ((DB.settings || {}).financeExclusions || []).some((e) => (e.matchNames || []).includes('Takamol Received QA')); } catch (_) { return false; } })))
    fail('the standing exclusion never reached DB.settings — every total below would count the excluded 999,999 row, which is a fact about this run and not about the app');
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 200 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length > 1000)); i++) await p.waitForTimeout(300);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); });

  const loaded = await p.evaluate(() => (window.FIN && FIN.rows) ? FIN.rows.length : -1);
  if (loaded === SEED.length) ok(`the page holds all ${SEED.length} invoices — the read paged past the ceiling`);
  else fail(`the page holds ${loaded} invoices, ${SEED.length} exist — the tiles below would describe a truncated set`);

  const apply = async (year, part) => {
    await p.evaluate(([y, pt]) => { FIN.p.year = y; FIN.p.part = pt; FIN.p.sector = 'all'; if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.tab = 'overview'; render(); }, [year, part]);
    await p.waitForTimeout(1400);
  };
  const tile = (label) => p.evaluate((label) => {
    const el = [...document.querySelectorAll('#view .card')].find(e => e.firstElementChild && e.firstElementChild.textContent.trim() === label);
    const v = el && el.children[1]; if (!v) return null;
    const t = v.getAttribute('title');
    if (t) return +t.replace(/[^\d.-]/g, '');
    const n = +String(v.textContent).replace(/[^\d.-]/g, '');
    return isFinite(n) ? n : null;
  }, label);

  /* ---------- 1 & 2. each tile against its OWN stated basis ---------- */
  await apply('all', 'all');
  const rec = await tile('Received'), out = await tile('Outstanding (invoiced)'), rev = await tile('Revenue');
  const wRec = wantReceived('all', 'all'), wOut = wantOutstanding('all', 'all'), wRev = wantRevenue('all', 'all');
  if (rec != null && Math.abs(rec - wRec) < 0.02) ok(`Received = ${wRec.toLocaleString()} — an independent recount of amount_received over every verified-paid live row agrees, across all ${SEED.length} invoices`);
  else fail(`Received tile ${rec}, independent recount ${wRec}`);
  if (out != null && Math.abs(out - wOut) < 0.02) ok(`Outstanding (invoiced) = ${wOut.toLocaleString()} — an independent recount of amount_remaining over EVERY live row agrees`);
  else fail(`Outstanding tile ${out}, independent recount ${wOut}`);

  /* ---------- 3. the two bases are genuinely different, and Received is not Revenue ---------- */
  if (Math.abs(wOut - outstandingOnVerifiedBasis) > 1) ok(`control: on the verified-paid basis the other tiles use, Outstanding would read ${outstandingOnVerifiedBasis.toLocaleString()} instead of ${wOut.toLocaleString()} — the two bases are not the same number here, so checks 1 and 2 are two checks`);
  else fail(`control failed: the verified-only basis gives ${outstandingOnVerifiedBasis}, the same as the live basis — check 2 proves nothing on this fixture`);
  if (rec != null && rev != null && Math.abs(rec - rev) > 1) ok(`control: Received (${wRec.toLocaleString()}) and Revenue (${wRev.toLocaleString()}) are different numbers — the tile is not re-reading revenue`);
  else fail(`control failed: Received and Revenue read the same (${rec}) — the check above cannot tell them apart`);

  /* ---------- 4. neither tile counts a deleted or an excluded row ---------- */
  const delRec = num(SEED.find(r => r.id === 'ro-del').amount_received_sar), exclRec = num(SEED.find(r => r.id === 'ro-excl').amount_received_sar);
  const delRem = num(SEED.find(r => r.id === 'ro-del').amount_remaining_sar), exclRem = num(SEED.find(r => r.id === 'ro-excl').amount_remaining_sar);
  const bad4 = [];
  if (rec != null && (Math.abs(rec - (wRec + delRec)) < 0.02 || Math.abs(rec - (wRec + exclRec)) < 0.02 || Math.abs(rec - (wRec + delRec + exclRec)) < 0.02)) bad4.push('Received');
  if (out != null && (Math.abs(out - (wOut + delRem)) < 0.02 || Math.abs(out - (wOut + exclRem)) < 0.02 || Math.abs(out - (wOut + delRem + exclRem)) < 0.02)) bad4.push('Outstanding');
  if (!bad4.length) ok(`a soft-deleted invoice holding ${delRec.toLocaleString()} received / ${delRem.toLocaleString()} outstanding and a standing-excluded client holding ${exclRec.toLocaleString()} / ${exclRem.toLocaleString()} reach neither tile`);
  else fail(bad4.join(' and ') + ' counts a deleted or excluded row');

  /* ---------- 5. both obey the period bar ---------- */
  const PERIODS = [[2026, 'all'], [2026, 'Q2'], [2026, 'M:June'], [2025, 'all'], [2024, 'Q4']];
  let bad5 = 0;
  for (const [y, pt] of PERIODS) {
    await apply(y, pt);
    const r1 = await tile('Received'), o1 = await tile('Outstanding (invoiced)');
    const wr = wantReceived(y, pt), wo = wantOutstanding(y, pt);
    if (r1 != null && o1 != null && Math.abs(r1 - wr) < 0.02 && Math.abs(o1 - wo) < 0.02) ok(`${y} · ${pt}: Received ${wr.toLocaleString()} and Outstanding ${wo.toLocaleString()} both match an independent recount of exactly that period`);
    else { bad5++; fail(`${y} · ${pt}: Received tile ${r1} (recount ${wr}), Outstanding tile ${o1} (recount ${wo})`); }
  }
  if (!bad5) ok('both tiles narrow with the period bar, on their own separate bases');

  /* ---------- 6. unreadable money is repaired the same way for both, and the page says so ---------- */
  await apply(2026, 'M:June');
  const warn = await p.evaluate(() => {
    const t = (document.getElementById('view') || {}).innerText || '';
    const m = t.match(/(\d+)\s+rows?\s+in this period carr/);
    return m ? +m[1] : (/unreadable amount/.test(t) ? 0 : null);
  });
  const wantBad = SEED.filter(r => !r.deleted_at && r.client_group !== EXCLUDED_GROUP && inPeriod(r, 2026, 'M:June'))
    .filter(r => ['amount_received_sar', 'amount_remaining_sar', 'revenue_sar', 'cost_sar', 'profit_sar', 'total_incl_vat_sar', 'wallet_portion_sar', 'vat_sar']
      .some(k => { const v = r[k]; return v != null && v !== '' && !(typeof v === 'number' ? isFinite(v) : (isFinite(parseFloat(String(v).replace(/[,\s]/g, ''))) && /^-?[\d.,\s]+$/.test(String(v).trim()))); })).length;
  if (warn === wantBad && wantBad > 0) ok(`the ${wantBad} rows carrying money that cannot be read are counted as 0 in BOTH tiles and the page says so, with the count — it does not quietly absorb them`);
  else if (warn === null) fail(`${wantBad} rows in this period carry unreadable money and the page prints no warning at all`);
  else fail(`the page reports ${warn} rows with unreadable money, an independent count says ${wantBad}`);
  /* and "1,250.50" is a READABLE amount that must be repaired to 1250.5, not zeroed —
     already folded into wantReceived above, so a tile that zeroed it would have failed check 5 */

  if (!errors.length) ok('no page error at 3,200 invoices with hostile money in both amount fields');
  else fail('page errors: ' + errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures ? '✗ ' + failures + ' failed' : '✓ all checks passed'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
