/**
 * The desktop test round of 7 Oct (the Architect's JOB 1): the pilot cut (V517, V605 (6)) clicked through at 1440 px by
 * three people, judged against the three jobs a pilot user must do — log their day, run their tasks, record a won piece
 * of work:
 *   Clients (Suppliers & partners as its tab, a record page) · My day (a capture, a meeting note, Turn into, Finish
 *   meeting) · Tasks (Quick add, List / Board / Calendar, a task's record, an action item, Escalate, Team load, the
 *   owner picker for someone in no team) · the Past work grid · achievements (the + menu, Log achievement).
 * The people: the admin (in no team, V444), a member in a made-up Commercial team, and a member in no team (QA-521).
 * Levels: the deferred modules at none on the member and manager roles, KPIs and Tasks left as they are (V605 (6) opens
 * Tasks, the Past work grid and achievements on day one); put back at the end. Every step is a real click; each result
 * names its screen and what the screen said, and a screen not on the build is NOT BUILT, never FAIL.
 * Kept out of the full sweep: QA_ROUND=1 tests/qa/sweep/run.sh -- --grep "desktop round". Made-up people only (seed.mjs).
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAs, fx, hydrated, info, notBuilt, said, shot, signIn, sql, toast, user, verdict } from './lib';

const AREA = 'round';
const DEFERRED = ['finance', 'pipeline', 'projects', 'overview', 'reports', 'appraisal'];
const PILOT_ROLES = ['member', 'manager'];
const REASON = 'QA desktop round: made up';
const TSK = /\bTSK-\d{4}-\d{3,}\b/;
const ACH = /\bACH-\d{4}-\d{3,}\b/;
const RAW_KEY = /\b(pages|common|task|notify|access|partners|fields|actions)\.[a-z_]+\.[a-z_.]+\b/;
type Where = { screen?: string; user?: string; detail?: string };
const check = (expected: string, w: Where, ok: boolean) => verdict({ area: AREA, ...w, check: expected }, ok);
const gap = (what: string, w: Where = {}) => notBuilt({ area: AREA, ...w, check: what });
const note = (what: string, w: Where = {}) => info({ area: AREA, ...w, check: what });
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const mainText = async (page: Page) =>
  squash(
    (await page
      .getByRole('main')
      .innerText()
      .catch(() => '')) ?? '',
  );
const dialogText = async (page: Page) =>
  squash(
    (
      await page
        .getByRole('dialog')
        .allInnerTexts()
        .catch(() => [] as string[])
    ).join(' | '),
  );
const toastText = async (page: Page) =>
  squash(
    (
      await page
        .locator('[data-sonner-toast]')
        .allInnerTexts()
        .catch(() => [] as string[])
    ).join(' | '),
  );
/** Pick the first option of a Select (the trigger is found by its label). */
async function pickFirst(page: Page, scope: ReturnType<Page['locator']> | Page, label: RegExp): Promise<string> {
  const trigger = scope.getByLabel(label).first();
  if (!(await trigger.isVisible().catch(() => false))) return '';
  await trigger.click();
  const opt = page.getByRole('option').first();
  const text = (await opt.innerText().catch(() => '')) ?? '';
  await opt.click().catch(() => undefined);
  return squash(text);
}

/** Pick the option named `name` of a Select, else its first option. */
async function pickNamed(
  page: Page,
  scope: ReturnType<Page['locator']> | Page,
  label: RegExp,
  name: string,
): Promise<string> {
  const trigger = scope.getByLabel(label).first();
  if (!(await trigger.isVisible().catch(() => false))) return '';
  await trigger.click();
  const named = page.getByRole('option', { name });
  const opt = (await named.count()) > 0 ? named.first() : page.getByRole('option').first();
  const text = (await opt.innerText().catch(() => '')) ?? '';
  await opt.click().catch(() => undefined);
  return squash(text);
}

const PEOPLE = [
  { key: 'admin', who: 'the admin (in no team)' },
  { key: 'member', who: 'a Commercial member in a team' },
  { key: 'member2', who: 'a member in no team' },
] as const;

test.describe.configure({ mode: 'serial' });

test('desktop round: the pilot cut as an admin, a Commercial member and someone in no team', async ({ page }) => {
  test.setTimeout(1_500_000);
  const tag = `${fx().tag}${Math.random().toString(36).slice(2, 5)}`;
  const admin = await apiAs('admin');
  const { alpha, beta } = fx().orgs;
  const roles = await sql<{ id: string; key: string }>(`select id::text, key from core.role where key = any($1)`, [
    PILOT_ROLES,
  ]);
  const before = await sql<{ role_id: string; page_key: string; level: string }>(
    `select role_id::text, page_key, level::text from core.role_page_level
      where role_id = any($1::uuid[]) and page_key = any($2) and deleted_at is null`,
    [roles.map((r) => r.id), DEFERRED],
  );
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, 'فريق اختبار' from core.person where id = $1 returning id::text`,
    [user('member').id, `qa_r_${tag}`, `Test Team ${tag}`],
  );
  await sql(`update core.person set team_id = $2 where id = any($1::uuid[])`, [
    [user('member').id, user('manager').id],
    team!.id,
  ]);
  await sql(`update core.person set team_id = null where id = $1`, [user('member2').id]);
  // this year's plan for the people's department, so Log achievement has its categories (an admin opens it, V463)
  const [d] = await sql<{ id: string }>(`select department_id::text as id from core.person where id = $1`, [
    user('member').id,
  ]);
  const opened = await admin('plan_open', { p_department: d!.id, p_year: Number(fx().today.slice(0, 4)) });
  if (!opened.ok && !/exists|held|already/i.test(opened.key ?? '')) note(`plan_open: ${said(opened)}`);
  for (const r of roles)
    for (const p of DEFERRED) {
      const a = await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: 'none', p_reason: REASON });
      if (!a.ok) note(`set ${r.key} · ${p} to none: ${said(a)}`);
    }
  const levels = await sql<{ k: string; tasks: string; kpis: string }>(
    `select k, authz.level_of(p.id, 'tasks')::text as tasks, authz.level_of(p.id, 'kpis')::text as kpis
       from unnest($1::text[], $2::uuid[]) as x(k, id) join core.person p on p.id = x.id`,
    [PEOPLE.map((p) => p.key), PEOPLE.map((p) => user(p.key).id)],
  );
  note(`levels: ${levels.map((l) => `${l.k} tasks ${l.tasks} · kpis ${l.kpis}`).join('; ')}`);

  try {
    for (const { key, who } of PEOPLE) {
      const me = user(key);
      const at = (s: string, detail?: string) => ({ screen: s, user: `${key} (${who})`, detail });
      const step = async (name: string, fn: () => Promise<void>) => {
        try {
          await fn();
        } catch (e) {
          check(`${name} runs to the end`, at(page.url(), squash(String(e)).slice(0, 220)), false);
          await shot(page, `round-${key}-${name.replace(/\W+/g, '-')}`);
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      };
      await page.context().clearCookies();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await signIn(page, key, '/my-day');
      await hydrated(page);
      page.setDefaultTimeout(15_000);

      // ------------------------------------------------------------------ Clients, Suppliers & partners, a record
      await step('clients', async () => {
        await page.goto('/clients');
        await hydrated(page);
        const list = await mainText(page);
        check('Clients lists the made-up clients', at('/clients', list.slice(0, 160)), list.includes(alpha.name));
        const tab = page.locator('[data-side-tab="supplier_partner"]').first();
        const hasTab = await tab.isVisible().catch(() => false);
        const tabWords = hasTab ? squash((await tab.innerText().catch(() => '')) ?? '') : '';
        check('Clients carries Suppliers & partners as its tab', at('/clients', tabWords), hasTab);
        if (hasTab) {
          await tab.click();
          await page.waitForURL(/\/suppliers/, { timeout: 15_000 }).catch(() => undefined);
          await hydrated(page);
          const sup = await mainText(page);
          check(
            'the tab lists the made-up supplier',
            at(new URL(page.url()).pathname, sup.slice(0, 160)),
            sup.includes(beta.name),
          );
          await page.getByRole('link', { name: beta.name }).first().click();
          await page.waitForURL(/\/suppliers\/[0-9a-f-]{36}/, { timeout: 15_000 }).catch(() => undefined);
          await hydrated(page);
          const h1 = squash(
            (await page
              .getByRole('heading', { level: 1 })
              .first()
              .innerText()
              .catch(() => '')) ?? '',
          );
          const tabs = squash(
            (
              await page
                .getByRole('main')
                .getByRole('link', { name: /^(Overview|Activity|Related)/ })
                .allInnerTexts()
                .catch(() => [] as string[])
            ).join(' · '),
          );
          check(
            'a supplier opens on its record page, with Overview, Activity and Related',
            at('/suppliers/:id', `${h1} · tabs: ${tabs}`),
            h1.includes(beta.name) && /Overview/.test(tabs) && /Activity/.test(tabs),
          );
        }
        await page.goto(`/clients/${alpha.id}`);
        await hydrated(page);
        const rec = await mainText(page);
        check(
          "a client's record page opens, its words in words",
          at('/clients/:id', rec.slice(0, 140)),
          rec.includes(alpha.name) && !RAW_KEY.test(rec),
        );
      });

      // ------------------------------------------------------------------ job 1: log the day (My day)
      let meetingId = '';
      await step('my day', async () => {
        await page.goto('/my-day');
        await hydrated(page);
        const plain = `Test note ${tag} ${key}`;
        await page.locator('[data-capture-input]').fill(plain);
        await page.locator('[data-capture-input]').press('Enter');
        const filed = await toast(page, 'Note filed')
          .waitFor({ timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        check('a capture on My day is filed in My notes', at('/my-day', await toastText(page)), filed);
        await page.locator('[data-capture-input]').fill(`/meeting Test meeting ${tag} ${key}`);
        await page.locator('[data-capture-input]').press('Enter');
        await page.waitForTimeout(1_500);
        const [m] = await sql<{ id: string; kind: string }>(
          `select id::text, kind from my.note where person_id = $1 and title = $2 and deleted_at is null`,
          [me.id, `Test meeting ${tag} ${key}`],
        );
        check(
          'a "/meeting" capture is a meeting note',
          at('/my-day', m ? m.kind : 'no note saved'),
          m?.kind === 'meeting',
        );
        meetingId = m?.id ?? '';
        if (!meetingId) return;
        await page.goto(`/my-day/notes/${meetingId}`);
        await hydrated(page);
        await page.locator('[data-turn-into]').click();
        const kinds = await page
          .locator('[data-turn-kind]')
          .evaluateAll((e) => e.map((x) => x.getAttribute('data-turn-kind') ?? ''));
        await page.keyboard.press('Escape');
        note(`Turn into offers: ${kinds.join(', ')}`, at('/my-day/notes/:id'));
        for (const k of ['task', 'action_item', 'achievement'])
          if (!kinds.includes(k))
            gap(
              `a note turned into ${k === 'action_item' ? 'an action item' : `a${k === 'achievement' ? 'n' : ''} ${k}`}: Turn into does not offer it`,
              at('/my-day/notes/:id', `offered ${kinds.join(', ')}`),
            );
        // a reminder from the note (Turn into, the one kind besides a call or meeting)
        if (kinds.includes('reminder')) {
          await page.locator('[data-turn-into]').click();
          await page.locator('[data-turn-kind="reminder"]').click();
          const form = page.locator('[data-reminder-form]');
          const when = form.locator('input').first();
          const soon = await sql<{ v: string }>(
            `select to_char((now() at time zone 'Asia/Riyadh') + interval '2 hours', 'YYYY-MM-DD"T"HH24:MI') as v`,
          );
          await when.fill(soon[0]!.v).catch(() => undefined);
          await page.locator('[data-reminder-save]').click();
          await page.waitForTimeout(1_500);
          const [r] = await sql<{ n: number }>(
            `select count(*)::int as n from core.reminder where note_id = $1 and deleted_at is null`,
            [meetingId],
          );
          check(
            'a reminder is set from the note',
            at('/my-day/notes/:id · Reminder', `${r!.n} reminder(s); ${await toastText(page)}`),
            r!.n === 1,
          );
        }
        // Finish meeting: the meeting is logged on an organisation and the note says so
        const finish = page.locator('[data-finish-meeting]');
        if (!(await finish.isVisible().catch(() => false)))
          return gap('Finish meeting on a meeting note', at('/my-day/notes/:id'));
        await finish.click();
        const dlg = page.getByRole('dialog');
        await dlg.locator('[data-partner-search]').fill(alpha.name);
        await dlg.locator('[data-partner-hit]').first().click();
        const save = dlg.locator('[data-log-from-note-save]');
        const enabled = await save.isEnabled().catch(() => false);
        if (!enabled) await pickFirst(page, dlg, /Outcome/);
        await save.click();
        await page.waitForTimeout(2_000);
        const [fin] = await sql<{ finished: boolean; acts: number }>(
          `select n.finished_at is not null as finished,
                  (select count(*)::int from my.note_link l where l.note_id = n.id and l.deleted_at is null) as acts
             from my.note n where n.id = $1`,
          [meetingId],
        );
        check(
          'Finish meeting logs the meeting on the client and marks the note finished',
          at(
            '/my-day/notes/:id · Finish meeting',
            `finished ${fin?.finished}; links ${fin?.acts}; ${await toastText(page)}`,
          ),
          !!fin?.finished && (fin?.acts ?? 0) > 0,
        );
        await shot(page, `round-${key}-finish-meeting`);
      });

      // ------------------------------------------------------------------ job 2: run the tasks
      let taskNumber = '';
      await step('tasks', async () => {
        await page.goto('/tasks');
        await hydrated(page);
        const add = page.locator('[data-add-task]');
        if (!(await add.isVisible().catch(() => false))) {
          check('Tasks offers Add task', at('/tasks', (await mainText(page)).slice(0, 140)), false);
          return;
        }
        await add.click();
        const form = page.locator('form[data-quick-add]');
        const noTeam = page.locator('[data-no-team]');
        await form
          .locator('input[name="title"]')
          .or(noTeam)
          .first()
          .waitFor({ timeout: 15_000 })
          .catch(() => undefined);
        if (await noTeam.isVisible().catch(() => false)) {
          const t = squash((await noTeam.innerText().catch(() => '')) ?? '');
          check(
            'someone in no team who may not assign is told in one line what is missing (QA-521)',
            at('/tasks · Add task', t),
            /team/i.test(t) && !RAW_KEY.test(t),
          );
          await page.keyboard.press('Escape');
        } else {
          const title = `Test task ${tag} ${key}`;
          await form.locator('input[name="title"]').fill(title);
          const ownerBox = form.getByLabel(/Owner/).first();
          const ownerShown = await ownerBox.isVisible().catch(() => false);
          const ownerSaid = ownerShown ? squash((await ownerBox.innerText().catch(() => '')) ?? '') : '';
          if (key === 'admin')
            check(
              'the admin (in no team) is asked to pick an owner, with no Default (V605 (4))',
              at('/tasks · Quick add', `owner box: ${ownerShown ? ownerSaid || '(empty)' : 'none'}`),
              ownerShown && !/Default/i.test(ownerSaid),
            );
          await form.locator('button[type="submit"]').click();
          await page.waitForTimeout(1_200);
          const formSaid = squash((await form.innerText().catch(() => '')) ?? '');
          if (ownerShown && /Pick an owner/i.test(formSaid)) {
            const picked = await pickNamed(page, form, /Owner/, me.name);
            note(`owner picked: ${picked}`, at('/tasks · Quick add'));
            await form.locator('button[type="submit"]').click();
          }
          await page.waitForTimeout(2_000);
          const [t] = await sql<{ number: string; owner: string }>(
            `select number, owner_id::text as owner from work.task where title = $1 and deleted_at is null`,
            [title],
          );
          taskNumber = t?.number ?? '';
          check(
            'Quick add makes the task with its TSK- number',
            at(
              '/tasks · Quick add',
              t
                ? `${t.number}, owner ${t.owner === me.id ? 'me' : 'another'}`
                : `nothing saved; ${formSaid.slice(0, 120)} ${await toastText(page)}`,
            ),
            TSK.test(taskNumber),
          );
        }
        // List / Board / Calendar
        await page.goto('/tasks');
        await hydrated(page);
        const layouts = page.locator('[data-layouts]');
        // a layout draws My work's rows; an empty My work shows its empty message in each layout instead
        const myRows = await page.locator('[data-task-row]').count();
        if (!(await layouts.isVisible().catch(() => false))) gap('List / Board / Calendar on Tasks', at('/tasks'));
        else if (myRows === 0) {
          const empty = await mainText(page);
          note(`My work is empty here, so each layout shows its empty message: ${empty.slice(0, 120)}`, at('/tasks'));
          await page.locator('[data-layout="board"]').click();
          await page.waitForURL(/layout=board/, { timeout: 15_000 }).catch(() => undefined);
          const boardEmpty = await mainText(page);
          check(
            'an empty My work says so in words on the board too',
            at('/tasks · board', boardEmpty.slice(0, 160)),
            /no |nothing|empty/i.test(boardEmpty) && !RAW_KEY.test(boardEmpty),
          );
          await page.locator('[data-layout="list"]').click();
        } else
          for (const [l, mark] of [
            ['board', '[data-task-board]'],
            ['calendar', '[data-task-calendar]'],
            ['list', '[data-tasks-list], [data-task-rows]'],
          ] as const) {
            await page.locator(`[data-layout="${l}"]`).click();
            if (l !== 'list')
              await page.waitForURL(new RegExp(`layout=${l}`), { timeout: 15_000 }).catch(() => undefined);
            const shown = await page
              .locator(mark)
              .first()
              .waitFor({ timeout: 15_000 })
              .then(() => true)
              .catch(() => false);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            check(
              `Tasks shows its ${l} layout`,
              at(`/tasks · ${l}`, `shown ${shown}; sideways ${overflow}px`),
              shown && overflow <= 1,
            );
            if (l === 'board' && taskNumber)
              check(
                'the new task is on the board',
                at('/tasks · board'),
                (await page.locator('[data-board-card]', { hasText: taskNumber }).count()) > 0 ||
                  (await page.locator('[data-board-card]', { hasText: `Test task ${tag}` }).count()) > 0,
              );
          }
        // Team load: for whoever leads a team (a manager or an admin), not a member
        const load = await page.locator('[data-team-load]').count();
        note(`Team load on /tasks: ${load > 0 ? 'shown' : 'not shown'}`, at('/tasks'));
        if (key !== 'admin') check('a member is shown no Team load', at('/tasks', `Team load ${load}`), load === 0);
        // the Past work grid
        const past = page.getByRole('link', { name: /Past work/ }).first();
        const pastShown = await past.isVisible().catch(() => false);
        check('Tasks offers Past work', at('/tasks'), pastShown);
        if (pastShown) {
          await past.click();
          await page.waitForTimeout(1_200);
          const panel = await page
            .locator('[data-past-work-panel]')
            .first()
            .isVisible()
            .catch(() => false);
          check('Past work opens its grid', at(new URL(page.url()).pathname + new URL(page.url()).search), panel);
        }
        if (!taskNumber) return;
        // the task's record: an action item, then Escalate
        await page.goto(`/tasks/${taskNumber}`);
        await hydrated(page);
        await page
          .getByRole('tab', { name: /Action items/ })
          .or(page.getByRole('link', { name: /Action items/ }))
          .first()
          .click()
          .catch(() => undefined);
        const addItem = page.locator('form[data-add-item]').first();
        await addItem.waitFor({ timeout: 10_000 }).catch(() => undefined);
        if (!(await addItem.isVisible().catch(() => false))) gap('an action item on a task', at('/tasks/:number'));
        else {
          await addItem.locator('input[name="item"]').fill(`Test item ${tag}`);
          await addItem.locator('button[type="submit"]').click();
          await page.waitForTimeout(1_500);
          const [ai] = await sql<{ n: number }>(
            `select count(*)::int as n from work.action_item i join work.task t on t.id = i.task_id
              where t.number = $1 and i.deleted_at is null`,
            [taskNumber],
          );
          check(
            'an action item is added to the task',
            at(
              '/tasks/:number · Add item',
              `${ai!.n} item(s); ${await toastText(page)} ${await dialogText(page)}`.slice(0, 220),
            ),
            ai!.n >= 1,
          );
          await page.keyboard.press('Escape').catch(() => undefined);
        }
        const esc = page.locator('[data-escalate-open]');
        if (!(await esc.isVisible().catch(() => false))) {
          note('Escalate is not offered on this task', at('/tasks/:number'));
          return;
        }
        await esc.click();
        const dlg = page.getByRole('dialog');
        const to = await pickFirst(page, dlg, /^(To|Escalate to)/);
        await dlg
          .locator('textarea, input[name="note"]')
          .first()
          .fill(`Test escalation ${tag}`)
          .catch(() => undefined);
        await dlg.locator('button[type="submit"]').click();
        await page.waitForTimeout(2_000);
        const [e] = await sql<{ n: number }>(
          `select count(*)::int as n from notify.notification n join work.task t on t.id = n.entity_id
            where t.number = $1 and n.kind = 'escalated'`,
          [taskNumber],
        );
        check(
          'Escalate tells the person picked',
          at(
            '/tasks/:number · Escalate',
            `to ${to || '(no one offered)'}; ${e!.n} notice(s); ${await toastText(page)} ${await dialogText(page)}`.slice(
              0,
              220,
            ),
          ),
          e!.n >= 1,
        );
        await page.keyboard.press('Escape').catch(() => undefined);
      });

      // ------------------------------------------------------------------ job 3: record a won piece of work
      await step('achievement', async () => {
        await page.goto('/my-day');
        await hydrated(page);
        const create = page.getByRole('button', { name: /^Create$/ }).first();
        let items: string[] = [];
        if (await create.isVisible().catch(() => false)) {
          await create.click();
          items = (
            await page
              .getByRole('menuitem')
              .allInnerTexts()
              .catch(() => [] as string[])
          ).map(squash);
        }
        const logItem = page.getByRole('menuitem', { name: /^(Log )?achievement$/i });
        const offered = (await logItem.count()) > 0;
        check('the + offers Log achievement', at('+ Create', items.join(', ') || 'no + button'), offered);
        if (!offered) {
          await page.keyboard.press('Escape');
          return;
        }
        await logItem.first().click();
        await page.waitForURL(/\/kpis\/achievements\/new/, { timeout: 15_000 }).catch(() => undefined);
        await hydrated(page);
        const form = page.locator('[data-log-form]');
        const noCats = await page
          .locator('[data-no-categories]')
          .isVisible()
          .catch(() => false);
        if (noCats) {
          const t = squash(
            (await page
              .locator('[data-no-categories]')
              .innerText()
              .catch(() => '')) ?? '',
          );
          check(
            "Log achievement has its categories (this year's plan is open)",
            at('/kpis/achievements/new', t),
            false,
          );
          return;
        }
        const cat = await pickFirst(page, form, /Category/);
        const title = `Test win ${tag} ${key}`;
        await form.getByLabel(/^What/).fill(title);
        await form
          .locator('[data-partner-search]')
          .fill(alpha.name)
          .catch(() => undefined);
        await form
          .locator('[data-partner-hit]')
          .first()
          .click()
          .catch(() => undefined);
        const side = form.getByLabel(/^Side/).first();
        if (await side.isVisible().catch(() => false)) await pickFirst(page, form, /^Side/);
        await form.locator('button[type="submit"]').first().click();
        // a like one logged before asks "Logged before?" (V531): this one is new
        const fresh = page.locator('[data-repeat-new]');
        if (
          await fresh
            .waitFor({ timeout: 4_000 })
            .then(() => true)
            .catch(() => false)
        ) {
          note('Log achievement asked "Logged before?" (V531); answered: a new one', at('/kpis/achievements/new'));
          await fresh.click();
        }
        await page.waitForTimeout(2_500);
        const [a] = await sql<{ number: string; owner: string }>(
          `select number, owner_id::text as owner from perf.achievement where title = $1 and deleted_at is null`,
          [title],
        );
        const nowAt = new URL(page.url()).pathname;
        const shown = await mainText(page);
        check(
          'Log achievement saves a won piece of work with its ACH- number, and shows it',
          at(
            '/kpis/achievements/new',
            a
              ? `${a.number} (${cat}); now at ${nowAt}`
              : `nothing saved; ${shown.slice(0, 140)} ${await toastText(page)}`,
          ),
          !!a && ACH.test(a.number) && (shown.includes(a.number) || shown.includes(title)),
        );
        await shot(page, `round-${key}-achievement`);
      });
    }
  } finally {
    for (const r of roles)
      for (const p of DEFERRED) {
        const was = before.find((b) => b.role_id === r.id && b.page_key === p);
        if (was)
          await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: was.level, p_reason: REASON });
        else
          await sql(
            `update core.role_page_level set deleted_at = now(), delete_reason = $3
              where role_id = $1 and page_key = $2 and deleted_at is null`,
            [r.id, p, REASON],
          );
      }
  }
  expect(user('admin').id).toBeTruthy();
});
