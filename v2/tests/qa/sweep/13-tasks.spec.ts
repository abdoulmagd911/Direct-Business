/**
 * The Tasks screens (#147, P5-2's first PR on #140's tables; V270–V275, V189–V196), tried the way people get them wrong:
 * a member with no team yet adds a task, a double click on quick add's save, a colleague opening someone else's task,
 * a viewer looking for Add task, a status moved to a day still to come, and a task number that does not exist.
 * NOT BUILT where api.task_create is missing (v2/main before #140). Made-up people only (seed.mjs).
 */
import { expect, test } from '@playwright/test';
import { apiAs, fx, hydrated, notBuilt, said, signIn, sql, user, verdict } from './lib';

const AREA = 'tasks';
type Where = { screen?: string; user?: string; detail?: string };
const check = (expected: string, w: Where, ok: boolean) => verdict({ area: AREA, ...w, check: expected }, ok);
const RAW_KEY = /\b(task|common|person|access)\.[a-z_]+\b/;

async function built(): Promise<boolean> {
  const [r] = await sql<{ ok: boolean }>(`select to_regprocedure('api.task_create(jsonb,uuid[])') is not null as ok`);
  return !!r?.ok;
}

test.describe.configure({ mode: 'serial' });

test('Tasks: a teamless member, a double click, a colleague, a viewer, a future day, an unknown number', async ({
  page,
}) => {
  test.setTimeout(300_000);
  if (!(await built())) return notBuilt({ area: AREA, check: 'Tasks (P5-1/P5-2 not on this build)' });
  const tag = `${fx().tag}${Math.random().toString(36).slice(2, 5)}`;
  const member = user('member');
  const colleague = user('member2');

  // 1. a member who is in no team yet adds a task: either it is added, or the refusal is said in words
  await sql(`update core.person set team_id = null where id = $1`, [member.id]);
  await signIn(page, 'member', '/tasks');
  await hydrated(page);
  await page.locator('[data-add-task]').click();
  const form = page.locator('form[data-quick-add]');
  await form.locator('input[name="title"]').fill(`QA teamless ${tag}`);
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(2_000);
  const [made] = await sql<{ n: number }>(`select count(*)::int as n from work.task where title = $1`, [
    `QA teamless ${tag}`,
  ]);
  const said1 = ((await page.locator('[data-sonner-toast], [role=alert], form[data-quick-add]').allInnerTexts()) ?? [])
    .join(' | ')
    .replace(/\s+/g, ' ');
  check(
    'a member in no team: the task is added, or the refusal is said in words (never a raw key, never a silent no)',
    { screen: '/tasks · quick add', user: 'member', detail: `added ${made!.n}; on screen: ${said1.slice(0, 200)}` },
    made!.n === 1 || (said1.length > 0 && !RAW_KEY.test(said1) && /team/i.test(said1)),
  );

  // the rest in one made-up team
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, 'فريق اختبار' from core.person where id = $1 returning id::text`,
    [member.id, `qa_t_${tag}`, `Test Team ${tag}`],
  );
  await sql(`update core.person set team_id = $2 where id = any($1::uuid[])`, [[member.id, colleague.id], team!.id]);

  // 2. a double click on quick add's save adds one task
  await page.goto('/tasks');
  await hydrated(page);
  await page.locator('[data-add-task]').click();
  await form.locator('input[name="title"]').fill(`QA double ${tag}`);
  await form.locator('button[type="submit"]').dblclick();
  await page.waitForTimeout(2_500);
  const [twice] = await sql<{ n: number }>(`select count(*)::int as n from work.task where title = $1`, [
    `QA double ${tag}`,
  ]);
  check(
    'a double click on quick add adds one task',
    { screen: '/tasks · quick add', user: 'member', detail: `${twice!.n} task(s)` },
    twice!.n === 1,
  );

  // 3. a colleague in the same team opens the member's task: reads it, cannot move its status
  const [task] = await sql<{ id: string; number: string; version: number }>(
    `select id::text, number, version from work.task where title = $1 limit 1`,
    [`QA double ${tag}`],
  );
  await page.context().clearCookies();
  await signIn(page, 'member2', `/tasks/${task!.number}`);
  await hydrated(page);
  const heading = await page
    .getByRole('heading', { level: 1, name: `QA double ${tag}` })
    .isVisible()
    .catch(() => false);
  const statusButton = page.locator('button[data-task-status]');
  const canMove = (await statusButton.count()) > 0 && (await statusButton.first().isEnabled());
  const done = await page.locator('[data-mark-done]').count();
  check(
    "a colleague reads a teammate's task but is offered no status change or Done",
    {
      screen: '/tasks/:number',
      user: 'member2',
      detail: `heading ${heading}, status button enabled ${canMove}, Done ${done}`,
    },
    heading && !canMove && done === 0,
  );
  const colleagueApi = await apiAs('member2');
  const moved = await colleagueApi('task_status_set', { p_id: task!.id, p_status: 'in_progress' });
  check(
    "and the database refuses the colleague's status change",
    { screen: 'api.task_status_set', user: 'member2', detail: said(moved) },
    !moved.ok,
  );

  // 4. a viewer is offered no Add task, and the database refuses one
  await page.context().clearCookies();
  await signIn(page, 'viewer', '/tasks');
  await hydrated(page);
  const add = await page.locator('[data-add-task]').count();
  const viewerApi = await apiAs('viewer');
  const created = await viewerApi('task_create', { p_values: { title: `QA viewer ${tag}`, work_type: 'internal' } });
  check(
    'a viewer is offered no Add task, and the database refuses one',
    { screen: '/tasks', user: 'viewer', detail: `Add task ${add}; api ${said(created)}` },
    add === 0 && !created.ok,
  );

  // 5. a status moved to a day still to come is refused
  const memberApi = await apiAs('member');
  const [future] = await sql<{ d: string }>(`select (core.riyadh_today() + 3)::text as d`);
  const ahead = await memberApi('task_status_set', {
    p_id: task!.id,
    p_status: 'in_progress',
    p_happened_on: future!.d,
  });
  check(
    'a status move dated in the future is refused',
    { screen: 'api.task_status_set', user: 'member', detail: said(ahead) },
    !ahead.ok,
  );

  // 6. a task number that does not exist is the Not found page
  await page.context().clearCookies();
  await signIn(page, 'member', '/tasks/TSK-2099-9999');
  await hydrated(page);
  const text = (
    (await page
      .getByRole('main')
      .innerText()
      .catch(() => '')) ?? ''
  ).replace(/\s+/g, ' ');
  check(
    'an unknown task number says so, in words',
    { screen: '/tasks/TSK-2099-9999', user: 'member', detail: text.slice(0, 120) },
    /not found|could not be found|nothing at|no task|does not exist/i.test(text) && !RAW_KEY.test(text),
  );
  expect(true).toBe(true);
});
