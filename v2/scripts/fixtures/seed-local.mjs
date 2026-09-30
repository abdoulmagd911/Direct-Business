#!/usr/bin/env node
// @ts-check
// A made-up world, for this machine only (the oversight, 29 Sep 15:55 item 4), so QA can draw every page as every
// kind of person:
//   · made-up people for every role and every kind of account — an admin, a head, a manager, two team members, a
//     viewer, the admin account and the test account (V444, V445), someone switched off and someone who has left —
//     each with an allowed @example.test address and one shared made-up password;
//   · data for every module built so far — organisations on both sides, contacts, identifiers, activities, notes with
//     mentions, contracts (some ending soon), statuses, owners, follows, references, a credit limit, a campaign code,
//     saved views, a team — written through the app's own doors (api.*) as those people, so every rule, log, history
//     entry and notification is the real one; then the daily alerts job runs once.
// The people and their sign-ins are written straight into the local database, as the E2E specs do (a person exists
// before any door lets them in); everything else goes through api.*.
//
//   node scripts/fixtures/seed-local.mjs     (from v2/, with the local stack running: supabase start, db reset --local)
//
// It refuses any address that is not on this machine, and any database that already allows an address outside
// @example.test (scripts/fixtures/guard.mjs). A second run finds its people and stops; `supabase db reset --local`
// starts again from nothing. Every value is made up (rule 7).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { FIXTURE_DOMAIN, notLocal, notMadeUp } from './guard.mjs';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PASSWORD = 'Fixture-Pass-2026';
const email = (/** @type {string} */ key) => `fixture.${key.replace(/_/g, '-')}@${FIXTURE_DOMAIN}`;
const day = (/** @type {number} */ offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function fail(/** @type {string} */ why) {
  console.error(`fixture seed: ${why}`);
  process.exit(1);
}

// ---------------------------------------------------------------- where: the local stack, and nothing else
const out = spawnSync('node', ['scripts/e2e/stack-env.mjs'], { cwd: V2, encoding: 'utf8' });
if (out.status !== 0) fail(out.stderr.trim() || 'the local stack did not answer (supabase start)');
/** @type {Record<string, string>} */
const env = {};
for (const line of out.stdout.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
}
const refusal = notLocal({ 'the API': env.NEXT_PUBLIC_SUPABASE_URL, 'the database': env.V2_DB_URL });
if (refusal) fail(refusal);
const URL_API = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY_SECRET = env.SUPABASE_SECRET_KEY ?? '';
const KEY_PUBLIC = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const db = new pg.Client({ connectionString: env.V2_DB_URL });
await db.connect();
const sql = async (/** @type {string} */ text, /** @type {unknown[]} */ params = []) =>
  (await db.query(text, params)).rows;

const allowed = (await sql(`select email::text from core.person_email`)).map((r) => r.email);
const notOurs = notMadeUp(allowed);
if (notOurs) fail(notOurs);
if (allowed.includes(email('admin'))) {
  console.log('fixture seed: the made-up people are already here — `supabase db reset --local` to start again.');
  await db.end();
  process.exit(0);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_API, KEY_SECRET, opts).auth.admin;

// ---------------------------------------------------------------- who: every role and every kind of account
/**
 * @typedef {{ key: string, en: string, ar: string, role: string, title?: string, manager?: string, team?: boolean,
 *             account?: string, canSignIn?: boolean, leftDaysAgo?: number }} Spec
 */
/** @type {Spec[]} */
const PEOPLE = [
  { key: 'admin', en: 'Fixture Admin', ar: 'مسؤول تجريبي', role: 'admin', title: 'Commercial director' },
  { key: 'head', en: 'Fixture Head', ar: 'رئيس تجريبي', role: 'head', title: 'Head of sales', manager: 'admin' },
  {
    key: 'manager',
    en: 'Fixture Manager',
    ar: 'مدير تجريبي',
    role: 'manager',
    title: 'Sales manager',
    manager: 'head',
    team: true,
  },
  {
    key: 'member1',
    en: 'Fixture Member One',
    ar: 'عضو تجريبي أول',
    role: 'member',
    title: 'Account manager',
    manager: 'manager',
    team: true,
  },
  {
    key: 'member2',
    en: 'Fixture Member Two',
    ar: 'عضو تجريبي ثان',
    role: 'member',
    title: 'Account manager',
    manager: 'manager',
    team: true,
  },
  { key: 'viewer', en: 'Fixture Viewer', ar: 'مشاهد تجريبي', role: 'viewer', title: 'Analyst' },
  {
    key: 'admin_account',
    en: 'Fixture Admin Account',
    ar: 'حساب إداري تجريبي',
    role: 'admin',
    account: 'admin_account',
  },
  {
    key: 'test_account',
    en: 'Fixture Test Account',
    ar: 'حساب اختبار تجريبي',
    role: 'member',
    account: 'test_account',
  },
  {
    key: 'switched_off',
    en: 'Fixture Switched Off',
    ar: 'موظف موقوف تجريبي',
    role: 'member',
    manager: 'manager',
    canSignIn: false,
  },
  {
    key: 'departed',
    en: 'Fixture Departed',
    ar: 'موظف غادر تجريبي',
    role: 'member',
    manager: 'manager',
    leftDaysAgo: 10,
  },
];

await sql(`insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري')
           on conflict (code) do nothing`);
const [dep] = await sql(`select id from core.department where code = 'commercial'`);
const [{ id: teamId }] = await sql(
  `insert into core.team (department_id, code, name_en, name_ar) values ($1, 'fixture_desk', 'Fixture desk', 'مكتب تجريبي')
   returning id`,
  [dep.id],
);
const hasAccount =
  (
    await sql(`select 1 from information_schema.columns where table_schema = 'core'
                               and table_name = 'person' and column_name = 'account'`)
  ).length > 0;

/** @type {Record<string, string>} */
const id = {};
for (const p of PEOPLE) {
  const [row] = await sql(
    `insert into core.person (full_name_en, full_name_ar, job_title_en, department_id, team_id, manager_id, role_id,
                              can_sign_in, left_on, kind)
     values ($1, $2, $3, $4, $5, $6, (select id from core.role where key = $7), $8, $9, 'staff') returning id`,
    [
      p.en,
      p.ar,
      p.title ?? null,
      dep.id,
      p.team ? teamId : null,
      p.manager ? id[p.manager] : null,
      p.role,
      p.canSignIn !== false,
      p.leftDaysAgo ? day(-p.leftDaysAgo) : null,
    ],
  );
  id[p.key] = row.id;
  if (p.account && hasAccount) await sql(`update core.person set account = $2 where id = $1`, [row.id, p.account]);
  await sql(`insert into core.person_email (person_id, email, is_primary) values ($1, $2, true)`, [
    row.id,
    email(p.key),
  ]);
  const made = await admin.createUser({ email: email(p.key), password: PASSWORD, email_confirm: true });
  if (!made.data.user) fail(`could not make the sign-in for ${email(p.key)}: ${made.error?.message}`);
  await sql(
    `insert into core.person_auth (auth_user_id, person_id, email, password_set_at) values ($1, $2, $3, now())`,
    [made.data.user?.id, row.id, email(p.key)],
  );
}
await sql(`update core.team set lead_person_id = $2 where id = $1`, [teamId, id.manager]);
await sql(`update core.department set head_person_id = $2 where id = $1`, [dep.id, id.head]);

// ---------------------------------------------------------------- what: through the app's own doors, as each person
/** @type {Record<string, import('@supabase/supabase-js').SupabaseClient<any, 'api'>>} */
const as = {};
for (const key of ['admin', 'head', 'manager', 'member1', 'member2', 'viewer']) {
  const c = createClient(URL_API, KEY_PUBLIC, {
    ...opts,
    db: { schema: 'api' },
  });
  const signed = await c.auth.signInWithPassword({ email: email(key), password: PASSWORD });
  if (signed.error) fail(`${key} could not sign in: ${signed.error.message}`);
  const done = await c.rpc('sign_in_complete', { p_provider: 'email', p_device_label: 'Fixture seed' });
  if (done.data !== 'ok') fail(`${key}'s sign-in did not complete: ${done.data ?? done.error?.message}`);
  as[key] = c;
}
let calls = 0;
/** Calls api.<fn> as `who`; any refusal stops the seed, naming it. */
async function api(/** @type {string} */ who, /** @type {string} */ fn, /** @type {Record<string, unknown>} */ args) {
  const client = as[who];
  if (!client) fail(`${who} is not signed in`);
  const r = await /** @type {NonNullable<typeof client>} */ (client).rpc(fn, args);
  if (r.error) fail(`api.${fn} as ${who}: ${r.error.message} ${r.error.details ?? ''}`);
  calls++;
  return r.data;
}

/** @type {{ en: string, ar: string, sides: Record<string, unknown>[], by: string, contact: string, domain: string }[]} */
const ORGS = [
  {
    en: 'Fixture Travel Co',
    ar: 'شركة السفر التجريبية',
    by: 'member1',
    contact: 'Made-up Booker',
    domain: 'travel',
    sides: [{ side: 'client', type: 'corporate' }],
  },
  {
    en: 'Fixture Holidays Group',
    ar: 'مجموعة العطلات التجريبية',
    by: 'member2',
    contact: 'Made-up Planner',
    domain: 'holidays',
    sides: [{ side: 'client', type: 'agencies' }],
  },
  {
    en: 'Fixture Ministry Desk',
    ar: 'مكتب الوزارة التجريبي',
    by: 'manager',
    contact: 'Made-up Officer',
    domain: 'ministry',
    sides: [{ side: 'client', type: 'government' }],
  },
  {
    en: 'Fixture Air Partner',
    ar: 'شريك الطيران التجريبي',
    by: 'manager',
    contact: 'Made-up Account Lead',
    domain: 'air',
    sides: [{ side: 'supplier_partner', type: 'supplier' }],
  },
  {
    en: 'Fixture Both Sides Ltd',
    ar: 'شركة الجانبين التجريبية',
    by: 'head',
    contact: 'Made-up Partner Lead',
    domain: 'both',
    sides: [
      { side: 'client', type: 'corporate' },
      { side: 'supplier_partner', type: 'integration' },
    ],
  },
  {
    en: 'Fixture Pay Solutions',
    ar: 'حلول الدفع التجريبية',
    by: 'head',
    contact: 'Made-up Integrator',
    domain: 'pay',
    sides: [{ side: 'supplier_partner', type: 'payment_solution' }],
  },
];

/** @type {string[]} */
const partners = [];
for (const [n, o] of ORGS.entries()) {
  const made = /** @type {{ id: string }} */ (
    await api('head', 'partner_create', {
      p_partner: { trade_name_en: o.en, trade_name_ar: o.ar, sides: o.sides },
      p_reason: 'Fixture: made-up organisation',
    })
  );
  const p = made.id;
  partners.push(p);
  for (const s of o.sides)
    await api('head', 'partner_owner_set', {
      p_id: p,
      p_side: s.side,
      p_person: id[o.by],
      p_from: null,
      p_reason: 'Fixture: owner',
    });
  await api('head', 'contact_save', {
    p_partner: p,
    p_id: null,
    p_values: { name_en: o.contact, email: `desk@${o.domain}.${FIXTURE_DOMAIN}`, is_primary: true },
  });
  await api('head', 'identifier_add', {
    p_partner: p,
    p_kind: 'email',
    p_value: `bookings@${o.domain}.${FIXTURE_DOMAIN}`,
    p_reason: 'Fixture: made-up address',
  });
  for (const s of o.sides) {
    await api('head', 'partner_status_set', { p_id: p, p_side: s.side, p_status: n % 3 === 1 ? 'prospect' : 'active' });
    await api('head', 'contract_save', {
      p_partner: p,
      p_id: null,
      p_values: {
        side: s.side,
        title: `Fixture agreement ${n + 1}`,
        start_on: day(-300),
        end_on: day([7, 30, 60, 90, 200, 400][n] ?? 400),
      },
    });
  }
  await api(o.by === 'head' ? 'head' : o.by, 'activity_log', {
    p_partner: p,
    p_type: n % 2 ? 'meeting' : 'call',
    p_outcome: n % 2 ? 'meeting_held' : 'answered',
    p_happened_on: day(-n - 1),
    p_body: 'Made-up line: talked about the next season.',
    p_next_step: 'Send the made-up proposal',
    p_next_step_on: day(n + 2),
    p_mentions: null,
  });
  await api('head', 'note_add', {
    p_entity: 'partner',
    p_id: p,
    p_kind: 'comment',
    p_body: `Made-up remark for @${ORGS[(n + 1) % ORGS.length]?.contact}`,
    p_happened_on: null,
    p_mentions: [id.member2],
  });
  await api('head', 'reference_save', {
    p_partner: p,
    p_id: null,
    p_values: { system: 'portal', value: `fixture.user.${n + 1}`, url: `https://portal.${FIXTURE_DOMAIN}/login` },
    p_version: null,
    p_reason: 'Fixture: portal login',
  });
  await api('member2', 'follow', { p_entity: 'partner', p_id: p, p_on: true });
}

// a discount code on the first client, a credit limit, a campaign, saved views
await api('head', 'identifier_add', {
  p_partner: partners[0],
  p_kind: 'discount_code',
  p_value: 'FIXTURE10',
  p_reason: 'Fixture: made-up code',
});
await api('admin', 'credit_limit_set', {
  p_partner: partners[0],
  p_amount: 50000,
  p_effective_from: null,
  p_approved_by: id.admin,
  p_reason: 'Fixture: made-up limit',
});
await api('head', 'campaign_code_add', {
  p_code: 'FIXSPRING',
  p_name: 'Fixture spring offer',
  p_valid_from: day(0),
  p_valid_to: day(60),
  p_owner: id.manager,
  p_reason: 'Fixture: made-up campaign',
});
await api('member1', 'view_save', {
  p_id: null,
  p_page: 'clients',
  p_name: 'My fixture clients',
  p_query: {},
  p_shared: false,
});
await api('head', 'view_save', {
  p_id: null,
  p_page: 'clients',
  p_name: 'Team fixture view',
  p_query: {},
  p_shared: true,
});

// the daily alerts job, once: the first three contracts end on a reminder day (7, 30 and 60 days out), so their
// reminders are due today — a reminder day from before a contract existed is never caught up (V174)
await sql(`select notify.generate_alerts()`);
const [{ n: told }] = await sql(`select count(*)::int as n from notify.notification`);

for (const c of Object.values(as)) await c.auth.signOut({ scope: 'local' });
await db.end();

// ---------------------------------------------------------------- what QA signs in with
console.log('\nFixture seed: done — every value is made up.\n');
console.log(`Password for every one of them: ${PASSWORD}\n`);
for (const p of PEOPLE) {
  const note =
    p.canSignIn === false ? '  (switched off: refused at the door)' : p.leftDaysAgo ? '  (left 10 days ago)' : '';
  console.log(`  ${p.key.padEnd(14)} ${email(p.key).padEnd(40)} ${p.role}${p.account ? ` · ${p.account}` : ''}${note}`);
}
console.log(
  `\n${ORGS.length} organisations, ${calls} api calls, ${told} notifications. Files are not seeded (Storage).`,
);
