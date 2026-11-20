/**
 * Landing 34 (the fixes of the test round of 19 Nov) · what its two browser specs share: made-up people of each role
 * with a team of their own, VOLUME (forty organisations, twenty-five tasks of one person, a streak of done days), a
 * far-past month holding both a provisional row typed in the app and an imported row with no cost, two TEST users,
 * and Arabic switched on for one case at a time. Every value is made up ("Made-up Org …", "Made-up task …").
 */
import { expect, type Page } from '@playwright/test';
import pg from 'pg';
import { oldMonth } from './finance-month';
import { personAs, rowNo, seedImported, seedOrg, tag, type Door, type RoleKey } from './landing-32';
import { sql, type TestPerson } from './stack';

export {
  doorOf,
  hydrated,
  num,
  personAs,
  seedOrg,
  signedInAdmin,
  signedInAs,
  tag,
  today,
  type Door,
  type RoleKey,
} from './landing-32';

export const PHONE = { width: 375, height: 812 };
export const DESKTOP = { width: 1440, height: 900 };

/** How far the page is wider than the screen (0 or less: nothing scrolls sideways). */
export const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ---------------------------------------------------------------------------------------------------- people

export type Staff = TestPerson & { teamId: string };

/** A made-up person of one role, in a made-up team of their own (a task needs its owner's team). */
export async function staffAs(role: Exclude<RoleKey, 'none'>): Promise<Staff> {
  const person = await personAs(role);
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [person.id, `l34_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [person.id, team!.id]);
  return { ...person, teamId: team!.id };
}

// ----------------------------------------------------------------------------------------------------- tasks

type TaskSeed = {
  /** Days from today (Riyadh) to the due day; null: no due day. */
  offset: number | null;
  starred?: boolean;
  /** The Riyadh day (YYYY-MM-DD) the task was finished on; left out: the task is open. */
  doneOn?: string;
};

/** One made-up task of a person, written straight into the stack (as the other specs' fixtures are). */
export async function seedTask(owner: Staff, title: string, seed: TaskSeed): Promise<string> {
  const number = `TSK-1999-${Date.now()}${Math.floor(Math.random() * 100000)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by, due_on,
                            closed_at, closed_by)
     values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
             (select id from work.task_status where deleted_at is null
                and case when $6::text is not null then meaning = 'done' else is_default end limit 1),
             'internal', $3, case when $5::int is null then null else core.riyadh_today() + $5::int end,
             case when $6::text is not null then ($6::date + time '12:00') at time zone 'Asia/Riyadh' end,
             case when $6::text is not null then $3::uuid end)`,
    [number, title, owner.id, owner.teamId, seed.offset, seed.doneOn ?? null],
  );
  if (seed.starred) await sql(`update work.task set starred = true where number = $1`, [number]);
  return number;
}

export type OpenTasks = { starred: string[]; quick: string[]; later: string[] };

/**
 * A person's open tasks: `starred` starred ones (Important), `quick` unstarred ones due today or overdue (Short), and
 * `later` unstarred ones due five or more days ahead (Maintenance — the My day read carries those only while they
 * fall inside this week, so a test never counts on them being drawn).
 */
export async function seedOpenTasks(
  owner: Staff,
  word: string,
  counts: { starred: number; quick: number; later: number },
): Promise<OpenTasks> {
  const out: OpenTasks = { starred: [], quick: [], later: [] };
  for (let i = 0; i < counts.starred; i += 1)
    out.starred.push(
      await seedTask(owner, `Made-up task ${word} starred ${i + 1}`, { offset: i % 2 ? 6 : 0, starred: true }),
    );
  for (let i = 0; i < counts.quick; i += 1)
    out.quick.push(await seedTask(owner, `Made-up task ${word} quick ${i + 1}`, { offset: i % 2 ? -1 : 0 }));
  for (let i = 0; i < counts.later; i += 1)
    out.later.push(await seedTask(owner, `Made-up task ${word} later ${i + 1}`, { offset: 5 + i }));
  return out;
}

/**
 * A streak: three tasks done today and three on each of the two working days before today (Friday and Saturday are
 * stepped over, as the database's rule does). Answers what `api.my_streak` must then say: two days, and a third when
 * today is itself a working day; three done today.
 */
export async function seedStreak(owner: Staff, word: string): Promise<{ days: number; todayDone: number }> {
  const [now] = await sql<{ day: string; dow: number }>(
    `select to_char(core.riyadh_today(), 'YYYY-MM-DD') as day, extract(dow from core.riyadh_today())::int as dow`,
  );
  const before = await sql<{ day: string }>(
    `select to_char(core.riyadh_today() - i, 'YYYY-MM-DD') as day
       from generate_series(1, 10) i
      where extract(dow from (core.riyadh_today() - i)) not in (5, 6)
      order by i limit 2`,
  );
  for (const day of [now!.day, ...before.map((b) => b.day)])
    for (let i = 0; i < 3; i += 1)
      await seedTask(owner, `Made-up task ${word} done ${day} ${i + 1}`, { offset: null, doneOn: day });
  const working = ![5, 6].includes(Number(now!.dow));
  return { days: before.length + (working ? 1 : 0), todayDone: 3 };
}

/** Twenty-five tasks of one person: 5 starred, 8 due now, 3 later (16 open) and a streak's 9 done ones. */
export async function seedTwentyFive(owner: Staff, word: string) {
  const open = await seedOpenTasks(owner, word, { starred: 5, quick: 8, later: 3 });
  const streak = await seedStreak(owner, word);
  return { open, streak };
}

// ---------------------------------------------------------------------------------------------- organisations

export type SeededOrg = { id: string; name: string; token: string; archived: boolean; active: boolean };

const LONG_TAIL =
  'with a very long trade name that goes on and on for the made-up international travel and tourism holding group';

/**
 * `count` made-up organisations (Partner side), all carrying `word` in their name and each a token of its own
 * (`<word>n07`), so a search finds all of them or exactly one. The first has a very long name; every third is made
 * Active through the app's own function; the last three are archived, again through the app's own function.
 */
export async function seedOrganisations(call: Door, word: string, count = 40): Promise<SeededOrg[]> {
  const make = async (i: number): Promise<SeededOrg> => {
    const token = `${word}n${String(i).padStart(2, '0')}`;
    const name = `Made-up Org ${word} ${token}${i === 1 ? ` ${LONG_TAIL}` : ''}`;
    const p = await call('partner_create', {
      p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
    });
    const id = p.id!;
    const active = i % 3 === 0;
    const archived = i > count - 3;
    if (active) await call('partner_status_set', { p_id: id, p_side: 'client', p_status: 'active' });
    if (archived) await call('partner_archive', { p_id: id });
    return { id, name, token, archived, active };
  };
  const out: SeededOrg[] = [];
  // a few at a time: the stack is shared with every other spec
  for (let from = 1; from <= count; from += 5) {
    const batch = Array.from({ length: Math.min(5, count - from + 1) }, (_, k) => make(from + k));
    out.push(...(await Promise.all(batch)));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------- finance

/** The far-past months other specs keep for themselves by name (tests/e2e/landing-32-*.spec.ts). */
const TAKEN_MONTHS = ['1962-05', '1962-08', '1963-02', '1964-03', '1966-06'];

/** A far-past month nothing else uses: no invoice, no close, no imported row — and none of the named months. */
export async function quietMonth(): Promise<string> {
  for (let i = 0; i < 60; i += 1) {
    const ym = await oldMonth();
    if (TAKEN_MONTHS.includes(ym)) continue;
    const used = await sql(
      `select 1 from work.import_record
        where record_date >= $1::date and record_date < ($1::date + interval '1 month') limit 1`,
      [`${ym}-01`],
    );
    if (!used.length) return ym;
  }
  throw new Error('no quiet month left to seed');
}

export type FinanceMonth = {
  ym: string;
  /** The Finance page on exactly this month. */
  url: string;
  /** The first day of the month, as the months list names its row. */
  row: string;
  /** The revenue of the rows whose cost is not known yet: the row typed in the app AND the imported one. */
  provisional: number;
  revenue: number;
  cost: number;
  profit: number;
  org: { id: string; name: string };
};

const txRef = () => `TX-934${Math.floor(Math.random() * 900000 + 100000)}`;

/**
 * One month of made-up money, from both doors:
 *  · typed in the app — 1,000 paid with an approved cost of 600 (Final) and 500 paid with no cost yet (Provisional);
 *  · imported from Payments for one organisation — 1,000 with no cost (Provisional) and 250 with a cost of 50.
 * So the Provisional amount is 1,500 only when the imported row is counted in it (the app's own rows alone say 500).
 */
export async function seedFinanceMonth(call: Door, by: TestPerson): Promise<FinanceMonth> {
  const ym = await quietMonth();
  const paid = async (total: number, day: string, name: string) =>
    call('finance_row_add', {
      p_table: 'invoice',
      p_fields: {
        ref: txRef(),
        kind: 'transaction',
        status: 'Fully Paid',
        created_on: `${ym}-${day}`,
        paid_on: `${ym}-${day}`,
        total_sar: total,
        customer_name: name,
      },
      p_reason: 'made up',
    });
  const costed = await paid(1000, '10', 'Made-up Trading Org');
  await call('finance_row_add', {
    p_table: 'expense_line',
    p_fields: { invoice_id: costed.id, expense_type: 'Hotel', status: 'Approved', amount_sar: 600 },
    p_reason: 'made up',
  });
  await paid(500, '11', 'Made-up Travel Org');
  const org = await seedOrg(call, 'L34 Finance');
  await seedImported(org.id, by.id, `${ym}-15`, [
    { number: rowNo(), revenue: 1000, cost: null },
    { number: rowNo(), revenue: 250, cost: 50 },
  ]);
  return {
    ym,
    url: `/finance?period=custom&from=${ym}-01&to=${ym}-28`,
    row: `${ym}-01`,
    provisional: 1500,
    revenue: 2750,
    cost: 650,
    profit: 600,
    org: { id: org.id, name: org.name },
  };
}

/** A Riyadh day `days` before today, as YYYY-MM-DD. */
export function daysAgo(days: number): string {
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
  return new Date(Date.parse(`${now}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The Payments stamp's read answered with a made-up day, for this page only: the stamp is one date for the whole
 * stack, and other specs read it at the same moment — so the day is put in the answer on its way to this browser,
 * never into the database. `day()` is asked on every read, so a test can move it and load the page again.
 */
export async function paymentsAsOf(page: Page, day: () => string) {
  await page.route('**/rest/v1/rpc/finance_payments_as_of*', async (route) => {
    try {
      const response = await route.fetch();
      await route.fulfill({ response, json: { as_of: day(), files: { invoices: day() } } });
    } catch {
      // the page moved on before the answer
    }
  });
}

// ------------------------------------------------------------------------------------------------- test users

/**
 * A real admin who may switch, and two TEST users. `done()` leaves none behind: a person marked TEST changes the
 * People list other specs measure.
 */
export async function seedTestUsers() {
  const owner = await staffAs('admin');
  const first = await staffAs('member');
  const second = await staffAs('member');
  await sql(`update core.person set is_test = true where id = any($1)`, [[first.id, second.id]]);
  await sql(`insert into core.test_switch_holder (person_id, note) values ($1, 'made up: the owner')`, [owner.id]);
  const done = async () => {
    await sql(`delete from core.test_switch_holder where person_id = $1`, [owner.id]);
    await sql(`update core.person set is_test = false where id = any($1)`, [[first.id, second.id]]);
  };
  return { owner, first, second, done };
}

// ------------------------------------------------------------------------------------------------------ Arabic

/**
 * The Arabic switch is this case's alone for its whole length: the same database lock every Arabic spec takes
 * (support/arabic.ts), with Arabic OFF to start from — the case turns it on itself, through the screen — and off
 * again at the end, pass or fail.
 */
export async function arabicIsMine(run: () => Promise<void>): Promise<void> {
  const url = process.env.V2_DB_URL;
  if (!url)
    throw new Error("V2_DB_URL is not set — run the specs with the stack's settings (scripts/e2e/stack-env.mjs)");
  const off = () =>
    sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled' and deleted_at is null`);
  const lock = new pg.Client({ connectionString: url });
  await lock.connect();
  try {
    await lock.query(`select pg_advisory_lock(hashtext('e2e: Arabic is on'))`);
    await off();
    try {
      await run();
    } finally {
      await off();
    }
  } finally {
    await lock.end();
  }
}

/** Whether Arabic is on in the database now (the newest live company-wide row). */
export async function arabicIsOn(): Promise<boolean> {
  const rows = await sql<{ value: string }>(
    `select value::text from core.setting
      where key = 'app.arabic_enabled' and department_id is null and deleted_at is null
      order by valid_from desc, created_at desc limit 1`,
  );
  return rows[0]?.value === 'true';
}

// ------------------------------------------------------------------------------------------------- the screen

/** A record's sections bar on a phone: how many rows its tabs sit on, and where it ends against the bottom bar. */
export const sectionsBar = (page: Page) =>
  page.evaluate(() => {
    const nav = document.querySelector('[data-record-header][data-tabs-one-row] [data-tabs]');
    const bar = document.querySelector('[data-bottom-bar]');
    if (!nav || !bar) return null;
    const tabs = [...nav.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    return {
      tabs: tabs.length,
      rows: new Set(tabs.map((r) => Math.round(r.top))).size,
      height: Math.round(nav.getBoundingClientRect().height),
      tallest: Math.round(Math.max(...tabs.map((r) => r.height))),
      bottom: Math.round(nav.getBoundingClientRect().bottom),
      barTop: Math.round(bar.getBoundingClientRect().top),
    };
  });

/** Opens the top search with Ctrl K and types into it. */
export async function searchFor(page: Page, words: string) {
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await expect(palette, 'Ctrl K opens the search').toBeVisible();
  await palette.getByPlaceholder('Go to a page or search…').fill(words);
  return palette;
}
