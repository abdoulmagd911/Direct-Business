import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { shot } from './helpers';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

// The Tasks screens, P5-2's first PR (builder D; GC-3, V509's phone test): quick add → the list → the record → Done;
// Blocked needs its reason; a member sees only their department's work (V96); the page never scrolls sideways. At
// 390 px (the phone first) and 1,440 px. Everything here is made up (rule 7): "Test Person …", "Made-up task …".
// Sabotages: tests/sabotage/tasks.mjs.

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

/**
 * The one made-up team these specs use in a department (made once, then reused), so repeated runs never crowd another
 * spec's team pickers with "Test team" rows.
 */
async function testTeam(department: string, createdBy: string): Promise<string> {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ($1, 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
    [department],
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = $1), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $2)
     on conflict (department_id, code) do nothing`,
    [department, createdBy],
  );
  const [team] = await sql<{ id: string }>(
    `select t.id from core.team t join core.department d on d.id = t.department_id
     where d.code = $1 and t.code = 'test_tasks'`,
    [department],
  );
  return team!.id;
}

/** A made-up member with a home team in the Commercial department (a task's team is its owner's, V194). */
async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  const team = await testTeam('commercial', person.id);
  await sql(`update core.person set team_id = $1 where id = $2`, [team, person.id]);
  return person;
}

/** A task put straight into the database (a fixture), owned by `owner` in `department`'s test team. */
async function taskIn(department: string, owner: string, title: string): Promise<string> {
  const team = await testTeam(department, owner);
  const number = `TSK-1999-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, $4, (select department_id from core.team where id = $4),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [number, title, owner, team],
  );
  return number;
}

async function signedIn(browser: Browser, person: TestPerson, width: number, height: number, path = '/tasks') {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await signIn(page, person.email, path);
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
  return { ctx, page };
}

async function noSidewaysScroll(page: Page, where: string) {
  const over = await page.evaluate(() => {
    const els = [document.scrollingElement, document.querySelector('[data-page]')].filter(Boolean) as Element[];
    return els.map((e) => e.scrollWidth - e.clientWidth);
  });
  for (const o of over) expect(o, `${where}: no sideways scroll`).toBeLessThanOrEqual(1);
}

/** Riyadh's calendar day, as the date field takes it. */
const riyadhToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

for (const w of WIDTHS) {
  test(`${w.name}: quick add, the list, the record, an action item and Done`, async ({ browser }) => {
    const member = await memberWithTeam();
    const { ctx, page } = await signedIn(browser, member, w.width, w.height);
    const title = `Made-up task ${randomUUID().slice(0, 6)}`;

    await page.locator('[data-add-task]').click();
    const form = page.locator('form[data-quick-add]');
    await form.locator('input[name="title"]').fill(title);
    await form.locator('input[name="due"]').fill(riyadhToday());
    await page.screenshot({ path: shot(`tasks-quick-add-${w.name}`) });
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(`Task added: ${title}`)).toBeVisible();

    // the list: in My work, due today, nothing sideways
    const row = page.locator('li[data-task-row]', { hasText: title });
    await expect(row, 'the new task is in My work').toBeVisible();
    await expect(row).toHaveAttribute('data-due', 'today');
    await expect(row).toContainText('Due today');
    await noSidewaysScroll(page, `${w.name} list`);
    await page.screenshot({ path: shot(`tasks-list-${w.name}`), fullPage: true });

    // the record
    await row.getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'not_started');
    await noSidewaysScroll(page, `${w.name} record`);

    // an action item on its checklist
    await page.getByRole('link', { name: /Action items/ }).click();
    await page.locator('form[data-add-item] input[name="item"]').fill('Made-up item');
    await page.locator('form[data-add-item] button[type="submit"]').click();
    await expect(page.locator('[data-checklist] li[data-item="Made-up item"]')).toBeVisible();
    await expect(page.locator('[data-open-items]')).toHaveAttribute('data-open-items', '1');
    await page.screenshot({ path: shot(`tasks-record-items-${w.name}`), fullPage: true });

    // Done asks about the open item, then closes it in the same request
    await page.locator('[data-mark-done]').click();
    await expect(page.getByRole('alertdialog')).toContainText('1 action item is still open');
    await page.getByRole('button', { name: 'Close them and finish' }).click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'done');
    await expect(page.locator('[data-open-items]')).toHaveAttribute('data-open-items', '0');
    await ctx.close();
  });

  test(`${w.name}: Blocked needs its reason, and the record says it`, async ({ browser }) => {
    const member = await memberWithTeam();
    const title = `Made-up blocked ${randomUUID().slice(0, 6)}`;
    const { ctx, page } = await signedIn(browser, member, w.width, w.height);
    await page.locator('[data-add-task]').click();
    await page.locator('form[data-quick-add] input[name="title"]').fill(title);
    await page.locator('form[data-quick-add] button[type="submit"]').click();
    await page.locator('li[data-task-row]', { hasText: title }).getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    await page.locator('button[data-task-status]').click();
    await page.locator('[data-move="blocked"]').click();
    const save = page.locator('[data-reason-save]');
    await expect(save, 'Blocked cannot be saved without its reason').toBeDisabled();
    await page.locator('[data-reason]').fill('   ');
    await expect(save, 'spaces are not a reason').toBeDisabled();
    await page.locator('[data-reason]').fill('Waiting for the made-up supplier');
    await save.click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'blocked');
    await expect(page.locator('[data-blocked-reason]')).toContainText('Waiting for the made-up supplier');
    await page.screenshot({ path: shot(`tasks-record-blocked-${w.name}`), fullPage: true });

    // resuming is choosing In progress
    await page.locator('button[data-task-status]').click();
    await page.locator('[data-move="in_progress"]').click();
    await expect(page.locator('[data-task-status]').first()).toHaveAttribute('data-task-status', 'in_progress');
    await expect(page.locator('[data-blocked-reason]')).toHaveCount(0);
    await ctx.close();
  });

  test(`${w.name}: an admin in no team must pick an owner (V277)`, async ({ browser }) => {
    const admin = await makePerson({ admin: true }); // in no team, as the owner's admin account is (V444)
    const owner = await memberWithTeam();
    const ownerName = `Aa Quick owner ${randomUUID().slice(0, 6)}`;
    await sql(`update core.person set full_name_en = $1 where id = $2`, [ownerName, owner.id]);
    const title = `Made-up no-team task ${randomUUID().slice(0, 6)}`;
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height);

    await page.locator('[data-add-task]').click();
    const form = page.locator('form[data-quick-add]');
    const pickOwner = form.getByRole('combobox', { name: 'Owner' });
    await expect(pickOwner, 'no Default: the Owner starts empty').toContainText('Pick an owner');
    await form.locator('input[name="title"]').fill(title);
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert'), 'saving with no owner says what to do').toHaveText('Pick an owner');

    await pickOwner.click();
    await expect(page.getByRole('option', { name: 'Default' }), 'Default is not offered').toHaveCount(0);
    await page.getByRole('option', { name: ownerName, exact: true }).click();
    await expect(form.getByRole('alert')).toHaveCount(0);
    await noSidewaysScroll(page, `${w.name} quick add, no team`);
    await page.screenshot({ path: shot(`tasks-quick-add-no-team-${w.name}`) });
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(`Task added: ${title}`)).toBeVisible();
    const [task] = await sql<{ owner_id: string }>(`select owner_id from work.task where title = $1`, [title]);
    expect(task?.owner_id, 'the task is the picked owner’s').toBe(owner.id);
    await ctx.close();
  });
}

test('phone: see what is due today and tick one off (V509)', async ({ browser }) => {
  const member = await memberWithTeam();
  const title = `Made-up due today ${randomUUID().slice(0, 6)}`;
  const { ctx, page } = await signedIn(browser, member, 390, 844, '/tasks?due=today');
  await page.locator('[data-add-task]').click();
  await page.locator('form[data-quick-add] input[name="title"]').fill(title);
  await page.locator('form[data-quick-add] input[name="due"]').fill(riyadhToday());
  await page.locator('form[data-quick-add] button[type="submit"]').click();
  const row = page.locator('li[data-task-row]', { hasText: title });
  await expect(row, 'due today shows under the Today chip').toBeVisible();
  await row.locator('[data-done-tick]').click();
  await expect(row.getByText('Done', { exact: true })).toBeVisible();
  await noSidewaysScroll(page, 'phone, ticked');
  await ctx.close();
});

test('a member sees their department’s work, never another’s (V96)', async ({ browser }) => {
  const member = await memberWithTeam();
  const colleague = await memberWithTeam();
  const outsider = await makePerson();
  const ours = await taskIn('commercial', colleague.id, `Made-up colleague task ${randomUUID().slice(0, 6)}`);
  const theirs = await taskIn(`test_other_${randomUUID().slice(0, 8)}`, outsider.id, 'Made-up other department task');
  await sql(
    `update core.person set department_id = (select department_id from work.task where number = $1) where id = $2`,
    [theirs, outsider.id],
  );
  const { ctx, page } = await signedIn(browser, member, 1440, 900, '/tasks?view=team');
  await expect(page.locator(`li[data-task-row="${ours}"]`), 'the department’s task shows in Team').toBeVisible();
  await expect(page.locator(`li[data-task-row="${theirs}"]`), 'another department’s does not').toHaveCount(0);

  await page.goto('/tasks');
  await expect(page.locator(`li[data-task-row="${ours}"]`), 'a colleague’s task is not My work').toHaveCount(0);

  await page.goto(`/tasks/${theirs}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Made-up other department task' })).toHaveCount(0);
  // QA-233: a task one may not see, or none at that number, is the app's own Not found page (#145), never Next's bare 404
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.goto('/tasks/TSK-2099-9999');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.goto(`/tasks/${ours}`);
  await expect(page.locator('[data-mark-done]'), 'a colleague’s task is seen, not changed (Own)').toHaveCount(0);
  await expect(page.locator('span[data-task-status]').first()).toBeVisible();
  await ctx.close();
});

test('desk and phone: the Past work grid pastes 20 made-up rows as one request with one Undo (V276)', async ({
  browser,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    const member = await memberWithTeam();
    const tag = randomUUID().slice(0, 6);
    const { ctx, page } = await signedIn(browser, member, width, height, '/tasks?view=past');
    const calls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/rpc/backfill_tasks')) calls.push(r.method());
    });
    const count = async () =>
      (
        await sql<{ n: number }>(
          `select count(*)::int as n from work.task where title like $1 and deleted_at is null`,
          [`Made-up past ${tag} %`],
        )
      )[0]!.n;
    // 20 made-up rows, dated in Q3 (July and August) with a day past 12 (never read two ways)
    const rows = Array.from({ length: 20 }, (_, i) =>
      [`Made-up past ${tag} ${i + 1}`, `${13 + (i % 10)}/0${7 + Math.floor(i / 10)}/2026`, 'Done'].join('\t'),
    );
    const pasteAndSave = async () => {
      const grid = page.locator('[data-past-work-grid="tasks"]');
      await expect(grid).toBeVisible();
      // the report the rows come from (V506): the Commercial quarterly for Q3 2026 (its list is short enough to show
      // whole on a phone); the trigger must say so — a test that picks some other report proves nothing
      await grid.getByLabel('Source report').click();
      await page.getByRole('option', { name: 'Commercial quarterly' }).click();
      await grid.getByLabel('Which report').click();
      await page.getByRole('option', { name: 'Q3 2026' }).click();
      await expect(grid.getByLabel('Which report')).toContainText('Q3 2026');
      await grid.locator('[data-past-work-paste]').fill(['Title\tDate\tStatus', ...rows].join('\n'));
      await expect(grid.locator('[data-past-work-summary]')).toContainText('20 rows ready · 0 refused');
      await noSidewaysScroll(page, `${width} px past work`);
      await page.screenshot({ path: shot(`tasks-past-work-${width}`), fullPage: true });
      await grid.locator('[data-past-work-save]').click();
    };

    await pasteAndSave();
    const done = page.locator('[data-sonner-toast]', { hasText: '20 rows saved as past work' });
    await expect(done).toBeVisible();
    expect(calls, 'one paste is one request').toHaveLength(1);
    expect(await count(), 'all twenty saved').toBe(20);

    // one Undo takes the whole paste back
    await done.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(count, { message: 'one Undo removes all twenty' }).toBe(0);

    // pasted again, they are past work: in the Past work view, never in My work (V491)
    await page.goto('/tasks?view=past');
    await pasteAndSave();
    await expect.poll(count).toBe(20);
    await page.goto('/tasks?view=past');
    await expect(page.locator('li[data-task-row]', { hasText: `Made-up past ${tag}` })).toHaveCount(20);
    await page.goto('/tasks');
    await expect(page.locator('li[data-task-row]', { hasText: `Made-up past ${tag}` })).toHaveCount(0);
    await ctx.close();
  }
});

for (const w of WIDTHS) {
  test(`${w.name}: an admin in no team pastes rows with no Owner column, picks one owner and saves (V605)`, async ({
    browser,
  }) => {
    const admin = await makePerson({ admin: true }); // in no team, as the owner's admin account is (V444)
    const owner = await memberWithTeam();
    const tag = randomUUID().slice(0, 6);
    const ownerName = `Aa Past owner ${tag}`;
    await sql(`update core.person set full_name_en = $1 where id = $2`, [ownerName, owner.id]);
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height, '/tasks?view=past');
    const grid = page.locator('[data-past-work-grid="tasks"]');
    await expect(grid).toBeVisible();
    await grid.getByLabel('Source report').click();
    await page.getByRole('option', { name: 'Commercial quarterly' }).click();
    await grid.getByLabel('Which report').click();
    await page.getByRole('option', { name: 'Q3 2026' }).click();
    const rows = [1, 2, 3].map((i) => [`Made-up no-team past ${tag} ${i}`, `1${i}/07/2026`, 'Done'].join('\t'));
    await grid.locator('[data-past-work-paste]').fill(['Title\tDate\tStatus', ...rows].join('\n'));

    // no owner yet: the line says what to do, every row waits, and Save is off
    const picker = page.locator('[data-past-owner]');
    await expect(picker, 'the panel says how to give the rows an owner').toContainText(
      'Add an Owner column, or pick an owner for these rows',
    );
    await expect(grid.locator('[data-past-work-summary]')).toContainText('0 rows ready · 3 refused');
    await expect(grid.getByText('Pick an owner').first()).toBeVisible();
    await expect(grid.locator('[data-past-work-save]'), 'no Save without an owner').toBeDisabled();

    await picker.getByRole('combobox', { name: 'Owner for these rows' }).click();
    await page.getByRole('option', { name: ownerName, exact: true }).click();
    await expect(grid.locator('[data-past-work-summary]')).toContainText('3 rows ready · 0 refused');
    await noSidewaysScroll(page, `${w.name} past work, no team`);
    await page.screenshot({ path: shot(`tasks-past-work-no-team-${w.name}`), fullPage: true });
    await grid.locator('[data-past-work-save]').click();
    await expect(page.locator('[data-sonner-toast]', { hasText: '3 rows saved as past work' })).toBeVisible();
    const saved = await sql<{ owner_id: string }>(`select owner_id from work.task where title like $1`, [
      `Made-up no-team past ${tag} %`,
    ]);
    expect(
      saved.map((r) => r.owner_id),
      'every row is the picked owner’s',
    ).toEqual([owner.id, owner.id, owner.id]);
    await ctx.close();
  });
}

// ---- P5-2's second PR: Escalate on the task page (V401) and the team's load on Tasks › Team (V91)
for (const w of WIDTHS) {
  test(`${w.name}: Escalate tells a colleague about a task, with a note (V401)`, async ({ browser }) => {
    const member = await memberWithTeam();
    const colleague = await memberWithTeam();
    const tag = randomUUID().slice(0, 6);
    const colleagueName = `Ab Escalate to ${tag}`;
    await sql(`update core.person set full_name_en = $1 where id = $2`, [colleagueName, colleague.id]);
    const number = await taskIn('commercial', member.id, `Made-up escalated ${tag}`);
    const { ctx, page } = await signedIn(browser, member, w.width, w.height, `/tasks/${number}`);

    await page.locator('[data-escalate-open]').click();
    const form = page.locator('form[data-escalate]');
    await expect(form).toBeVisible();
    // a person and a note are both required
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert')).toHaveText('Pick who to tell');
    await form.getByRole('combobox', { name: 'Escalate to' }).click();
    await page.getByRole('option', { name: colleagueName, exact: true }).click();
    await form.locator('button[type="submit"]').click();
    await expect(form.getByRole('alert')).toHaveText('Write what they need to know');
    await form.locator('textarea[name="note"]').fill('Made-up: the client has not answered for a week');
    await noSidewaysScroll(page, `${w.name} escalate`);
    await page.screenshot({ path: shot(`tasks-escalate-${w.name}`), fullPage: true });
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('[data-sonner-toast]', { hasText: `Escalated to ${colleagueName}` })).toBeVisible();

    // the colleague is told, follows the task, and the note is on its timeline
    const [told] = await sql<{ n: number }>(
      `select count(*)::int as n from notify.notification n join work.task t on t.id = n.entity_id
       where n.person_id = $1 and n.kind = 'escalated' and t.number = $2`,
      [colleague.id, number],
    );
    expect(told!.n, 'the colleague is told').toBe(1);
    const [follows] = await sql<{ n: number }>(
      `select count(*)::int as n from notify.follow f join work.task t on t.id = f.entity_id
       where f.person_id = $1 and t.number = $2`,
      [colleague.id, number],
    );
    expect(follows!.n, 'the colleague follows the task').toBe(1);
    const [note] = await sql<{ body: string }>(
      `select c.body from core.note c join work.task t on t.id = c.entity_id where c.kind = 'escalation' and t.number = $1`,
      [number],
    );
    expect(note?.body).toBe('Made-up: the client has not answered for a week');
    await ctx.close();
  });

  test(`${w.name}: a manager's Team view shows the team's load; a member's does not (V91)`, async ({ browser }) => {
    const admin = await makePerson({ admin: true }); // gives work to others (tasks.assign)
    const busy = await memberWithTeam();
    const tag = randomUUID().slice(0, 6);
    const busyName = `Test Load ${tag}`;
    await sql(`update core.person set full_name_en = $1 where id = $2`, [busyName, busy.id]);
    for (const i of [1, 2, 3]) {
      const n = await taskIn('commercial', busy.id, `Made-up load ${tag} ${i}`);
      if (i < 3) await sql(`update work.task set due_on = current_date - 3 where number = $1`, [n]);
    }
    const { ctx, page } = await signedIn(browser, admin, w.width, w.height, '/tasks?view=team');
    const card = page.locator(`[data-team-load] [data-load-person="${busyName}"]`);
    await expect(card, 'the team’s load names the busy colleague').toBeVisible();
    await expect(card.locator('[data-load-open]')).toHaveText('3 open tasks');
    await expect(card.locator('[data-load-overdue]')).toHaveText('2 overdue');
    await noSidewaysScroll(page, `${w.name} team load`);
    await page.screenshot({ path: shot(`tasks-team-load-${w.name}`), fullPage: true });
    await ctx.close();

    const member = await signedIn(browser, busy, w.width, w.height, '/tasks?view=team');
    await expect(member.page.locator('[data-task-rows], [data-tasks-list]').first()).toBeVisible();
    await expect(member.page.locator('[data-team-load]'), 'a member is shown no load').toHaveCount(0);
    await member.ctx.close();
  });
}

// ---- List / Board / Calendar (§8 Tasks): one view of the same rows
for (const w of WIDTHS) {
  test(`${w.name}: the board and the calendar count the same tasks as the list`, async ({ browser }) => {
    const member = await memberWithTeam();
    const tag = randomUUID().slice(0, 6);
    const dueToday = await taskIn('commercial', member.id, `Made-up board today ${tag}`);
    const started = await taskIn('commercial', member.id, `Made-up board started ${tag}`);
    await taskIn('commercial', member.id, `Made-up board undated ${tag}`);
    await sql(`update work.task set due_on = $1 where number = $2`, [riyadhToday(), dueToday]);
    const { ctx, page } = await signedIn(browser, member, w.width, w.height, '/tasks?view=owned');
    const listed = await page.locator('li[data-task-row]').count();
    expect(listed, 'the list shows the three made-up tasks').toBe(3);

    // the board: every listed task in exactly one column; a card's status menu moves it
    await page.locator('[data-layouts] [data-layout="board"]').click();
    await expect(page).toHaveURL(/layout=board/);
    const board = page.locator('[data-task-board]');
    await expect(board).toBeVisible();
    const counts = await board
      .locator('[data-board-column]')
      .evaluateAll((cols) => cols.map((c) => Number(c.getAttribute('data-count'))));
    expect(
      counts.reduce((a, b) => a + b, 0),
      'the board counts what the list counts',
    ).toBe(listed);
    await board.locator(`[data-board-card="${started}"] button[data-task-status]`).click();
    await page.locator('[data-move="in_progress"]').click();
    await expect(
      board.locator(`[data-board-column="in_progress"] [data-board-card="${started}"]`),
      'the card moves to In progress',
    ).toBeVisible();
    await noSidewaysScroll(page, `${w.name} board`);
    await page.screenshot({ path: shot(`tasks-board-${w.name}`), fullPage: true });

    // the calendar: the dated task on its day, the undated one apart
    await page.locator('[data-layouts] [data-layout="calendar"]').click();
    await expect(page).toHaveURL(/layout=calendar/);
    await expect(
      page.locator(`[data-calendar-day="${riyadhToday()}"] [data-calendar-task="${dueToday}"]`),
      'the task due today is on today',
    ).toBeVisible();
    await expect(page.locator('[data-calendar-undated]')).toContainText('2 tasks with no due day');
    await noSidewaysScroll(page, `${w.name} calendar`);
    await page.screenshot({ path: shot(`tasks-calendar-${w.name}`), fullPage: true });
    // the month after holds none of them, and Back to the list keeps the view
    await page.locator('[data-calendar-next]').click();
    await expect(page.locator(`[data-calendar-task="${dueToday}"]`)).toHaveCount(0);
    await page.locator('[data-layouts] [data-layout="list"]').click();
    await expect(page).toHaveURL(/view=owned$/);
    await expect(page.locator('li[data-task-row]')).toHaveCount(listed);
    await ctx.close();
  });
}
