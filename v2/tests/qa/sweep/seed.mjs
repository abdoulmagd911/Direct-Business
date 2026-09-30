#!/usr/bin/env node
// @ts-check
// The QA sweep's fixtures, on the LOCAL QA stack only (the settings come from `stack.mjs env`; a cloud address is
// refused below). People are made the way the E2E fixtures make them (tests/e2e/support/stack.ts: SQL as the stack's
// owner, and the auth user through the secret key's admin API); everything after that is done by the made-up admin
// through the app's own api.* doors, as a person would. Every name, email and value is made up (rule 7); each run gets
// a fresh tag so runs never share a person.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { FIXTURES_FILE, RUN_DIR } from './paths.mjs';

/** @param {string} name */
function setting(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run through tests/qa/sweep/run.sh (it reads the QA stack's settings)`);
  return v;
}
const URL = setting('NEXT_PUBLIC_SUPABASE_URL');
const PUBLISHABLE = setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const SECRET = setting('SUPABASE_SECRET_KEY');
const DB_URL = setting('V2_DB_URL');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(URL) || !/@(127\.0\.0\.1|localhost):\d+\//.test(DB_URL)) {
  throw new Error(`the sweep seeds only a local stack, not ${URL}`);
}

// QA_SEED_STAGE: all (default) · people (the people only — the gallery's empty screens) · data (the rest, for the
// people a `people` run wrote). QA_SEED_MORE=1 adds a few more made-up organisations, so a list is not two rows.
const STAGE = process.env.QA_SEED_STAGE || 'all';
const MORE = process.env.QA_SEED_MORE === '1';
let tag = Date.now().toString(36).slice(-5);
/** Made-up, the same for every fixture person; never a real password (rule 7). */
const PASSWORD = 'Test-QA-Sweep-2026-Riyadh';
const pool = new pg.Pool({ connectionString: DB_URL, max: 2 });
/** @param {string} text @param {unknown[]} [params] */
const sql = async (text, params = []) => (await pool.query(text, params)).rows;
const authAdmin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

/**
 * @typedef {{ key: string; id: string; email: string; name: string; role: string | null }} Person
 * @type {Record<string, { role: string | null; label: string; canSignIn?: boolean; listed?: boolean; account?: string }>}
 */
const PEOPLE = {
  admin: { role: 'admin', label: 'Test Admin' },
  // the owner's admin account and the QA test account (V444, V445): marked as such where core.person.account exists
  admin_account: { role: 'admin', label: 'Test Owner Account', account: 'admin_account' },
  qa_test: { role: 'admin', label: 'Test QA Account', account: 'test_account' },
  head: { role: 'head', label: 'Test Head' },
  manager: { role: 'manager', label: 'Test Manager' },
  member: { role: 'member', label: 'Test Member' },
  member2: { role: 'member', label: 'Test Member Two' },
  viewer: { role: 'viewer', label: 'Test Viewer' },
  noclients: { role: 'member', label: 'Test Member NoClients' },
  noclientscap: { role: 'manager', label: 'Test Manager NoClients' },
  nolevels: { role: null, label: 'Test NoRole' },
  switchoff: { role: 'member', label: 'Test Switched Off' },
  mustchange: { role: 'member', label: 'Test MustChange' },
  lockme: { role: 'member', label: 'Test Lockout' },
  door: { role: 'member', label: 'Test Door' },
  noemail: { role: 'member', label: 'Test NoEmail', listed: false },
};

/**
 * The scenario catalogue's own people (07-catalogue.spec.ts), one or two per scenario so no two tests share a person's
 * password, profile, role or log; made in the sweep's full seed only (not in the gallery's people/data stages, whose
 * screens stay as they were). `levels` are person overrides set through api.access_set_person_level.
 * @type {Record<string, { role: string | null; label: string; canSignIn?: boolean; listed?: boolean; levels?: Record<string, string> }>}
 */
const CATALOGUE_PEOPLE = {
  c_rate: { role: 'member', label: 'Test Cat RateLimit' },
  c_pwtarget: { role: 'member', label: 'Test Cat PwTarget' },
  c_reset: { role: 'member', label: 'Test Cat Reset' },
  c_dash: { role: 'member', label: 'Test Cat DashboardUser', listed: false },
  c_nofin: {
    role: 'member',
    label: 'Test Cat NoFinance',
    levels: { finance: 'none', kpis: 'none', reports: 'none', overview: 'none', appraisal: 'none' },
  },
  c_notasks: { role: 'member', label: 'Test Cat NoTasks', levels: { tasks: 'none' } },
  c_demote: { role: 'admin', label: 'Test Cat Demoted Admin' },
  c_target: { role: 'member', label: 'Test Cat Edit Target' },
  c_refocus: { role: 'admin', label: 'Test Cat Refocus Admin' },
  c_refocusoff: { role: 'member', label: 'Test Cat Refocus SwitchOff' },
  c_slow: { role: 'admin', label: 'Test Cat SlowLevels' },
  c_refuse: { role: 'member', label: 'Test Cat Refused Save' },
  c_untouched: { role: 'admin', label: 'Test Cat Untouched Save' },
  c_offline: { role: 'admin', label: 'Test Cat Offline Save' },
  c_walkmember: { role: 'member', label: 'Test Cat Walk Member' },
  c_walkadmin: { role: 'admin', label: 'Test Cat Walk Admin' },
  c_theme: { role: 'member', label: 'Test Cat Theme' },
  c_twomail: { role: 'member', label: 'Test Cat TwoEmails' },
  c_rmmail: { role: 'member', label: 'Test Cat RemoveEmail' },
  c_admin: { role: 'admin', label: 'Test Cat Admin' },
  c_colleague: { role: 'member', label: 'Test Cat Colleague' },
};
/** Made-up, typed "in the dashboard" for the auth user ACC-031 makes outside the app; never a real password. */
const DASHBOARD_PASSWORD = 'Test-QA-Dashboard-2026-Jeddah';

async function ensureBase() {
  await sql(`insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري')
             on conflict (code) do nothing`);
}

/** @type {boolean | undefined} */
let accountColumn;
/** Whether core.person.account (V444, V445; #115) is on this database — older checkouts have no such column. */
async function hasAccountColumn() {
  accountColumn ??=
    (
      await sql(`select 1 from information_schema.columns
                 where table_schema = 'core' and table_name = 'person' and column_name = 'account'`)
    ).length > 0;
  return accountColumn;
}

/** @param {string} key @returns {Promise<Person>} */
async function makePerson(key) {
  const def = PEOPLE[key] ?? CATALOGUE_PEOPLE[key];
  if (!def) throw new Error(`no fixture ${key}`);
  const id = randomUUID();
  const email = `test.qa.${key}.${tag}@example.test`;
  const name = `${def.label} ${tag}`;
  await sql(
    `insert into core.person (id, full_name_en, department_id, role_id, can_sign_in, kind)
     values ($1, $2, (select id from core.department where code = 'commercial'),
             (select id from core.role where key = $3), $4, 'staff')`,
    [id, name, def.role, def.canSignIn ?? true],
  );
  // One of each account (a unique index): a second seed on the same database leaves its person a team member.
  const account = PEOPLE[key]?.account;
  if (account && (await hasAccountColumn()))
    await sql(
      `update core.person set account = $2 where id = $1
         and not exists (select 1 from core.person o where o.account = $2 and o.deleted_at is null)`,
      [id, account],
    );
  if (def.listed === false) return { key, id, email: '', name, role: def.role };
  await sql(`insert into core.person_email (person_id, email, is_primary) values ($1, $2, true)`, [id, email]);
  const created = await authAdmin.createUser({ email, email_confirm: true, password: PASSWORD });
  if (!created.data.user) throw new Error(`could not create the auth user for ${key}: ${created.error?.message}`);
  await sql(`insert into core.person_auth (auth_user_id, person_id, email) values ($1, $2, $3)`, [
    created.data.user.id,
    id,
    email,
  ]);
  return { key, id, email, name, role: def.role };
}

/** A signed-in api.* client for a fixture person (the app's own door order: password, then sign_in_complete). */
async function apiAs(/** @type {Person} */ p) {
  const c = createClient(URL, PUBLISHABLE, {
    db: { schema: 'api' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const s = await c.auth.signInWithPassword({ email: p.email, password: PASSWORD });
  if (s.error) throw new Error(`${p.key} could not sign in: ${s.error.message}`);
  const done = await c.rpc('sign_in_complete', { p_provider: 'email', p_device_label: 'QA sweep seed' });
  if (done.error || done.data !== 'ok')
    throw new Error(`${p.key}: sign_in_complete ${done.error?.message ?? done.data}`);
  /** @param {string} fn @param {Record<string, unknown>} args */
  return async (fn, args) => {
    const r = await c.rpc(fn, args);
    if (r.error) throw new Error(`${p.key} ${fn}: ${r.error.code} ${r.error.message} ${r.error.details ?? ''}`);
    return r.data;
  };
}

async function main() {
  await ensureBase();
  /** @type {Record<string, Person>} */
  let users = {};
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  if (STAGE === 'data') {
    const before = JSON.parse(readFileSync(FIXTURES_FILE, 'utf8'));
    users = before.users;
    tag = before.tag;
  } else {
    for (const key of Object.keys(PEOPLE)) users[key] = await makePerson(key);
    if (STAGE === 'all') for (const key of Object.keys(CATALOGUE_PEOPLE)) users[key] = await makePerson(key);
  }
  if (STAGE === 'people') {
    mkdirSync(RUN_DIR, { recursive: true });
    writeFileSync(FIXTURES_FILE, JSON.stringify({ tag, password: PASSWORD, today, users, stage: 'people' }, null, 2));
    console.log(`seeded run ${tag}: ${Object.keys(users).length} people, no records yet (${FIXTURES_FILE})`);
    await pool.end();
    return;
  }
  const u = (/** @type {string} */ k) => {
    const p = users[k];
    if (!p) throw new Error(`no fixture ${k}`);
    return p;
  };
  const admin = await apiAs(u('admin'));
  const why = `QA sweep fixture ${tag}`;

  // The gallery only (QA_SEED_SWITCH_OFF=1): "Test Switched Off" is switched off through the admin's own door, so the
  // People list shows the state (gallery item 2). The sweep leaves it on — 01-sign-in switches it off itself.
  if (process.env.QA_SEED_SWITCH_OFF === '1')
    await admin('person_switch', { p_id: u('switchoff').id, p_on: false, p_reason: why });

  // shut out of Clients (V147): a member, and a manager who keeps the Clients capabilities of their role
  for (const k of ['noclients', 'noclientscap'])
    await admin('access_set_person_level', { p_person: u(k).id, p_page: 'clients', p_level: 'none', p_reason: why });

  // Test Org Alpha: the Client side only, owned by the member. Test Org Beta: both sides — the Client side owned by the
  // member, the Supplier & partner side by the admin.
  const alpha = await admin('partner_create', {
    p_partner: {
      trade_name_en: `Test Org Alpha ${tag}`,
      sides: [{ side: 'client', type: 'corporate', owner_id: u('member').id }],
    },
    p_reason: why,
  });
  const beta = await admin('partner_create', {
    p_partner: {
      trade_name_en: `Test Org Beta ${tag}`,
      sides: [
        { side: 'client', type: 'corporate', owner_id: u('member').id },
        { side: 'supplier_partner', type: 'supplier', owner_id: u('admin').id },
      ],
    },
    p_reason: why,
  });
  // The hover card and the card name "an owner" (partner.owners, first row). Make that first row the Client side's
  // owner if any Supplier & partner owner allows it, so a leak of the Client side's owner is visible, not left to luck.
  const firstOwner = async () =>
    (await sql(`select x::text as id from partner.owners($1) x limit 1`, [beta.id]))[0]?.id ?? null;
  let clientOwnerFirst = (await firstOwner()) === u('member').id;
  for (const k of ['head', 'manager', 'viewer', 'member2']) {
    if (clientOwnerFirst) break;
    await admin('partner_owner_set', { p_id: beta.id, p_side: 'supplier_partner', p_person: u(k).id, p_reason: why });
    clientOwnerFirst = (await firstOwner()) === u('member').id;
  }
  const supplierOwner = (
    await sql(`select x::text as id from partner.side_owners($1, 'supplier_partner') x`, [beta.id])
  )[0]?.id;

  for (const org of [alpha, beta])
    await admin('partner_status_set', { p_id: org.id, p_side: 'client', p_status: 'active', p_note: why });
  await admin('partner_status_set', { p_id: beta.id, p_side: 'supplier_partner', p_status: 'active', p_note: why });

  // Direct Payments client IDs are digits (their key keeps digits only): a made-up one, different each run
  const clientId = `9${String(parseInt(tag, 36) % 1e8).padStart(8, '0')}`;
  const cid = await admin('identifier_add', {
    p_partner: beta.id,
    p_kind: 'payments_client_id',
    p_value: clientId,
    p_reason: why,
  });
  // a made-up VAT number of the Saudi shape (15 digits, 3 … 3), different each run: identifiers are unique
  const vatValue = `3${String(parseInt(tag, 36) % 1e13).padStart(13, '0')}3`;
  const vat = await admin('identifier_add', {
    p_partner: beta.id,
    p_kind: 'vat',
    p_value: vatValue,
    p_reason: why,
  });

  /** @param {string} org @param {string} side @param {string} title */
  const contract = (org, side, title) =>
    admin('contract_save', { p_partner: org, p_id: null, p_values: { side, title, start_on: today }, p_reason: why });
  const alphaClient = await contract(alpha.id, 'client', `Test client contract Alpha ${tag}`);
  const betaClient = await contract(beta.id, 'client', `Test client contract Beta ${tag}`);
  const betaSupplier = await contract(beta.id, 'supplier_partner', `Test supplier contract Beta ${tag}`);

  /** @type {Record<string, unknown>} */
  const extra = {};
  try {
    extra.contact = await admin('contact_save', {
      p_partner: beta.id,
      p_id: null,
      p_values: { name_en: `Test Contact ${tag}`, email: `test.qa.contact.${tag}@example.test` },
    });
  } catch (e) {
    extra.contactError = String(e);
  }

  const alphaNote = await admin('note_add', {
    p_entity: 'partner',
    p_id: alpha.id,
    p_kind: 'comment',
    p_body: `Test note on Alpha ${tag} — client only`,
    p_mentions: [u('member').id],
  });
  const betaNote = await admin('note_add', {
    p_entity: 'partner',
    p_id: beta.id,
    p_kind: 'comment',
    p_body: `Test note on Beta ${tag}`,
    p_mentions: [u('member2').id],
  });

  const member = await apiAs(u('member'));
  const memberView = await member('view_save', {
    p_id: null,
    p_page: 'clients',
    p_name: `Test saved view ${tag}`,
    p_query: { q: 'Test' },
    p_shared: false,
  });

  if (MORE) {
    /** @type {[string, { side: string; type: string; owner: string }[], string][]} */
    const moreOrgs = [
      ['Gamma', [{ side: 'client', type: 'corporate', owner: 'manager' }], 'prospect'],
      ['Delta', [{ side: 'client', type: 'corporate', owner: 'head' }], 'active'],
      ['Epsilon', [{ side: 'supplier_partner', type: 'supplier', owner: 'admin' }], 'active'],
      [
        'Zeta',
        [
          { side: 'client', type: 'corporate', owner: 'member2' },
          { side: 'supplier_partner', type: 'supplier', owner: 'manager' },
        ],
        'active',
      ],
      ['Eta', [{ side: 'client', type: 'corporate', owner: 'member' }], 'at_risk'],
    ];
    /** @type {string[]} */
    const moreIds = [];
    extra.more = moreIds;
    for (const [name, sides, status] of moreOrgs) {
      try {
        const org = await admin('partner_create', {
          p_partner: {
            trade_name_en: `Test Org ${name} ${tag}`,
            sides: sides.map((x) => ({ side: x.side, type: x.type, owner_id: u(x.owner).id })),
          },
          p_reason: why,
        });
        for (const x of sides)
          await admin('partner_status_set', { p_id: org.id, p_side: x.side, p_status: status, p_note: why }).catch(
            () => undefined,
          );
        moreIds.push(org.id);
      } catch (e) {
        extra.moreError = String(e);
      }
    }
  }

  /** @type {Record<string, unknown> | undefined} */
  let catalogue;
  if (STAGE === 'all') {
    for (const [key, def] of Object.entries(CATALOGUE_PEOPLE))
      for (const [page, level] of Object.entries(def.levels ?? {}))
        await admin('access_set_person_level', { p_person: u(key).id, p_page: page, p_level: level, p_reason: why });
    // ACC-031: an auth user made outside the app (as the owner did in the Supabase dashboard — V451), for an email no
    // person is allowed yet; the scenario's admin then allows it on Test Cat DashboardUser.
    const dashEmail = `test.qa.dashboard.${tag}@example.test`;
    const dash = await authAdmin.createUser({ email: dashEmail, email_confirm: true, password: DASHBOARD_PASSWORD });
    if (!dash.data.user) throw new Error(`could not make the dashboard auth user: ${dash.error?.message}`);
    catalogue = { dash: { email: dashEmail, authUserId: dash.data.user.id, password: DASHBOARD_PASSWORD } };
  }

  const settingReason = `QA sweep seed setting ${tag}`;
  await admin('setting_set', { p_key: 'work.no_update_days', p_department: null, p_value: 8, p_reason: settingReason });

  const fixtures = {
    tag,
    password: PASSWORD,
    today,
    users,
    orgs: {
      alpha: { id: alpha.id, number: alpha.number, name: `Test Org Alpha ${tag}` },
      beta: { id: beta.id, number: beta.number, name: `Test Org Beta ${tag}`, clientOwnerFirst, supplierOwner },
    },
    identifiers: { betaClientId: { id: cid.id, value: clientId }, betaVat: { id: vat.id, value: vatValue } },
    contracts: { alphaClient: alphaClient.id, betaClient: betaClient.id, betaSupplier: betaSupplier.id },
    notes: { alpha: alphaNote.id, beta: betaNote.id },
    views: { member: memberView.id ?? memberView },
    settingReason,
    extra,
    catalogue,
  };
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(FIXTURES_FILE, JSON.stringify(fixtures, null, 2));
  console.log(`seeded run ${tag}: ${Object.keys(users).length} people, 2 organisations (${FIXTURES_FILE})`);
  if (!clientOwnerFirst) console.log('note: no owner order put the Client side owner first on Beta');
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
