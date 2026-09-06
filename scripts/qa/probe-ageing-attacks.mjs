/* probe-ageing-attacks.mjs (2026-09-06, watch cycle 28) - the Clients ageing card, invoice by invoice.

   What was and was not already guarded. probe-scale-attacks checks that the ageing TOTAL matches a
   recount and that the buckets sum to it. Neither is the question a collections manager actually
   asks the card. Both of those pass perfectly while every invoice sits in the wrong bucket: shift
   all four boundaries by a month and the total is unchanged and the buckets still sum. Nothing
   anywhere checked that a GIVEN invoice lands in the bucket its own age says it belongs in, and
   nothing exercised a boundary, a leap day, a ten-year-old debt or a date in the future.

   How the per-invoice claim is made checkable. Each boundary invoice carries a distinct power of
   two as its outstanding amount, so each rendered bucket total decomposes to exactly one set of
   invoices and names precisely which ones are in it - a per-invoice verdict out of one render.
   Every amount is kept under 1,000 SAR on purpose: moneyS() abbreviates at 1K ("1.2K") and at 1M,
   and below 1,000 it prints the exact integer, so the figures can be read off the page at full
   precision without changing the app to make the test possible.

   Under test:
     1. Each of d = 0, 30, 31, 60, 61, 90, 91 and a ten-year-old leap-day invoice lands in the
        bucket its label promises. Both sides of all three boundaries, not just the middles.
     2. An invoice dated in the FUTURE is not presented as 0-30 days old.
     3. A no-date invoice keeps its own amount (cycle 6's rule) and never enters a bucket.
     4. A settled invoice, a soft-deleted one and a standing-excluded client's one reach neither
        Outstanding nor any bucket, at either end of the age range.
     5. Buckets + no-date + future = Outstanding = an independent recount.
     6. "% overdue" does not read as a fact about all outstanding money when much of it sits on
        invoices carrying no due date at all (19 of 46 live invoices carry none).

   Run:  node scripts/qa/probe-ageing-attacks.mjs        (port 8235)
   Sabotage (file-level): shift the bucket comparisons by a month; drop the d<0 branch; count a
   deleted row. Restore byte-identical (md5). */
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
import { start } from './mock-supabase.mjs';
import fs from 'fs';
const LIB = fs.readFileSync('/tmp/node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8');
const PORT = 8235;
let failures = 0;
const fail = (m) => { failures++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);
const note = (m) => console.log('  · ' + m);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EXCLUDED_GROUP = 'Takamol Ageing QA';

/* Dates are generated from TODAY's UTC day, so the fixture is never stale: a row built at
   "today minus 30 days" is exactly d=30 whatever day this runs. */
const TODAY = new Date();
const TODAY_UTC = Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate());
const dayOffset = (n) => new Date(TODAY_UTC - n * 86400000).toISOString().slice(0, 10);

/* the ten-year row is deliberately a 29 February, so one row covers both the long span and the
   leap day rather than pretending they are separate cases */
function lastLeapBefore(years) {
  let y = new Date(TODAY_UTC - years * 365.25 * 86400000).getUTCFullYear();
  while (!((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) y--;
  return y + '-02-29';
}
const LEAP_DATE = lastLeapBefore(10);
const LEAP_D = Math.floor((Date.now() - Date.parse(LEAP_DATE)) / 86400000);

/* name → [days before today (negative = future), outstanding amount, expected bucket] */
const BOUNDARY = [
  ['future +120d', -120, 1,   'future'],
  ['d=0 (today)',     0, 2,   'b030'],
  ['d=30',           30, 4,   'b030'],
  ['d=31',           31, 8,   'b3160'],
  ['d=60',           60, 16,  'b3160'],
  ['d=61',           61, 32,  'b6190'],
  ['d=90',           90, 64,  'b6190'],
  ['d=91',           91, 128, 'b90'],
];
const NODATE_AMT = 300;

function inv(id, date, total, remaining, extra) {
  const mo = date ? +date.slice(5, 7) : 1;
  return Object.assign({
    id, invoice_no: 'AG-' + id, line_no: 1, zatca_dpin: null,
    client_group: 'Ageing Client ' + (id.charCodeAt(id.length - 1) % 5),
    customer_raw_name: 'Ageing Client ' + (id.charCodeAt(id.length - 1) % 5),
    invoice_date: date, year: date ? +date.slice(0, 4) : null,
    month: date ? MONTHS[mo - 1] : null, quarter: date ? 'Q' + (Math.floor((mo - 1) / 3) + 1) : null,
    products: 'Flights', service_type: 'Flights', record_type: 'b2b',
    total_incl_vat_sar: total, wallet_portion_sar: 0, revenue_sar: total,
    cost_sar: 0, profit_sar: total, vat_sar: 0,
    amount_received_sar: total - remaining, amount_remaining_sar: remaining,
    integrity_status: remaining > 0 ? 'pending' : 'verified_paid',
    collection_due_date: null,
    exclusion_reason: null, notes: null, source_batch: 'ag-qa', revenue_way: 'invoice',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null
  }, extra || {});
}

const SEED = [];
BOUNDARY.forEach(([name, d, amt], i) => SEED.push(inv('b' + i, dayOffset(d), amt + 1000, amt)));
SEED.push(inv('bleap', LEAP_DATE, 1256, 256));                       // ten years old, 29 February
SEED.push(inv('bnodate', null, NODATE_AMT + 1000, NODATE_AMT));      // no invoice date at all
/* settled invoices at both ends of the range — must enter no bucket */
SEED.push(inv('paid-new', dayOffset(3), 90000, 0));
SEED.push(inv('paid-old', dayOffset(2500), 80000, 0));
/* a soft-deleted debt and a standing-excluded client's debt, both large enough that a leak into
   any bucket would print as "777.8K" / "999.9K" rather than a plausible number */
SEED.push(inv('gone', dayOffset(400), 777777, 777777, { deleted_at: '2026-08-01T00:00:00Z' }));
SEED.push(inv('excl', dayOffset(400), 999999, 999999, { client_group: EXCLUDED_GROUP, customer_raw_name: EXCLUDED_GROUP }));

const WANT = { b030: 0, b3160: 0, b6190: 0, b90: 0, future: 0, nodate: NODATE_AMT };
BOUNDARY.forEach(([n, d, amt, b]) => { WANT[b] += amt; });
WANT.b90 += 256;                                     // the leap-day ten-year row
const WANT_OUT = Object.values(WANT).reduce((a, b) => a + b, 0);
/* which invoices each bucket should decompose to, so a wrong figure can name the culprit */
const MEMBERS = {};
BOUNDARY.forEach(([n, d, amt, b]) => { (MEMBERS[b] = MEMBERS[b] || []).push([n, amt]); });
(MEMBERS.b90 = MEMBERS.b90 || []).push(['leap ' + LEAP_DATE + ' (d=' + LEAP_D + ')', 256]);
const decode = (bucket, got) => {
  const ms = MEMBERS[bucket] || [];
  const inb = ms.filter(([, a]) => (got & a) === a).map(([n]) => n);
  const rest = got - inb.reduce((s, n) => s + (ms.find(([m]) => m === n) || [0, 0])[1], 0);
  return inb.join(' + ') + (rest ? ' + ' + rest + ' unaccounted' : '') || '(nothing)';
};

const srv = start(PORT, { finance_invoices: SEED, finance_transactions: [], finance_client_links: [], client_profiles: [] });
const BASE = 'http://localhost:' + PORT;

async function main() {
  console.log(`fixture: ${SEED.length} invoices · boundaries at d = ${BOUNDARY.map(b => b[1]).join(', ')} · leap ${LEAP_DATE} (d=${LEAP_D})`);
  console.log(`expected: 0–30 ${WANT.b030} · 31–60 ${WANT.b3160} · 61–90 ${WANT.b6190} · 90+ ${WANT.b90} · future ${WANT.future} · no date ${WANT.nodate} · outstanding ${WANT_OUT}`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
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
  await p.goto(BASE + '/finance', { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(1800);
  await p.fill('#cl_email', 'test@directksa.com'); await p.fill('#cl_pw', 'Dq7nTest-2026-Riyadh'); await p.click('#cl_go');
  await p.waitForTimeout(4500);
  await p.evaluate((g) => {
    DB.settings = DB.settings || {};
    DB.settings.financeExclusions = [{ id: 'fx-ag', clientId: 'ag-excl', matchNames: [g], reason: 'QA fixture — standing exclusion', addedBy: 'probe', addedAt: new Date().toISOString() }];
  }, EXCLUDED_GROUP);
  await p.evaluate(() => { current = 'finance'; FIN.rows = null; finLoad(); });
  for (let i = 0; i < 140 && !(await p.evaluate(() => window.FIN && FIN.rows && FIN.rows.length)); i++) await p.waitForTimeout(250);
  await p.evaluate(() => { if (typeof clearFinCanon === 'function') clearFinCanon(); FIN.p.year = 'all'; FIN.p.part = 'all'; FIN.p.sector = 'all'; finGo('clients'); });
  await p.waitForTimeout(1600);

  /* read the ageing card exactly as a person sees it */
  const card = await p.evaluate(() => {
    const h3 = [...document.querySelectorAll('#view h3')].find(e => /Collections & ageing|التحصيل والتقادم/.test(e.textContent));
    if (!h3) return null;
    const c = h3.closest('.card');
    const chips = {};
    c.querySelectorAll('div').forEach(d => {
      const lbl = d.firstElementChild, val = d.children[1];
      if (!lbl || !val || d.children.length !== 2) return;
      const L = (lbl.textContent || '').trim(), V = (val.textContent || '').trim();
      if (/^(0–30 days|31–60 days|61–90 days|90\+ days|No invoice date|Days to collect|% overdue|Outstanding)/.test(L) || /date|future|ahead|issued/i.test(L)) chips[L] = V;
    });
    return { text: c.innerText, chips, html: c.innerHTML.length };
  });
  if (!card) { fail('the Collections & ageing card did not render at all'); console.log('\n✗ ' + failures + ' failed'); await b.close(); srv.close(); process.exit(1); }
  const num = (s) => s == null ? null : +String(s).replace(/[^\d.-]/g, '');
  const chip = (label) => {
    const k = Object.keys(card.chips).find(x => x.indexOf(label) === 0);
    return k == null ? null : num(card.chips[k]);
  };
  note('card reads: ' + JSON.stringify(card.chips));

  /* ---------- 1. every boundary invoice in the bucket its label promises ---------- */
  const GOT = { b030: chip('0–30 days'), b3160: chip('31–60 days'), b6190: chip('61–90 days'), b90: chip('90+ days'), nodate: chip('No invoice date') };
  let bad = 0;
  [['b030', '0–30 days'], ['b3160', '31–60 days'], ['b6190', '61–90 days'], ['b90', '90+ days']].forEach(([k, lbl]) => {
    if (GOT[k] === WANT[k]) ok(`${lbl} holds exactly ${WANT[k]} — ${decode(k, WANT[k])}`);
    else { bad++; fail(`${lbl} holds ${GOT[k]}, expected ${WANT[k]} — page has [${decode(k, GOT[k] || 0)}], should be [${decode(k, WANT[k])}]`); }
  });
  if (!bad) ok('both sides of all three boundaries (30/31, 60/61, 90/91) land where the labels promise, and a ten-year-old 29-February debt ages correctly');

  /* ---------- 2. a future-dated invoice is not called 0–30 days old ---------- */
  const futureChipKey = Object.keys(card.chips).find(k => /future|ahead|issued|لاحق|مستقبل/i.test(k));
  if (futureChipKey) ok(`an invoice dated 120 days in the FUTURE is held in its own "${futureChipKey.trim()}" amount (${card.chips[futureChipKey]}), not aged as freshly issued`);
  else if (GOT.b030 === WANT.b030 + WANT.future) fail(`an invoice dated 120 days in the FUTURE is counted in "0–30 days" — an age it cannot have. Cycle 6 gave the no-date row its own amount for exactly this reason (M8: never invent a number to fill a gap)`);
  else fail(`the future-dated invoice (${WANT.future} SAR) is not in 0–30 days and has no amount of its own — where did it go?`);

  /* ---------- 3. the no-date row keeps cycle 6's rule ---------- */
  if (GOT.nodate === NODATE_AMT) ok(`the invoice with no date keeps its own "No invoice date" amount of ${NODATE_AMT} and enters no bucket — cycle 6's rule still holds`);
  else fail(`"No invoice date" reads ${GOT.nodate}, expected ${NODATE_AMT}`);

  /* ---------- 4 & 5. nothing settled, deleted or excluded reaches the card ---------- */
  const out = chip('Outstanding');
  if (out === WANT_OUT) ok(`Outstanding is ${WANT_OUT} — an independent recount agrees, so the two settled invoices (170,000 billed) contribute nothing`);
  else fail(`Outstanding reads ${out}, an independent recount of the live unpaid rows gives ${WANT_OUT}`);
  const sumBuckets = (GOT.b030 || 0) + (GOT.b3160 || 0) + (GOT.b6190 || 0) + (GOT.b90 || 0) + (GOT.nodate || 0) + (futureChipKey ? num(card.chips[futureChipKey]) : 0);
  if (sumBuckets === out) ok('every outstanding riyal lands in exactly one amount on the card — the buckets, the no-date amount and the future amount add up to Outstanding with nothing lost between them');
  else fail(`the amounts on the card sum to ${sumBuckets}, Outstanding reads ${out} — ${Math.abs(sumBuckets - out)} is unaccounted for`);
  /* 2026-09-06 (watch cycle 28): this check first searched the rendered text for "777" or "999"
     — and PASSED while the deleted debt was leaking, because moneyS() abbreviates a leaked
     778,161 to "778.2K" and neither string appears. A check that a leak can slip past is not a
     check. It now tests the bucket a 400-day debt would land in against its exact expected
     value, which is the thing actually claimed. */
  const b90Got = GOT.b90 || 0;
  const delAmt = 777777, exclAmt = 999999;
  if (b90Got === WANT.b90 && out === WANT_OUT)
    ok(`a soft-deleted ${delAmt.toLocaleString()} debt and a standing-excluded client's ${exclAmt.toLocaleString()} debt, both aged 400 days, reach neither Outstanding nor the 90+ bucket — 90+ is exactly ${WANT.b90}, not ${(WANT.b90 + delAmt).toLocaleString()} or ${(WANT.b90 + exclAmt).toLocaleString()}`);
  else fail(`a deleted or excluded 400-day debt reached the card: 90+ reads ${b90Got} (expected ${WANT.b90}), Outstanding reads ${out} (expected ${WANT_OUT})`);

  /* ---------- 6. "% overdue" against money that has no due date ---------- */
  const pct = chip('% overdue');
  const noDueOutstanding = SEED.filter(r => !r.deleted_at && r.client_group !== EXCLUDED_GROUP && r.amount_remaining_sar > 0 && !r.collection_due_date)
    .reduce((a, r) => a + r.amount_remaining_sar, 0);
  const saysSo = /due date|no due|بدون تاريخ استحقاق|تاريخ استحقاق/i.test(card.text);
  if (pct === 0 && noDueOutstanding === WANT_OUT && (GOT.b90 || 0) > 0 && !saysSo)
    fail(`the card prints "% overdue: 0%" beside a 90+ bucket holding ${GOT.b90} — every riyal outstanding sits on an invoice with NO collection due date, so nothing can ever be counted overdue, and the card does not say so. 19 of the 46 live invoices carry no due date`);
  else if (saysSo) ok('where outstanding money sits on invoices carrying no due date, the card says so rather than letting "% overdue" read as a fact about all of it');
  else ok(`% overdue reads ${pct}% against ${noDueOutstanding} of ${WANT_OUT} outstanding carrying no due date`);

  if (!errors.length) ok('no page error'); else fail('page errors: ' + errors.slice(0, 3).join(' | '));

  console.log('\n' + (failures ? '✗ ' + failures + ' failed' : '✓ all checks passed'));
  await b.close(); srv.close(); process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); try { srv.close(); } catch (_) { } process.exit(1); });
