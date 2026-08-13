/* The real security wall, measured exactly: sign in as each person, then attempt every kind of
   write with THEIR OWN token and count the rows that actually changed. A blocked UPDATE returns
   "no error, zero rows" — so counting rows is the only honest test.
   Run: NODE_USE_ENV_PROXY=1 node probe-rls-matrix.mjs                                        */
import { TEAM } from './emp-rig.mjs';

const URL = 'https://vkxoeeoauexyfpzqufqd.supabase.co';
const ANON = 'sb_publishable_2UUruIl4fecmPNDpBFOVBw_FLZfNWlr';

const PEOPLE = [
  ['admin',       TEAM.admin.email,  TEAM.admin.pw],
  ['manager',     TEAM.othman.email, TEAM.othman.pw],
  ['team_member', TEAM.assem.email,  TEAM.assem.pw],
  ['team_member', TEAM.raad.email,   TEAM.raad.pw],
];

/* 1 = this role MUST be able to do it, 0 = the database MUST refuse it */
const EXPECT = {
  /* The model set on 2026-08-13. Admin and manager may write everything; an employee works
     leads, clients and finance — and is refused the company settings row. */
  admin:       { businesses: 1, activities: 1, app_offers: 1, app_requests: 1, app_bookings: 1, finance_invoices: 1, finance_expenses: 1, app_settings: 1, promo_codes: 1 },
  manager:     { businesses: 1, activities: 1, app_offers: 1, app_requests: 1, app_bookings: 1, finance_invoices: 1, finance_expenses: 1, app_settings: 1, promo_codes: 1 },
  team_member: { businesses: 1, activities: 1, app_offers: 1, app_requests: 1, app_bookings: 1, finance_invoices: 1, finance_expenses: 1, app_settings: 0, promo_codes: 1 },
};

const LOG = []; const STEP = (n, ok, d = '') => { LOG.push(`${ok ? 'PASS' : 'FAIL'} · ${n}${d ? ' — ' + d : ''}`); console.log(LOG[LOG.length - 1]); };
const created = [];

async function token(email, pw) {
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  }).then(r => r.json());
  return r.access_token || null;
}
const H = t => ({ apikey: ANON, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Prefer: 'return=representation' });

async function ins(t, table, row) {
  const r = await fetch(`${URL}/rest/v1/${table}`, { method: 'POST', headers: H(t), body: JSON.stringify(row) });
  const body = await r.json().catch(() => null);
  const rows = Array.isArray(body) ? body.length : 0;
  if (rows) created.push([table, body[0].id]);
  return { did: rows > 0, status: r.status, why: (body && body.message) || '' };
}
async function upd(t, table, filter, patch) {
  const r = await fetch(`${URL}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: H(t), body: JSON.stringify(patch) });
  const body = await r.json().catch(() => null);
  const rows = Array.isArray(body) ? body.length : 0;
  return { did: rows > 0, status: r.status, why: (body && body.message) || '' };
}

/* a company, an invoice and a promo code that certainly exist */
const admTok = await token(TEAM.admin.email, TEAM.admin.pw);
const oneBiz = await fetch(`${URL}/rest/v1/businesses?select=id,name&limit=1`, { headers: H(admTok) }).then(r => r.json());
const onePromo = await fetch(`${URL}/rest/v1/promo_codes?select=code&limit=1`, { headers: H(admTok) }).then(r => r.json());
const settingsRow = await fetch(`${URL}/rest/v1/app_settings?select=id&limit=1`, { headers: H(admTok) }).then(r => r.json());
const BIZ = oneBiz[0], PROMO = onePromo[0], SET = settingsRow[0];
console.log('probe targets:', JSON.stringify({ biz: BIZ && BIZ.name, promo: PROMO && PROMO.code, settings: SET && SET.id }));

for (const [role, email, pw] of PEOPLE) {
  const who = email.split('@')[0].replace(/[^a-z0-9]/gi, '');
  console.log(`\n———— ${role} (${email}) ————`);
  const t = await token(email, pw);
  STEP(`${role}: can sign in`, !!t);
  if (!t) continue;
  const got = {};
  got.businesses       = await upd(t, 'businesses', `id=eq.${BIZ.id}`, { verification_source: 'rls-probe-' + role });
  got.activities       = await ins(t, 'activities', { business_id: BIZ.id, type: 'Note', note: 'rls probe ' + role, by_user: role });
  got.app_offers       = await ins(t, 'app_offers', { id: 'rlsprobe-off-' + who, data: { id: 'rlsprobe-off-' + who, ref: 'RLS' } });
  got.app_requests     = await ins(t, 'app_requests', { id: 'rlsprobe-req-' + who, data: { id: 'rlsprobe-req-' + who, client: 'RLS' } });
  got.app_bookings     = await ins(t, 'app_bookings', { id: 'rlsprobe-bk-' + who, data: { id: 'rlsprobe-bk-' + who, ref: 'RLS' } });
  got.finance_invoices = await upd(t, 'finance_invoices', `invoice_no=eq.INV-2026-1101`, { notes: 'rls probe ' + role });
  got.finance_expenses = await ins(t, 'finance_expenses', { expense_date: '2026-08-13', description: 'rls probe ' + role, category: 'Other', amount_sar: 1, paid_via: 'cash' });
  got.app_settings     = SET ? await upd(t, 'app_settings', `id=eq.${SET.id}`, { data: { rlsProbe: role } }) : { did: false, why: 'no settings row' };
  got.promo_codes      = PROMO ? await upd(t, 'promo_codes', `code=eq.${encodeURIComponent(PROMO.code)}`, { notes: 'rls probe ' + role }) : { did: false, why: 'no promo row' };

  Object.keys(EXPECT[role]).forEach(tbl => {
    const want = !!EXPECT[role][tbl], did = !!got[tbl].did;
    STEP(`${role}: ${want ? 'CAN' : 'cannot'} write ${tbl}`, did === want,
      did === want ? '' : (did ? '!!! ALLOWED — must be refused' : 'refused (' + got[tbl].status + ' ' + String(got[tbl].why).slice(0, 60) + ')'));
  });
}

/* clean up every row the probe created */
console.log('\ncleaning up ' + created.length + ' probe rows…');
for (const [table, id] of created) {
  await fetch(`${URL}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: H(admTok) }).catch(() => {});
}
await upd(admTok, 'finance_invoices', 'invoice_no=eq.INV-2026-1101', { notes: null });
await upd(admTok, 'businesses', `id=eq.${BIZ.id}`, { verification_source: null });
if (PROMO) await upd(admTok, 'promo_codes', `code=eq.${encodeURIComponent(PROMO.code)}`, { notes: null });

console.log(`\nFAILS: ${LOG.filter(l => l.startsWith('FAIL')).length} / ${LOG.length}`);
process.exit(0);
