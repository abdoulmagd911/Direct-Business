#!/usr/bin/env node
// @ts-check
// The proof of scripts/fixtures/enrich-test-data.mjs on THIS machine only: on the local Supabase stack it makes four
// TEST people (an admin, a head, a member and a viewer, marked TEST, with made-up @example.test addresses), opens this
// year's achievement plan, and then runs the enrichment as a person would against the live workspace:
//   plan → write → write again (must add nothing) → clean → plan
// printing the Finance figures at each step, and fails unless they return exactly to where they started.
//
//   node scripts/fixtures/enrich-prove-local.mjs      (from v2/, after: supabase start, supabase db reset --local)
//
// It refuses any address that is not on this machine (scripts/fixtures/guard.mjs). Every value is made up (rule 7).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { FIXTURE_DOMAIN, notLocal } from './guard.mjs';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PASSWORD = 'Fixture-Pass-2026';
function fail(/** @type {string} */ why) {
  console.error(`enrich proof: ${why}`);
  process.exit(1);
}
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

const db = new pg.Client({ connectionString: env.V2_DB_URL });
await db.connect();
const sql = async (/** @type {string} */ text, /** @type {unknown[]} */ params = []) =>
  (await db.query(text, params)).rows;
const email = (/** @type {string} */ key) => `enrich.test.${key}@${FIXTURE_DOMAIN}`;

if (!(await sql(`select 1 from core.person_email where email = $1`, [email('admin')])).length) {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? '', env.SUPABASE_SECRET_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
  await sql(`insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري')
             on conflict (code) do nothing`);
  const [dep] = await sql(`select id from core.department where code = 'commercial'`);
  const [team] = await sql(
    `insert into core.team (department_id, code, name_en, name_ar) values ($1, 'enrich_test_desk', 'TEST desk', 'مكتب تجريبي')
     returning id`,
    [dep.id],
  );
  for (const [key, en, ar] of /** @type {[string, string, string][]} */ ([
    ['admin', 'TEST Admin', 'مسؤول تجريبي'],
    ['head', 'TEST Head', 'رئيس تجريبي'],
    ['member', 'TEST Member', 'عضو تجريبي'],
    ['viewer', 'TEST Viewer', 'مشاهد تجريبي'],
  ])) {
    const [row] = await sql(
      `insert into core.person (full_name_en, full_name_ar, department_id, team_id, role_id, can_sign_in, kind, is_test)
       values ($1, $2, $3, $4, (select id from core.role where key = $5), true, 'staff', true) returning id`,
      [en, ar, dep.id, team.id, key],
    );
    await sql(`insert into core.person_email (person_id, email, is_primary) values ($1, $2, true)`, [
      row.id,
      email(key),
    ]);
    const made = await admin.createUser({ email: email(key), password: PASSWORD, email_confirm: true });
    if (!made.data.user) fail(`could not make the sign-in for ${email(key)}: ${made.error?.message}`);
    await sql(
      `insert into core.person_auth (auth_user_id, person_id, email, password_set_at) values ($1, $2, $3, now())`,
      [made.data.user?.id, row.id, email(key)],
    );
  }
  await sql(
    `update core.team set lead_person_id = (select person_id from core.person_email where email = $2) where id = $1`,
    [team.id, email('head')],
  );
  await sql(
    `do $$ declare d uuid := (select id from core.department where code = 'commercial');
         y int := extract(year from now() at time zone 'Asia/Riyadh')::int; p uuid;
     begin
       if perf.plan_of(d, y) is null then
         insert into perf.plan (department_id, year, name) values (d, y, 'TEST plan ' || y) returning id into p;
         perform perf.categories_seed(p);
       end if;
     end $$`,
  );
}
// money that was there before: the proof starts from figures that are not zero, as the live workspace does
if (!(await sql(`select 1 from finance.invoice where ref = 'MADEUP-BASE-1'`)).length) {
  const base = createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? '', env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'api' },
  });
  await base.auth.signInWithPassword({ email: email('admin'), password: PASSWORD });
  await base.rpc('sign_in_complete', { p_provider: 'email', p_device_label: 'Enrichment proof' });
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric' }).format(new Date());
  const made = await base.rpc('finance_row_add', {
    p_table: 'invoice',
    p_fields: {
      ref: 'MADEUP-BASE-1',
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: `${year}-01-10`,
      paid_on: `${year}-01-10`,
      total_sar: 1234,
      customer_name: 'Made-up Earlier Org',
    },
    p_reason: 'made up: money that was there before',
  });
  if (made.error) fail(`the base invoice was refused: ${made.error.message}`);
  const cost = await base.rpc('finance_row_add', {
    p_table: 'expense_line',
    p_fields: { invoice_id: made.data.id, expense_type: 'Hotel', status: 'Approved', amount_sar: 234 },
    p_reason: 'made up: its cost',
  });
  if (cost.error) fail(`the base cost was refused: ${cost.error.message}`);
  await base.auth.signOut({ scope: 'local' });
}

const run = (/** @type {string[]} */ args) => {
  console.log(`\n$ enrich-test-data.mjs ${args.join(' ') || '(plan)'}`);
  const r = spawnSync('node', ['scripts/fixtures/enrich-test-data.mjs', ...args], {
    cwd: V2,
    encoding: 'utf8',
    env: {
      ...process.env,
      ENRICH_API_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      ENRICH_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      ENRICH_EMAIL: email('admin'),
      ENRICH_PASSWORD: PASSWORD,
    },
  });
  process.stdout.write(r.stdout);
  if (r.status !== 0) fail(`the script stopped: ${r.stderr.trim()}`);
  return r.stdout;
};
/** The three year-to-date figures a run printed first ("revenue  1,000 → …"). */
const figuresIn = (/** @type {string} */ text) =>
  Object.fromEntries(
    [...text.matchAll(/^\s+(revenue|cost|profit)\s+([\d,.-]+) →/gm)].map((m) => [
      m[1],
      Number(String(m[2]).replace(/,/g, '')),
    ]),
  );

const start = figuresIn(run([]));
if (!start.revenue) fail('the proof did not start from figures above zero');
run(['--write']);
// what the approved list promises, read straight from the database after the write
const open = await sql(
  `select p.full_name_en as who, count(*)::int as n
   from work.task t join core.person p on p.id = t.owner_id join work.task_status s on s.id = t.status_id
   where t.title like 'TEST · %' and t.deleted_at is null and s.meaning in ('not_started', 'in_progress')
   group by 1 order by 1`,
);
console.log(`\nenrich proof: open TEST tasks per person: ${open.map((r) => `${r.who} ${r.n}`).join(' · ')}`);
if (open.length !== 3 || open.some((r) => r.n !== 9)) fail('not every TEST person has nine open tasks');
const [blocked] = await sql(
  `select count(*)::int as n from work.task where title like 'TEST · %' and blocked_reason is not null and deleted_at is null`,
);
const [linked] = await sql(
  `select count(*)::int as n from finance.money_row where ref like 'TESTENR-%' and partner_id is not null`,
);
const [fromTask] = await sql(
  `select count(*)::int as n from perf.achievement where title like 'TEST · %' and source_task_id is not null and deleted_at is null`,
);
console.log(
  `enrich proof: blocked tasks ${blocked.n} (3 wanted) · test invoices linked to their TEST client ${linked.n} (6 wanted) · achievements logged from a task ${fromTask.n} (1 wanted)`,
);
if (blocked.n !== 3 || linked.n !== 6 || fromTask.n !== 1) fail('the written data is not what the list says');
const second = run(['--write']);
if (
  !/to add: 0 organisations \(of 6\), 0 tasks \(of 33\), 0 project, 0 achievements \(of 6\), 0 pipeline cards \(of 3\), 0 invoices \(of 6\)/.test(
    second,
  )
)
  fail('a second --write found something to add');
run(['--clean']);
const end = figuresIn(run([]));
console.log(
  `\nenrich proof: Finance year to date before ${JSON.stringify(start)} · after write and clean ${JSON.stringify(end)}`,
);
if (JSON.stringify(start) !== JSON.stringify(end)) fail('the figures did not return to where they started');
await db.end();
console.log('enrich proof: the figures returned exactly to where they started; a second write added nothing.');
