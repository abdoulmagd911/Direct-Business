/**
 * V647 (MD-39 gap 4): a note can be turned into an item on the checklist of a task the person chooses. Turn into offers
 * "Item on a task's checklist"; the person searches the task by number, picks it, saves; the toast says so, the note
 * shows the item it became (linked), the task's checklist holds the item, and the link is kept both ways in the
 * database. A task another department's member cannot see is not found, so it cannot be chosen. Every value is made up.
 * Sabotages: tests/sabotage/checklist-item.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();
const tag = () => `chk${Math.random().toString(36).slice(2, 7)}`;

test('a note turned into an item on a task’s checklist is linked both ways, and a task out of reach cannot be chosen', async ({
  page,
  browser,
}) => {
  const member = await makePerson();
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [member.id, `ck_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'task_create', { p_values: { title: `Made-up ${t} visa pack` } });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const { number } = made.body as { number: string };
  const note = await callAs(page.context(), 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up ${t} ask for the passport scan`, visibility: 'private' },
  });
  expect(note.status, JSON.stringify(note.body)).toBe(200);
  const noteId = (note.body as { id: string }).id;

  await page.goto(`/my-day/notes/${noteId}`);
  await hydrated(page);
  await page.locator('[data-turn-into]').click();
  await page.locator('[data-turn-kind="action_item"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-checklist-item-form]'), 'the checklist item dialog opens').toBeVisible();
  await expect(dialog.locator('[data-checklist-item-save]'), 'Save waits for a task').toBeDisabled();
  await dialog.locator('[data-task-search]').fill(number);
  await dialog.locator('[data-task-hit]').first().click();
  await dialog.locator('[data-checklist-item-save]').click();
  await expect(toast(page, `Added to the checklist of ${number}`)).toBeVisible();

  const chip = page.locator('[data-note-links] [data-turned-into="action_item"]');
  await expect(chip, 'the note says which task item it became').toContainText(number);

  // the link is kept both ways: the note's link row names the item, and the item sits on the task
  const [row] = await sql<{ text: string; task: string }>(
    `select ai.text, tk.number as task
       from my.note_link l
       join work.action_item ai on ai.id = l.entity_id and l.entity_table = 'work.action_item'
       join work.task tk on tk.id = ai.task_id
      where l.note_id = $1`,
    [noteId],
  );
  expect(row?.task, 'the item is on the chosen task').toBe(number);
  expect(row?.text, 'its words are the note’s').toContain('ask for the passport scan');
  await chip.click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${number}$`));
  await page.goto(`/tasks/${number}?tab=items`);
  await hydrated(page);
  await expect(
    page.locator('[data-item*="ask for the passport scan"]'),
    'the task’s checklist holds the item',
  ).toBeVisible();

  // someone in another department cannot find the task, so cannot choose it
  const [dept] = await sql<{ id: string }>(
    `insert into core.department (code, name_en, name_ar) values ('test_far_desk', 'Test Far Desk', 'قسم بعيد')
     on conflict (code) do update set name_en = excluded.name_en returning id`,
  );
  const far = await makePerson();
  await sql(`update core.person set department_id = $2 where id = $1`, [far.id, dept!.id]);
  const other = await browser.newPage();
  await signIn(other, far.email, '/my-day');
  await hydrated(other);
  const theirs = await callAs(other.context(), 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up ${t} their own note`, visibility: 'private' },
  });
  expect(theirs.status, JSON.stringify(theirs.body)).toBe(200);
  await other.goto(`/my-day/notes/${(theirs.body as { id: string }).id}`);
  await hydrated(other);
  await other.locator('[data-turn-into]').click();
  await other.locator('[data-turn-kind="action_item"]').click();
  const theirDialog = other.getByRole('dialog');
  await theirDialog.locator('[data-task-search]').fill(number);
  await expect(theirDialog.locator('[data-task-hit]'), 'a task out of reach is not offered').toHaveCount(0);
  await expect(theirDialog.getByText('No task found')).toBeVisible();
  await other.close();
});

test('the task rows of the picker are 44 px high on a phone and stay compact on a wide screen (V643)', async ({
  page,
}) => {
  const member = await makePerson();
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [member.id, `ck_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'task_create', { p_values: { title: `Made-up ${t} tap size` } });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const { number } = made.body as { number: string };
  const note = await callAs(page.context(), 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up ${t} a note`, visibility: 'private' },
  });
  expect(note.status, JSON.stringify(note.body)).toBe(200);
  const noteId = (note.body as { id: string }).id;
  const rowHeight = async () => {
    await page.goto(`/my-day/notes/${noteId}`);
    await hydrated(page);
    await page.locator('[data-turn-into]').click();
    await page.locator('[data-turn-kind="action_item"]').click();
    await page.getByRole('dialog').locator('[data-task-search]').fill(number);
    const hit = page.getByRole('dialog').locator('[data-task-hit]').first();
    await expect(hit).toBeVisible();
    return hit.evaluate((e) => Math.round(e.getBoundingClientRect().height * 10) / 10);
  };
  expect(await rowHeight(), 'a task row is a 44 px target on a phone').toBeGreaterThanOrEqual(43.5);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await rowHeight(), 'on a wide screen it stays compact').toBeLessThanOrEqual(41);
});

test('in the task picker the task number stays on one line and the title keeps its room, at 375 px', async ({
  page,
}) => {
  const member = await makePerson();
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [member.id, `ck_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'task_create', {
    p_values: { title: `Made-up ${t} visa pack for the group` },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const { number } = made.body as { number: string };
  const note = await callAs(page.context(), 'note_capture', {
    p_kind: 'sticky',
    p_values: { title: `Made-up ${t} a note`, visibility: 'private' },
  });
  expect(note.status, JSON.stringify(note.body)).toBe(200);
  await page.goto(`/my-day/notes/${(note.body as { id: string }).id}`);
  await hydrated(page);
  await page.locator('[data-turn-into]').click();
  await page.locator('[data-turn-kind="action_item"]').click();
  await page.getByRole('dialog').locator('[data-task-search]').fill(number);
  const hit = page.getByRole('dialog').locator('[data-task-hit]').first();
  await expect(hit).toBeVisible();
  const box = (sel: string) => hit.locator(sel).evaluate((e) => e.getBoundingClientRect().toJSON());
  const numberBox = await box('.font-data');
  const titleBox = await box('.truncate');
  expect(numberBox.height, 'the task number is on one line').toBeLessThan(24);
  expect(titleBox.width, 'the title keeps room to be read').toBeGreaterThanOrEqual(200);
});
