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
  { key: 'admin', en: 'Omar Al-Harbi', ar: 'عمر الحربي', role: 'admin', title: 'Commercial director' },
  { key: 'head', en: 'Layla Haddad', ar: 'ليلى حداد', role: 'head', title: 'Head of sales', manager: 'admin' },
  {
    key: 'manager',
    en: 'Yousef Al-Qahtani',
    ar: 'يوسف القحطاني',
    role: 'manager',
    title: 'Sales manager',
    manager: 'head',
    team: true,
  },
  {
    key: 'member1',
    en: 'Sara Al-Otaibi',
    ar: 'سارة العتيبي',
    role: 'member',
    title: 'Account manager',
    manager: 'manager',
    team: true,
  },
  {
    key: 'member2',
    en: 'Nasser Al-Zahrani',
    ar: 'ناصر الزهراني',
    role: 'member',
    title: 'Account manager',
    manager: 'manager',
    team: true,
  },
  { key: 'viewer', en: 'Huda Barakat', ar: 'هدى بركات', role: 'viewer', title: 'Analyst' },
  {
    key: 'admin_account',
    en: 'Admin Account',
    ar: 'حساب المسؤول',
    role: 'admin',
    account: 'admin_account',
  },
  {
    key: 'test_account',
    en: 'Test Account',
    ar: 'حساب الاختبار',
    role: 'member',
    account: 'test_account',
  },
  {
    key: 'switched_off',
    en: 'Faisal Al-Dosari',
    ar: 'فيصل الدوسري',
    role: 'member',
    manager: 'manager',
    canSignIn: false,
  },
  {
    key: 'departed',
    en: 'Reem Al-Shehri',
    ar: 'ريم الشهري',
    role: 'member',
    manager: 'manager',
    leftDaysAgo: 10,
  },
];

await sql(`insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري')
           on conflict (code) do nothing`);
const [dep] = await sql(`select id from core.department where code = 'commercial'`);
const [{ id: teamId }] = await sql(
  `insert into core.team (department_id, code, name_en, name_ar) values ($1, 'fixture_desk', 'Sales desk', 'مكتب المبيعات')
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

// A small travel company's book: 21 organisations on both sides, two contacts each, every name and address different.
// Names are invented (rule 7); addresses end in the made-up domain; phones keep the made-up shape (V101).
/** @typedef {{ en: string, ar: string, domain: string, by: string, sides: { side: string, type: string }[] }} Org */
const client = (/** @type {string} */ type) => [{ side: 'client', type }];
const supplier = (/** @type {string} */ type) => [{ side: 'supplier_partner', type }];
/** @type {Org[]} */
const ORGS = [
  {
    en: 'Najd Logistics Group',
    ar: 'مجموعة نجد اللوجستية',
    domain: 'najd-logistics',
    by: 'member1',
    sides: client('corporate'),
  },
  {
    en: 'Red Sand Engineering',
    ar: 'الرمال الحمراء للهندسة',
    domain: 'red-sand',
    by: 'member2',
    sides: client('corporate'),
  },
  {
    en: 'Olive Tree Pharma',
    ar: 'شجرة الزيتون للأدوية',
    domain: 'olive-tree',
    by: 'manager',
    sides: client('corporate'),
  },
  {
    en: 'Blue Gulf Contracting',
    ar: 'الخليج الأزرق للمقاولات',
    domain: 'blue-gulf',
    by: 'member1',
    sides: client('corporate'),
  },
  {
    en: 'Desert Rose Hotels Group',
    ar: 'مجموعة وردة الصحراء للفنادق',
    domain: 'desert-rose',
    by: 'member2',
    sides: client('corporate'),
  },
  { en: 'Sahab Technology', ar: 'سحاب للتقنية', domain: 'sahab-tech', by: 'member1', sides: client('corporate') },
  { en: 'Al Marsa Foods', ar: 'المرسى للأغذية', domain: 'al-marsa', by: 'member2', sides: client('corporate') },
  { en: 'Tuwaiq Consulting', ar: 'طويق للاستشارات', domain: 'tuwaiq', by: 'manager', sides: client('corporate') },
  { en: 'Safar Plus Agency', ar: 'سفر بلس للوكالات', domain: 'safar-plus', by: 'member1', sides: client('agencies') },
  { en: 'Horizon Holidays', ar: 'آفاق للعطلات', domain: 'horizon-holidays', by: 'member2', sides: client('agencies') },
  { en: 'Rihla Tours', ar: 'رحلة للسياحة', domain: 'rihla-tours', by: 'member1', sides: client('agencies') },
  {
    en: 'Golden Route Travel',
    ar: 'الطريق الذهبي للسفر',
    domain: 'golden-route',
    by: 'manager',
    sides: client('agencies'),
  },
  {
    en: 'Regional Education Office',
    ar: 'مكتب التعليم الإقليمي',
    domain: 'education-office',
    by: 'manager',
    sides: client('government'),
  },
  {
    en: 'Municipal Events Authority',
    ar: 'هيئة الفعاليات البلدية',
    domain: 'events-authority',
    by: 'head',
    sides: client('government'),
  },
  {
    en: 'Public Health Training Centre',
    ar: 'مركز التدريب الصحي العام',
    domain: 'health-training',
    by: 'manager',
    sides: client('government'),
  },
  {
    en: 'Skyline Air Services',
    ar: 'سكاي لاين للخدمات الجوية',
    domain: 'skyline-air',
    by: 'head',
    sides: supplier('supplier'),
  },
  { en: 'Harbour Stay Hotels', ar: 'فنادق المرفأ', domain: 'harbour-stay', by: 'manager', sides: supplier('supplier') },
  {
    en: 'Comfort Ride Transport',
    ar: 'كمفورت رايد للنقل',
    domain: 'comfort-ride',
    by: 'head',
    sides: supplier('supplier'),
  },
  {
    en: 'Fare Bridge Systems',
    ar: 'جسر الأسعار للأنظمة',
    domain: 'fare-bridge',
    by: 'head',
    sides: supplier('integration'),
  },
  {
    en: 'Easy Settle Payments',
    ar: 'تسوية سهلة للمدفوعات',
    domain: 'easy-settle',
    by: 'head',
    sides: supplier('payment_solution'),
  },
  {
    en: 'Gulf Connect Travel',
    ar: 'الخليج كونكت للسفر',
    domain: 'gulf-connect',
    by: 'head',
    sides: [...client('corporate'), ...supplier('integration')],
  },
];
// 12 first names and 12 last names, paired so no two contacts share both (the last name moves on each block of 12)
const FIRST = [
  ['Ahmad', 'أحمد'],
  ['Mona', 'منى'],
  ['Tariq', 'طارق'],
  ['Dina', 'دينا'],
  ['Hassan', 'حسن'],
  ['Noura', 'نورة'],
  ['Majed', 'ماجد'],
  ['Rana', 'رنا'],
  ['Bandar', 'بندر'],
  ['Salma', 'سلمى'],
  ['Walid', 'وليد'],
  ['Amal', 'أمل'],
];
const LAST = [
  ['Al-Ghamdi', 'الغامدي'],
  ['Khoury', 'خوري'],
  ['Al-Mutairi', 'المطيري'],
  ['Nasser', 'ناصر'],
  ['Al-Subaie', 'السبيعي'],
  ['Hamdan', 'حمدان'],
  ['Al-Anazi', 'العنزي'],
  ['Saleh', 'صالح'],
  ['Al-Rashid', 'الراشد'],
  ['Mansour', 'منصور'],
  ['Al-Juhani', 'الجهني'],
  ['Farouk', 'فاروق'],
];
const JOBS = [
  ['Travel coordinator', 'منسق سفر'],
  ['Procurement manager', 'مدير المشتريات'],
  ['Office manager', 'مدير المكتب'],
  ['Operations lead', 'مسؤول العمليات'],
  ['Finance officer', 'مسؤول مالي'],
  ['Events manager', 'مدير الفعاليات'],
];
/** The k-th made-up contact: names in both languages, a job, an address on the made-up domain, a made-up phone. */
const person = (/** @type {number} */ k, /** @type {string} */ domain) => {
  const f = FIRST[k % 12] ?? FIRST[0] ?? ['', ''];
  const l = LAST[(k + Math.floor(k / 12)) % 12] ?? LAST[0] ?? ['', ''];
  const j = JOBS[k % JOBS.length] ?? JOBS[0] ?? ['', ''];
  return {
    name_en: `${f[0]} ${l[0]}`,
    name_ar: `${f[1]} ${l[1]}`,
    job_title: j[0],
    email: `${f[0]}.${l[0]}`.toLowerCase().replace(/[^a-z.]/g, '') + `@${domain}.${FIXTURE_DOMAIN}`,
    phone: `+966 50 000 ${String(1000 + k).padStart(4, '0')}`,
  };
};
// When each agreement ends, in days from today: the first three fall on reminder days (7, 30 and 60) so the alerts job
// below tells someone; one has already ended; the rest are spread over the next year and a half.
const ENDS = [7, 30, 60, 90, 200, 400, -20, 15, 45, 120, 180, 250, 365, 500, 75, 10, 150, 300, 600, 25, 45];
const REMARKS = [
  'Asked for a quote for the autumn group trip.',
  'Wants the renewal terms in Arabic and English.',
  'Prefers a call before noon; sends bookings by e-mail.',
  'Interested in the umrah season packages.',
  'Needs two more traveller profiles added.',
  'Waiting for their finance team to approve the budget.',
  'Happy with the last trip; asked about group rates.',
];

/** @type {string[]} */
const partners = [];
let nContact = 0;
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
  for (const primary of [true, false])
    await api('head', 'contact_save', {
      p_partner: p,
      p_id: null,
      p_values: { ...person(nContact++, o.domain), is_primary: primary },
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
        title: `${o.en} ${s.side === 'client' ? 'services' : 'supply'} agreement`,
        start_on: day(-300 + (n % 5) * 20),
        end_on: day(ENDS[n] ?? 400),
      },
    });
  }
  const doer = o.by === 'head' ? 'head' : o.by;
  for (const k of [0, 1])
    await api(doer, 'activity_log', {
      p_partner: p,
      p_type: (n + k) % 2 ? 'meeting' : 'call',
      p_outcome: (n + k) % 2 ? 'meeting_held' : 'answered',
      p_happened_on: day(-2 - ((n * 3 + k * 17) % 45)),
      p_body: REMARKS[(n + k) % REMARKS.length] ?? null,
      p_next_step: k ? null : 'Send the proposal',
      p_next_step_on: k ? null : day(((n * 5) % 17) - 3),
      p_mentions: null,
    });
  await api('head', 'note_add', {
    p_entity: 'partner',
    p_id: p,
    p_kind: 'comment',
    p_body: `${REMARKS[(n + 3) % REMARKS.length] ?? ''} (for @${PEOPLE[4]?.en})`,
    p_happened_on: null,
    p_mentions: [id.member2],
  });
  await api('head', 'reference_save', {
    p_partner: p,
    p_id: null,
    p_values: {
      system: 'portal',
      value: `${o.domain}.user`,
      url: `https://portal.${o.domain}.${FIXTURE_DOMAIN}/login`,
    },
    p_version: null,
    p_reason: 'Fixture: portal login',
  });
  if (n < 8) await api('member2', 'follow', { p_entity: 'partner', p_id: p, p_on: true });
}

// a discount code on the first client, a credit limit, a campaign, saved views
await api('head', 'identifier_add', {
  p_partner: partners[0],
  p_kind: 'discount_code',
  p_value: 'WELCOME10',
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
  p_code: 'SPRING26',
  p_name: 'Spring offer',
  p_valid_from: day(0),
  p_valid_to: day(60),
  p_owner: id.manager,
  p_reason: 'Fixture: made-up campaign',
});
await api('member1', 'view_save', {
  p_id: null,
  p_page: 'clients',
  p_name: 'My clients',
  p_query: {},
  p_shared: false,
});
await api('head', 'view_save', {
  p_id: null,
  p_page: 'clients',
  p_name: 'Team view',
  p_query: {},
  p_shared: true,
});

// the team's work: tasks (some late, some today, some next month), this year's achievements and a few private ideas
const TASKS = [
  ['member1', 'Send the renewal proposal', 0, -4],
  ['member1', 'Confirm the group hotel block', 3, 2],
  ['member1', 'Collect traveller passports for the autumn trip', 6, 9],
  ['member1', 'Update the corporate rate sheet', null, 14],
  ['member2', 'Call back about the umrah packages', 4, -1],
  ['member2', 'Prepare the quote for the education office', 12, 5],
  ['member2', 'Check the visa timeline with the supplier', 15, 0],
  ['member2', 'Review the airline fare agreement', null, 21],
  ['manager', 'Approve the spring campaign offer', null, 3],
  ['manager', 'Meet the events authority about the festival', 13, 7],
  ['manager', "Review the quarter's open contracts", null, 28],
  ['manager', 'Follow up on the unsigned supplier agreement', 16, -7],
];
for (const [who, title, org, due] of TASKS)
  await api(String(who), 'task_create', {
    p_values: {
      title,
      due_on: day(Number(due)),
      ...(typeof org === 'number' ? { partner_id: partners[org] } : {}),
    },
  });
const year = new Date().getFullYear();
await api('admin', 'plan_open', { p_department: dep.id, p_year: year });
const thisYear = (/** @type {number} */ offset) => {
  const jan1 = `${year}-01-01`;
  const d = day(offset);
  return d < jan1 ? jan1 : d;
};
const DEALS = [
  ['member1', 'Signed the yearly travel agreement with the logistics group', -3],
  ['member1', 'Booked the pharma conference delegation', -12],
  ['member1', "Renewed the engineering firm's corporate rates", -30],
  ['member2', "Won the hotel group's staff travel account", -8],
  ['member2', 'Closed the umrah season group booking', -20],
  ['member2', 'Added three agency partners to the portal', -45],
  ['manager', 'Agreed the festival travel plan with the events authority', -5],
  ['manager', 'Signed the transport supplier agreement', -26],
];
for (const [who, title, off] of DEALS)
  await api(String(who), 'achievement_log', {
    p_values: { category: 'contract', title, happened_on: thisYear(Number(off)) },
  });
for (const [who, title] of [
  ['member1', 'Ask the hotel group about a loyalty rate'],
  ['member1', 'Idea: a spring city-break bundle for agencies'],
  ['member2', 'Idea: send renewal reminders in Arabic first'],
  ['manager', 'Idea: a shared sheet of supplier cut-off dates'],
])
  await api(String(who), 'note_capture', { p_kind: 'idea', p_values: { title } });

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
  `\n${ORGS.length} organisations, ${TASKS.length} tasks, ${DEALS.length} achievements, ${calls} api calls, ${told} notifications. Files are not seeded (Storage).`,
);
