/* check-live-data-shapes.mjs — does the LIVE database still hold records in a shape this app can
   read? Run by hand, like check-live-matches-repo; it reaches production and is not in the battery.

   Written 2026-09-24 (fire #239) as the standing companion to the fixes in #237 and #238. Those two
   rounds found what malformed records actually cost:

     · a single null inside one record's `activities` array threw inside `rows.map(rowToApp)` and
       left the app with ZERO companies, silently — one bad row would have taken all 108;
     · a non-numeric `lastContact` printed "NaNd ago" and «قبل NaN ي» on the Leads list;
     · a stored profit that does not equal revenue minus cost was explained away as rounding on the
       money screen, which M1 says must always be clean;
     · one unreadable invoice date became the Finance header's "data through" claim.

   The app is hardened against all four now — a row it cannot read costs that row and says so. This
   asks the other half of the question, which no amount of hardening answers: **is any of it
   actually there?** Measured the day this was written: none of the thirteen shapes below appears in
   the live data at all, so those fixes are preventive rather than firefighting, and this check says
   so in one command rather than by argument.

   It reads and never writes. It prints the count for every shape, including the zeros, because a
   list of only the problems cannot be told apart from a list that failed to look.

   Exit code: 0 when every count is zero, 1 when anything is found — so it can be trusted in a
   script — and 2 when it could not reach the database, which is NOT the same answer as "clean".

   Run: node scripts/qa/check-live-data-shapes.mjs                                                */
const REAL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
/* the publishable key and the QA account, the same pair every live check here uses; the team's real
   passwords are never in this repository (CLAUDE.md) */
const KEY = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';
const EMAIL = 'test@directksa.com';
const PW = 'Dq7nTest-2026-Riyadh';

const die = (msg) => { console.log('check-live-data-shapes COULD NOT RUN — ' + msg); process.exit(2); };

let H;
try {
  const r = await fetch(REAL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  });
  const tok = await r.json();
  if (!tok || !tok.access_token) die('could not sign in (' + r.status + ')');
  H = { apikey: KEY, Authorization: 'Bearer ' + tok.access_token };
} catch (e) { die('no network to the database — ' + String((e && e.message) || e)); }

const get = async (path) => {
  try {
    const r = await fetch(REAL + '/rest/v1/' + path, { headers: H });
    const j = await r.json();
    if (!Array.isArray(j)) die('the database refused a read: ' + JSON.stringify(j).slice(0, 120));
    return j;
  } catch (e) { die('a read failed — ' + String((e && e.message) || e)); }
};

const biz = await get('businesses?select=id,name,raw,next_action_date,contract_end&archived_at=is.null');
const fin = await get('finance_invoices?select=id,invoice_date,revenue_sar,cost_sar,profit_sar,total_incl_vat_sar,wallet_portion_sar&deleted_at=is.null');
const ev = await get('ksa_events?select=id,start_date,end_date');

const n = (v) => (v === null || v === undefined ? null : Number(v));
const isoish = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
const raw = (b) => (b && b.raw && typeof b.raw === 'object' ? b.raw : {});

/* Each line names the fault it guards, so a future reader knows why it is here and not just what
   it counts. The wording is the same the fixes use. */
const CHECKS = [
  ['a company with no name at all', biz.filter((b) => !String(b.name || '').trim()).length],
  ['a company whose stored blob is not an object', biz.filter((b) => b.raw !== null && b.raw !== undefined && typeof b.raw !== 'object').length],
  ['a company whose activities are not a list (fire #237: this is the one that emptied the app)', biz.filter((b) => { const a = raw(b).activities; return a !== undefined && !Array.isArray(a); }).length],
  ['a company with an empty slot inside its activities (#237)', biz.filter((b) => { const a = raw(b).activities; return Array.isArray(a) && a.some((x) => !x); }).length],
  ['a company with an empty slot inside its contacts', biz.filter((b) => { const c = raw(b).contacts; return Array.isArray(c) && c.some((x) => !x); }).length],
  ['a company whose last contact is not a number (#237: printed "NaNd ago")', biz.filter((b) => { const l = raw(b).lastContact; return l !== undefined && l !== null && !isFinite(Number(l)); }).length],
  ['a company whose next-action date cannot be read', biz.filter((b) => b.next_action_date && !isoish(b.next_action_date)).length],
  ['a company whose contract end cannot be read', biz.filter((b) => b.contract_end && !isoish(b.contract_end)).length],
  ['an invoice with text where a number belongs', fin.filter((r) => ['revenue_sar', 'cost_sar', 'profit_sar', 'total_incl_vat_sar', 'wallet_portion_sar'].some((k) => r[k] !== null && !isFinite(Number(r[k])))).length],
  ['an invoice whose profit does not equal revenue minus cost (M1, #238)', fin.filter((r) => Math.abs((n(r.revenue_sar) || 0) - (n(r.cost_sar) || 0) - (n(r.profit_sar) || 0)) >= 0.005).length],
  ['an invoice whose revenue does not equal total minus wallet (M1)', fin.filter((r) => Math.abs((n(r.total_incl_vat_sar) || 0) - (n(r.wallet_portion_sar) || 0) - (n(r.revenue_sar) || 0)) >= 0.005).length],
  ['an invoice whose date cannot be read (#238: became the "data through" claim)', fin.filter((r) => r.invoice_date && !isoish(r.invoice_date)).length],
  ['an event whose end date is before its start', ev.filter((e) => isoish(e.start_date) && isoish(e.end_date) && Date.parse(e.end_date) < Date.parse(e.start_date)).length],
];

console.log('checked the live database: ' + biz.length + ' companies, ' + fin.length + ' invoices, ' + ev.length + ' events');
let found = 0;
CHECKS.forEach(([what, count]) => {
  if (count) found += count;
  console.log('  ' + (count ? '>> ' : '   ') + String(count).padStart(3, ' ') + '  ' + what);
});

if (found) {
  console.log('\ncheck-live-data-shapes FOUND ' + found + ' record(s) in a shape the app has to work around.');
  console.log('The app will not break on them — a record it cannot read costs that record and says so (M82) —');
  console.log('but each one is a record somebody cannot see properly, so they are worth correcting at the source.');
  process.exit(1);
}
console.log('\ncheck-live-data-shapes OK — every record is in a shape the app reads cleanly.');
process.exit(0);
