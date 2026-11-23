#!/usr/bin/env node
// @ts-check
// Test-data enrichment (the approved list of 23 Nov 2026): made-up records on every page, for the TEST users, so the
// pages have something to show while the workspace is tested. Run by the holder of the Admin account — the one account
// on the test-user switch list (V656) — never as a TEST user, who has no sign-in of their own:
//
//   ENRICH_API_URL=…  ENRICH_PUBLISHABLE_KEY=…  ENRICH_EMAIL=…  ENRICH_PASSWORD=…  node scripts/fixtures/enrich-test-data.mjs
//       → says what it WOULD add, and the exact change to each Finance figure. Writes nothing.
//   … node scripts/fixtures/enrich-test-data.mjs --write    → adds what is missing, then checks the Finance figures.
//   … node scripts/fixtures/enrich-test-data.mjs --clean    → removes exactly what a --write made.
//
// ENRICH_EMAIL and ENRICH_PASSWORD are the Admin account's. The rules it keeps:
//   · it signs in as the Admin account, reads who the TEST users are, then switches this one sign-in to the TEST Admin
//     with the app's own switch (api.test_switch_start), so every read and write is the TEST Admin's and every log row
//     names the owner behind it; it stops unless the app then answers as the TEST Admin;
//   · whatever happens — done, refused, or a fault — it switches back (api.test_switch_end), reads who it is again and
//     says so, then signs out; if the switch-back cannot be proven it says so loudly and ends with a failure;
//   · it writes only through the app's own doors (api.*), so every rule, log entry and notification is the real one —
//     no migration, no direct database write, no file import, no setting, role or access change;
//   · it creates no people: the TEST Admin, Head, Member and Viewer must exist (it stops and says which is missing);
//   · every record it makes is made up and its title or name starts with "TEST · "; it never touches a record it did
//     not make;
//   · a second --write adds only what is missing; --clean removes what it finds under its own names.
// Not in it: files. An upload goes to file storage, which the local stack this was proven on does not run — so the two
// test files of the approved list are added by hand in the browser, on the first TEST client.
// The password is read from the environment and never printed. Every value is made up (rule 7).
import { createClient } from '@supabase/supabase-js';

const MARK = 'TEST · ';
const REASON = 'TEST data: enrichment of 23 Nov';
const mode = process.argv.includes('--clean') ? 'clean' : process.argv.includes('--write') ? 'write' : 'plan';

/** A stop with a reason: caught by the runner at the end of this file, which switches back before it exits. */
class Stop extends Error {}
/** @returns {never} */
function fail(/** @type {string} */ why) {
  throw new Stop(why);
}
const need = (/** @type {string} */ name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`enrich: ${name} is not set`);
    process.exit(1);
  }
  return v;
};
const URL_API = need('ENRICH_API_URL');
const KEY = need('ENRICH_PUBLISHABLE_KEY');

const client = createClient(URL_API, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'api' },
});
const EMAIL = need('ENRICH_EMAIL');
const PASSWORD = need('ENRICH_PASSWORD');
/** The switch this run holds: who is behind it, and whether it is on. */
const state = { switched: false, holder: /** @type {any} */ (null) };

async function main() {
  const signed = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signed.error) fail(`the sign-in was refused: ${signed.error.message}`);
  const done = await client.rpc('sign_in_complete', { p_provider: 'email', p_device_label: 'Test-data enrichment' });
  if (done.data !== 'ok') fail(`the sign-in did not complete: ${done.data ?? done.error?.message}`);

  let writes = 0;
  /** Calls api.<fn>; a refusal stops the run, naming the door. */
  async function api(/** @type {string} */ fn, /** @type {Record<string, unknown>} */ args = {}) {
    const r = await client.rpc(fn, args);
    if (r.error) fail(`api.${fn}: ${r.error.message} ${r.error.details ?? ''}`);
    return /** @type {any} */ (r.data);
  }
  /** A door that writes: counted, and only ever called in --write or --clean. */
  async function write(/** @type {string} */ fn, /** @type {Record<string, unknown>} */ args) {
    if (mode === 'plan') fail(`a write (api.${fn}) was reached without --write: this is a fault in the script`);
    writes++;
    return api(fn, args);
  }

  // ---------------------------------------------------------------- who
  // as the Admin account: who it is, and who the TEST users are (the people list needs the admin role, which a switched
  // sign-in does not have — V656 (2))
  const real = await api('me');
  const people = /** @type {any[]} */ (await api('people'));
  const holder = people.find((p) => p.id === real?.person?.id);
  if (!holder?.role?.is_admin) fail('the signed-in person is not an admin: sign in as the Admin account');
  if (holder.is_test)
    fail('the signed-in person is a TEST user: sign in as the Admin account, which switches to TEST Admin');
  const testOf = (/** @type {string} */ role) =>
    people
      .filter((p) => p.is_test && p.active && p.can_sign_in && p.role?.key === role)
      .sort((a, b) => String(a.full_name_en).localeCompare(String(b.full_name_en)))[0];
  const WHO = { admin: testOf('admin'), head: testOf('head'), member: testOf('member'), viewer: testOf('viewer') };
  for (const [k, p] of Object.entries(WHO))
    if (!p) fail(`no TEST ${k} was found (a person marked TEST with that role)`);
  // the switch: from here every read and write is the TEST Admin's, logged with the Admin account named behind it
  state.holder = holder;
  const sw = await client.rpc('test_switch_start', { p_person: WHO.admin.id });
  if (sw.error)
    fail(
      `the switch to ${WHO.admin.full_name_en} was refused: ${sw.error.message}${/not_allowed/.test(sw.error.message) ? ' (this account is not on the test-user switch list)' : ''}`,
    );
  state.switched = true;
  const me = await api('me');
  if (me?.person?.id !== WHO.admin.id) fail(`after the switch the app does not answer as ${WHO.admin.full_name_en}`);
  const self = WHO.admin;
  console.log(`enrich: signed in as ${holder.full_name_en}; switched to ${self.full_name_en}`);

  const riyadh = (/** @type {number} */ offset = 0) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(Date.now() + offset * 86_400_000));
  const today = riyadh();
  /** The 15th of the month `back` months before this one, as YYYY-MM-DD. */
  const midMonth = (/** @type {number} */ back) => {
    const [y, m] = today.split('-').map(Number);
    const d = new Date(Date.UTC(Number(y), Number(m) - 1 - back, 15));
    return d.toISOString().slice(0, 10);
  };
  const yearStart = `${today.slice(0, 4)}-01-01`;

  // ---------------------------------------------------------------- what is already there (under this script's names)
  const rowsOf = (/** @type {any} */ a) => (Array.isArray(a) ? a : (a?.rows ?? a?.items ?? []));
  const mine = (/** @type {any[]} */ rows, /** @type {string} */ field) =>
    rows.filter((r) => typeof r?.[field] === 'string' && r[field].startsWith(MARK));
  async function allOf(
    /** @type {string} */ fn,
    /** @type {Record<string, unknown>} */ args,
    /** @type {string} */ field,
  ) {
    /** @type {any[]} */
    const out = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const page = rowsOf(await api(fn, { ...args, p_limit: 100, p_offset: offset }));
      out.push(...page);
      if (page.length < 100) break;
    }
    return mine(out, field);
  }
  const lists = {
    priority: rowsOf(await api('list', { p_list: 'priority' })).map((/** @type {any} */ x) => x.key),
    sideType: rowsOf(await api('list', { p_list: 'side_type' })),
    status: rowsOf(await api('list', { p_list: 'task_status' })).filter((/** @type {any} */ x) => x.active !== false),
    source: rowsOf(await api('list', { p_list: 'pipeline_source' })).filter(
      (/** @type {any} */ x) => x.active !== false,
    ),
  };
  /** The workspace's own status for a locked meaning (the list's names may differ; its meanings do not). */
  const statusOf = (/** @type {string} */ meaning) =>
    lists.status.find((/** @type {any} */ x) => x.meaning === meaning)?.key ?? fail(`no task status means ${meaning}`);
  const prio = (/** @type {number} */ n) =>
    lists.priority.length ? lists.priority[n % lists.priority.length] : undefined;

  async function existing() {
    const partners = [
      ...(await allOf('partners', { p_filters: { side: 'client', q: 'TEST' } }, 'trade_name_en')),
      ...(await allOf('partners', { p_filters: { side: 'supplier_partner', q: 'TEST' } }, 'trade_name_en')),
      ...(await allOf(
        'partners',
        { p_filters: { side: 'client', q: 'TEST', include_archived: true } },
        'trade_name_en',
      )),
    ];
    const seen = new Set();
    return {
      partners: partners.filter((p) => !seen.has(p.id) && seen.add(p.id)),
      tasks: await allOf('tasks', { p_filter: { q: 'TEST', scope: 'all', status: 'all' } }, 'title'),
      projects: await allOf('projects', { p_filter: { q: 'TEST' } }, 'name'),
      achievements: await allOf('achievements', { p_filter: { q: 'TEST' } }, 'title'),
      opportunities: mine(cardsOf(await api('pipeline_board', { p_entity: 'opportunity' })), 'title'),
      tenders: mine(cardsOf(await api('pipeline_board', { p_entity: 'tender' })), 'title'),
      // the search names an invoice by `invoice_id`; a row without one is not a typed invoice of this script
      invoices: rowsOf(await api('finance_search', { p_text: 'TESTENR', p_limit: 50 }))
        .filter(
          (/** @type {any} */ r) => typeof r.ref === 'string' && r.ref.startsWith('TESTENR-') && r.source === 'manual',
        )
        .map((/** @type {any} */ r) => ({ ...r, id: r.invoice_id })),
    };
  }
  /** Every card of a pipeline board, whatever column it sits in. */
  function cardsOf(/** @type {any} */ board) {
    /** @type {any[]} */
    const out = [];
    const walk = (/** @type {any} */ v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        if (typeof v.title === 'string' && typeof v.id === 'string') out.push(v);
        Object.values(v).forEach(walk);
      }
    };
    walk(board);
    return out;
  }

  // ---------------------------------------------------------------- the list (approved 23 Nov)
  const ORGS = [
    {
      key: 'c1',
      name: 'TEST · Najd Travel Desk',
      ar: 'تجريبي · مكتب نجد للسفر',
      side: 'client',
      type: 'corporate',
      clientId: '990370001',
      sub: 'postpaid',
      status: 'active',
    },
    {
      key: 'c2',
      name: 'TEST · Hijaz Events Co',
      ar: 'تجريبي · شركة الحجاز للفعاليات',
      side: 'client',
      type: 'corporate',
      clientId: '990370002',
      sub: 'prepaid',
      status: 'active',
    },
    {
      key: 'c3',
      name: 'TEST · Eastern Prospect Group',
      ar: 'تجريبي · مجموعة الشرقية المحتملة',
      side: 'client',
      type: 'corporate',
      status: 'prospect',
    },
    {
      key: 'c4',
      name: 'TEST · Archived Old Client',
      ar: 'تجريبي · عميل قديم مؤرشف',
      side: 'client',
      type: 'corporate',
      status: 'active',
      archive: true,
    },
    {
      key: 's1',
      name: 'TEST · Gulf Hotels Supplier',
      ar: 'تجريبي · مورد فنادق الخليج',
      side: 'supplier_partner',
      type: null,
      status: 'active',
    },
    {
      key: 's2',
      name: 'TEST · Red Sea Transport Partner',
      ar: 'تجريبي · شريك نقل البحر الأحمر',
      side: 'supplier_partner',
      type: null,
      status: 'active',
    },
  ];
  /** Nine open tasks and two done ones for each of the three: due offsets in days from today. */
  const DUE = [-2, 0, 0, 2, 4, 6, 12, 20, 35];
  const TASK_WORDS = [
    'Call the travel desk',
    'Send the price list',
    'Confirm the booking sheet',
    'Prepare the visit notes',
    'Follow up on the contract',
    'Update the contact list',
    'Review the monthly figures',
    'Plan the next meeting',
    'Collect the missing papers',
  ];
  const TASKS = ['member', 'viewer', 'head'].flatMap((who) => [
    ...DUE.map((due, n) => ({ who, title: `${MARK}${who} ${n + 1} · ${TASK_WORDS[n]}`, due, n, done: false })),
    ...[0, 1].map((n) => ({
      who,
      title: `${MARK}${who} done ${n + 1} · Closed last week`,
      due: -7 - n,
      n: 9 + n,
      done: true,
    })),
  ]);
  const PROJECT = `${MARK}Spring partner programme`;
  const ACHIEVEMENTS = [
    { who: 'member', title: `${MARK}Renewal agreed with the travel desk`, back: 0, org: 'c1' },
    { who: 'member', title: `${MARK}New route added to the offer`, back: 0 },
    { who: 'head', title: `${MARK}Quarterly review held`, back: 0 },
    { who: 'member', title: `${MARK}Late payment recovered`, back: 1, org: 'c2' },
    { who: 'head', title: `${MARK}Supplier terms improved`, back: 1 },
    { who: 'head', title: `${MARK}Team training completed`, back: 1 },
  ];
  const OPPS = [
    { title: `${MARK}Corporate travel account`, org: 'c1', stage: 0 },
    { title: `${MARK}Events package`, org: 'c2', stage: 1 },
  ];
  const TENDER = { title: `${MARK}Ministry travel services tender`, org: 'c3' };
  /** Finance, option A: six typed invoices on the two TEST clients, across the last three months. */
  const INVOICES = [
    { ref: 'TESTENR-0001', org: 'c1', back: 2, status: 'Fully Paid', total: 4000 },
    { ref: 'TESTENR-0002', org: 'c1', back: 1, status: 'Fully Paid', total: 6000, cost: 2400 },
    { ref: 'TESTENR-0003', org: 'c2', back: 1, status: 'Fully Paid', total: 2500 },
    { ref: 'TESTENR-0004', org: 'c2', back: 0, status: 'Fully Paid', total: 3500 },
    { ref: 'TESTENR-0005', org: 'c1', back: 0, status: 'Pending', total: 5000 },
    { ref: 'TESTENR-0006', org: 'c2', back: 0, status: 'Draft', total: 1500 },
  ];
  /**
   * The exact change to the year-to-date Finance figures when all six are added, in riyals — measured on a database
   * built from zero (scripts/fixtures/enrich-prove-local.mjs) and checked again after every --write.
   */
  const FINANCE_CHANGE = { revenue: 16000, cost: 2400, profit: 3600 };

  /** The year-to-date figures as the Finance page reads them. */
  async function figures() {
    const p = await api('finance_period', { p_from: yearStart, p_to: today });
    const t = p?.totals ?? p?.total ?? p;
    const n = (/** @type {unknown} */ v) => (typeof v === 'number' ? v : v === null || v === undefined ? 0 : Number(v));
    return { revenue: n(t?.revenue), cost: n(t?.cost), profit: n(t?.profit) };
  }
  const money = (/** @type {number} */ v) => new Intl.NumberFormat('en-US').format(v);

  // ---------------------------------------------------------------- clean
  if (mode === 'clean') {
    const had = await existing();
    const before = await figures();
    const ids = (/** @type {any[]} */ a) =>
      a.map((x) => x.id ?? fail('a record to remove has no id: nothing more was removed'));
    if (had.invoices.length)
      await write('finance_rows_remove', { p_table: 'invoice', p_ids: ids(had.invoices), p_reason: REASON });
    if (had.achievements.length) await write('achievements_remove', { p_ids: ids(had.achievements), p_reason: REASON });
    if (had.opportunities.length)
      await write('pipeline_remove', { p_entity: 'opportunity', p_ids: ids(had.opportunities), p_reason: REASON });
    if (had.tenders.length)
      await write('pipeline_remove', { p_entity: 'tender', p_ids: ids(had.tenders), p_reason: REASON });
    if (had.tasks.length) await write('tasks_remove', { p_ids: ids(had.tasks), p_reason: REASON });
    if (had.projects.length) await write('projects_remove', { p_ids: ids(had.projects), p_reason: REASON });
    for (const p of had.partners) await write('partner_remove', { p_id: p.id, p_reason: REASON });
    const after = await figures();
    const left = await existing();
    console.log(
      `enrich --clean: removed ${had.tasks.length} tasks, ${had.projects.length} projects, ${had.partners.length} organisations, ${had.achievements.length} achievements, ${had.opportunities.length + had.tenders.length} pipeline cards, ${had.invoices.length} invoices.`,
    );
    const remaining = Object.values(left).reduce((n, a) => n + a.length, 0);
    console.log(`  still there under this script's names: ${remaining}`);
    for (const k of /** @type {const} */ (['revenue', 'cost', 'profit']))
      console.log(
        `  Finance ${k}, year to date: ${money(before[k])} → ${money(after[k])} (${money(after[k] - before[k])})`,
      );
    if (remaining) fail('the clean-up left something behind: report this');
    return;
  }

  // ---------------------------------------------------------------- plan
  const had = await existing();
  const has = (/** @type {any[]} */ rows, /** @type {string} */ field, /** @type {string} */ value) =>
    rows.find((r) => r[field] === value);
  const todo = {
    orgs: ORGS.filter((o) => !has(had.partners, 'trade_name_en', o.name)),
    tasks: TASKS.filter((t) => !has(had.tasks, 'title', t.title)),
    project: has(had.projects, 'name', PROJECT) ? 0 : 1,
    achievements: ACHIEVEMENTS.filter((a) => !has(had.achievements, 'title', a.title)),
    opps: OPPS.filter((o) => !has(had.opportunities, 'title', o.title)),
    tender: has(had.tenders, 'title', TENDER.title) ? 0 : 1,
    invoices: INVOICES.filter((i) => !has(had.invoices, 'ref', i.ref)),
  };
  const before = await figures();
  const partial = todo.invoices.length !== 0 && todo.invoices.length !== INVOICES.length;
  const change = todo.invoices.length === INVOICES.length ? FINANCE_CHANGE : { revenue: 0, cost: 0, profit: 0 };
  console.log(
    `enrich (${mode}) as ${self.full_name_en}; for ${WHO.head.full_name_en}, ${WHO.member.full_name_en}, ${WHO.viewer.full_name_en}`,
  );
  console.log(
    `  to add: ${todo.orgs.length} organisations (of ${ORGS.length}), ${todo.tasks.length} tasks (of ${TASKS.length}), ${todo.project} project, ${todo.achievements.length} achievements (of ${ACHIEVEMENTS.length}), ${todo.opps.length + todo.tender} pipeline cards (of 3), ${todo.invoices.length} invoices (of ${INVOICES.length}); with them a discount code, contacts, notes, steps and comments`,
  );
  if (partial)
    fail('some of the six test invoices are there and some are not: run --clean first, so the Finance change is exact');
  console.log('  Finance, year to date — the exact change this run makes:');
  for (const k of /** @type {const} */ (['revenue', 'cost', 'profit']))
    console.log(
      `    ${k.padEnd(8)} ${money(before[k]).padStart(12)} → ${money(before[k] + change[k]).padStart(12)}   (+${money(change[k])})`,
    );
  console.log(
    '    (revenue: the 4 fully paid invoices, 4,000 + 6,000 + 2,500 + 3,500; cost: the one approved cost, 2,400; profit: only the invoice whose cost is known, 6,000 − 2,400; the Pending 5,000 and the Draft 1,500 count in no figure)',
  );
  if (mode === 'plan') {
    console.log('  Nothing was written. Run again with --write to add it.');
    return;
  }

  // ---------------------------------------------------------------- write
  /** @type {Record<string, string>} */
  const org = Object.fromEntries(
    had.partners.map((p) => [ORGS.find((o) => o.name === p.trade_name_en)?.key ?? p.id, p.id]),
  );
  for (const o of todo.orgs) {
    // the type comes from the workspace's own list: the one named, else the first of that side
    const types = lists.sideType.filter((/** @type {any} */ x) => x.side === o.side && x.active !== false);
    const type = (types.find((/** @type {any} */ x) => x.key === o.type) ?? types[0])?.key;
    if (!type) fail(`no organisation type is set up for the ${o.side} side`);
    const side = { side: o.side, type };
    const made = await write('partner_create', {
      p_partner: { trade_name_en: o.name, trade_name_ar: o.ar, sides: [side] },
      p_reason: REASON,
    });
    org[o.key] = made.id;
    await write('partner_owner_set', {
      p_id: made.id,
      p_side: o.side,
      p_person: WHO.member.id,
      p_from: null,
      p_reason: REASON,
    });
    await write('contact_save', {
      p_partner: made.id,
      p_id: null,
      p_values: {
        name_en: `TEST Contact ${o.key.toUpperCase()}`,
        email: `desk.${o.key}@example.test`,
        is_primary: true,
      },
    });
    if (o.clientId)
      await write('identifier_add', {
        p_partner: made.id,
        p_kind: 'payments_client_id',
        p_value: o.clientId,
        p_reason: REASON,
        p_subkind: o.sub,
      });
    if (o.status !== 'active') await write('partner_status_set', { p_id: made.id, p_side: o.side, p_status: o.status });
    await write('activity_log', {
      p_partner: made.id,
      p_type: 'call',
      p_outcome: 'answered',
      p_happened_on: riyadh(-3),
      p_body: 'TEST: a made-up call about next season.',
      p_next_step: null,
      p_next_step_on: null,
      p_mentions: null,
    });
    await write('note_add', {
      p_entity: 'partner',
      p_id: made.id,
      p_kind: 'comment',
      p_body: 'TEST: a made-up note on this organisation.',
      p_happened_on: null,
      p_mentions: null,
    });
    if (o.key === 'c1')
      await write('identifier_add', {
        p_partner: made.id,
        p_kind: 'discount_code',
        p_value: 'TESTENR10',
        p_reason: REASON,
      });
  }

  let projectId = has(had.projects, 'name', PROJECT)?.id;
  if (!projectId) {
    const p = await write('project_save', {
      p_id: null,
      p_values: { name: PROJECT, owner_id: WHO.head.id, partner_id: org.c1, start_on: riyadh(-10), due_on: riyadh(40) },
    });
    projectId = p.id;
    await write('project_health_set', {
      p_project: projectId,
      p_health: 'on_track',
      p_line: 'TEST: a made-up health note — on track.',
    });
  }

  /** @type {Record<string, string>} */
  const taskId = Object.fromEntries(had.tasks.map((t) => [t.title, t.id]));
  for (const t of todo.tasks) {
    const owner = WHO[/** @type {'member'|'viewer'|'head'} */ (t.who)];
    /** @type {Record<string, unknown>} */
    const values = { title: t.title, owner_id: owner.id, due_on: riyadh(t.due) };
    const p = prio(t.n);
    if (p) values.priority = p;
    if (t.n === 3) values.partner_id = org.c1;
    if (t.who === 'head' && t.n >= 5 && t.n <= 8) values.project_id = projectId;
    const made = await write('task_create', { p_values: values });
    taskId[t.title] = made.id;
    if (t.done) await write('task_status_set', { p_id: made.id, p_status: statusOf('done') });
    else if (t.n === 4 || t.n === 5)
      await write('task_status_set', { p_id: made.id, p_status: statusOf('in_progress') });
    // blocked is "in progress, with the reason it is stuck"
    else if (t.n === 7)
      await write('task_status_set', {
        p_id: made.id,
        p_status: statusOf('in_progress'),
        p_reason: 'TEST: waiting on a made-up approval',
      });
    if (!t.done && (t.n === 1 || t.n === 6)) {
      const first = await write('action_item_add', {
        p_task: made.id,
        p_values: { text: 'TEST step: gather the details' },
      });
      await write('action_item_add', { p_task: made.id, p_values: { text: 'TEST step: send it for review' } });
      await write('action_item_done', { p_id: first.id, p_done: true });
      await write('comment_add', {
        p_entity: 'task',
        p_id: made.id,
        p_body: 'TEST comment: waiting on the made-up reply.',
      });
      const decision = await write('comment_add', {
        p_entity: 'task',
        p_id: made.id,
        p_body: 'TEST decision: go ahead with the made-up plan.',
      });
      await write('comment_decide', { p_id: decision.id, p_on: true });
    }
  }

  for (const a of todo.achievements) {
    const cats = rowsOf(await api('achievement_categories', {})).filter(
      (/** @type {any} */ c) =>
        c.active !== false && !c.has_deal_value && !c.required_ref_system_id && !c.sets_prospect,
    );
    if (!cats.length) fail('no achievement category without a deal value was found: open this year’s plan first');
    /** @type {Record<string, unknown>} */
    const values = { category: cats[0].code, title: a.title, happened_on: a.back === 0 ? today : midMonth(a.back) };
    if (a.org) values.partner_id = org[a.org];
    // the second one is logged from the member's first done task
    if (a === ACHIEVEMENTS[1] && taskId[`${MARK}member done 1 · Closed last week`])
      values.source_task_id = taskId[`${MARK}member done 1 · Closed last week`];
    const made = await write('achievement_log', { p_values: values });
    await write('achievements_assign', {
      p_ids: [made.id],
      p_owner: WHO[/** @type {'member'|'head'} */ (a.who)].id,
      p_reason: REASON,
    });
  }

  const stages = rowsOf(await api('list', { p_list: 'pipeline_stage' }));
  const clientTypes = lists.sideType.filter((/** @type {any} */ x) => x.side === 'client' && x.active !== false);
  const clientType = (clientTypes.find((/** @type {any} */ x) => x.key === 'corporate') ?? clientTypes[0])?.key;
  if ((todo.opps.length || todo.tender) && !lists.source.length) fail('no pipeline source is set up');
  for (const o of todo.opps) {
    const made = await write('opportunity_save', {
      p_id: null,
      p_values: {
        title: o.title,
        partner_id: org[o.org],
        side: 'client',
        type: clientType,
        source: lists.source[0]?.key,
        owner_id: WHO.member.id,
        next_step: 'TEST: a made-up next step',
        next_step_on: riyadh(7),
      },
    });
    const open = stages.filter(
      (/** @type {any} */ s) => s.kind === 'partnership' && s.meaning === 'open' && !s.optional,
    );
    if (o.stage > 0 && open[o.stage])
      await write('pipeline_move', { p_entity: 'opportunity', p_id: made.id, p_stage: open[o.stage].key });
  }
  if (todo.tender)
    await write('tender_save', {
      p_id: null,
      p_values: {
        title: TENDER.title,
        partner_id: org[TENDER.org],
        source: lists.source[0]?.key,
        owner_id: WHO.head.id,
        submission_due_on: riyadh(30),
        tender_no: 'TESTENR-T1',
        segment_reason: 'TEST: a made-up tender, no project yet',
      },
    });

  for (const i of todo.invoices) {
    const o = ORGS.find((x) => x.key === i.org);
    const on = i.back === 0 ? riyadh(-1) : midMonth(i.back);
    const made = await write('finance_row_add', {
      p_table: 'invoice',
      p_fields: {
        ref: i.ref,
        kind: 'transaction',
        status: i.status,
        created_on: on,
        ...(i.status === 'Fully Paid' ? { paid_on: on } : {}),
        total_sar: i.total,
        client_id: o?.clientId,
        customer_name: o?.name,
      },
      p_reason: REASON,
    });
    if (i.cost)
      await write('finance_row_add', {
        p_table: 'expense_line',
        p_fields: { invoice_id: made.id, expense_type: 'Hotel', status: 'Approved', amount_sar: i.cost },
        p_reason: REASON,
      });
  }
  if (!has(had.partners, 'trade_name_en', ORGS[3]?.name ?? '') && org.c4)
    await write('partner_archive', { p_id: org.c4, p_reason: REASON });

  const after = await figures();
  console.log(`enrich --write: done, ${writes} writes through the app's doors.`);
  let exact = true;
  for (const k of /** @type {const} */ (['revenue', 'cost', 'profit'])) {
    const moved = after[k] - before[k];
    if (moved !== change[k]) exact = false;
    console.log(
      `  Finance ${k}, year to date: ${money(before[k])} → ${money(after[k])} (+${money(moved)}; expected +${money(change[k])})`,
    );
  }
  if (!exact) fail('the Finance figures did not move by exactly what was said: run --clean and report this');
}

// ---------------------------------------------------------------- the runner: whatever happened, switch back
/** Ends the switch and proves it: the app must answer as the Admin account again. */
async function switchBack() {
  const name = state.holder?.full_name_en ?? 'the Admin account';
  const ended = await client.rpc('test_switch_end');
  if (ended.error) {
    console.error(
      `enrich: THE SWITCH BACK WAS REFUSED (${ended.error.message}). Sign this account out of every device (My profile) to end it.`,
    );
    return false;
  }
  const again = await client.rpc('me');
  const back = !again.error && again.data?.person?.id === state.holder?.id;
  console.log(`enrich: switched back to ${name}: ${back ? 'yes' : 'NO'}`);
  if (!back)
    console.error(`enrich: THE SWITCH BACK COULD NOT BE PROVEN. Sign this account out of every device (My profile).`);
  else state.switched = false;
  return back;
}

let code = 0;
try {
  await main();
} catch (e) {
  code = 1;
  console.error(`enrich: ${e instanceof Stop ? e.message : e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
}
if (state.switched && !(await switchBack())) code = 1;
await client.auth.signOut({ scope: 'local' });
process.exit(code);
