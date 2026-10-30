/**
 * V657 (Stage L, L-5): comments on a task, at 375 and 1,440 px. The Comments tab sits beside Overview and Activity and
 * says how many there are; the box at the bottom adds one (it shows at once, newest last, with its author and a 24-hour
 * time, and the toast offers Undo); the author edits their own comment (it shows as edited) and deletes it after the
 * app's own question that names whose comment it is, and Undo brings it back; a colleague who only sees the task reads
 * the comment and sees no box, only a line saying who can write. No sideways scroll. Every value is made up.
 * Sabotage: tests/sabotage/task-comments.mjs "comment-box-shows-to-a-reader", "comment-delete-asks-nothing",
 * "comments-tab-shows-nothing".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function withTeam(person: TestPerson, team: string) {
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), $2, 'Test comments team', 'فريق التعليقات', $1)
     on conflict (department_id, code) do nothing`,
    [person.id, team],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = $2) where id = $1`,
    [person.id, team],
  );
}

/** A made-up internal task owned by `owner`, returning its number. */
async function taskOf(owner: TestPerson): Promise<string> {
  const number = `TSK-1996-${Math.floor(Math.random() * 90000) + 10000}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, (select team_id from core.person where id = $3),
             (select department_id from core.person where id = $3),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [number, `Made-up comments task ${owner.id.slice(0, 4)}`, owner.id],
  );
  return number;
}

for (const [label, width, height] of [
  ['phone 375', 375, 800],
  ['desk 1440', 1440, 900],
] as const) {
  test(`${label}: a task's comments are written, edited, deleted with Undo, and read by a colleague who cannot write`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const writer = await makePerson({ admin: true });
    const reader = await makePerson();
    await withTeam(writer, 'test_cmt_e2e');
    await withTeam(reader, 'test_cmt_e2e');
    const number = await taskOf(writer);
    await page.setViewportSize({ width, height });
    await signIn(page, writer.email, `/tasks/${number}`);
    await hydrated(page);

    // the tab, beside Overview and Activity, and the empty line
    const tabs = page.locator('[data-record-header] [data-tabs]');
    await expect(tabs).toContainText('Comments');
    await page.goto(`/tasks/${number}?tab=comments`);
    await hydrated(page);
    await expect(page.getByText('No comments yet')).toBeVisible();

    // write: it shows at once with its author and a 24-hour time; the tab counts it
    const box = page.locator('[data-add-comment] textarea');
    await box.fill('Made-up first remark\nsecond line');
    await page.getByRole('button', { name: 'Add comment' }).click();
    const first = page.locator('[data-comment]').first();
    await expect(first.locator('[data-comment-body]')).toHaveText('Made-up first remark\nsecond line');
    await expect(first.locator('[data-comment-author]')).toHaveText(writer.name);
    await expect(first.locator('[data-comment-time]')).toHaveText(/\d{1,2} \w{3} \d{4}.*\d{2}:\d{2}/);
    await expect(tabs).toContainText('Comments');
    await expect(page.getByText('Comment added')).toBeVisible();
    await expect(box, 'the box is emptied').toHaveValue('');

    // a blank comment is refused in words
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.getByText('Write something first')).toBeVisible();

    // edit: it shows as edited
    await first.locator('[data-comment-edit]').click();
    await first.locator('textarea').fill('Made-up first remark, corrected');
    await first.locator('[data-comment-save]').click();
    await expect(first.locator('[data-comment-body]')).toHaveText('Made-up first remark, corrected');
    await expect(first.locator('[data-comment-edited]')).toHaveText('edited');

    // a colleague who only sees the task reads it and has no box
    const ctx = await browser.newContext({ viewport: { width, height } });
    const other = await ctx.newPage();
    await signIn(other, reader.email, `/tasks/${number}?tab=comments`);
    await hydrated(other);
    await expect(other.locator('[data-comment-body]')).toHaveText('Made-up first remark, corrected');
    await expect(other.locator('[data-add-comment]'), 'a reader has no box').toHaveCount(0);
    await expect(other.locator('[data-comments-read-only]')).toBeVisible();
    await expect(other.locator('[data-comment-edit], [data-comment-remove]'), 'and no edit or delete').toHaveCount(0);
    await ctx.close();

    // delete: the app's own question names whose comment it is; Undo brings it back
    await first.locator('[data-comment-remove]').click();
    const ask = page.getByRole('alertdialog');
    await expect(ask).toContainText(writer.name);
    await ask.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-comment]')).toHaveCount(0);
    await expect(page.getByText('Comment deleted')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).last().click();
    await expect(page.locator('[data-comment]')).toHaveCount(1);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  });
}

for (const [label, width, height] of [
  ['phone 375', 375, 800],
  ['desk 1440', 1440, 900],
] as const) {
  test(`${label}: a member's comment shows at once with its count, and Undo undoes an add, an edit and a delete`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const member = await makePerson();
    await withTeam(member, 'test_cmt_undo');
    const number = await taskOf(member);
    await page.setViewportSize({ width, height });
    await signIn(page, member.email, `/tasks/${number}?tab=comments`);
    await hydrated(page);
    const tabs = page.locator('[data-record-header] [data-tabs]');
    // the newest message is the one in front
    const undo = () =>
      page.locator('[data-sonner-toast][data-front="true"]').getByRole('button', { name: 'Undo' }).click();
    // the server's re-read of the page is slow (a second and a half), as it is on a phone in the field
    await page.route('**/tasks/**', async (route) => {
      if (route.request().headers()['rsc']) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    // and so is the screen's own read of the list after a write
    await page.route('**/rpc/task_comments', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    // add: it is on the screen, and the tab counts it, at once — the screen does not wait for the server's re-read
    await page.locator('[data-add-comment] textarea').fill('Made-up member remark');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.locator('[data-comment-body]'), 'the comment shows at once').toHaveText('Made-up member remark', {
      timeout: 700,
    });
    await expect(tabs.getByText('1'), 'and the tab counts it at once').toBeVisible({ timeout: 700 });
    await expect(page.getByText('No comments yet')).toHaveCount(0);

    // Undo of the add takes it away again
    await undo();
    await expect(page.locator('[data-comment]')).toHaveCount(0);
    await expect(page.getByText('No comments yet')).toBeVisible();

    // add again, edit, Undo of the edit puts the words back
    await page.locator('[data-add-comment] textarea').fill('Made-up second remark');
    await page.getByRole('button', { name: 'Add comment' }).click();
    const first = page.locator('[data-comment]').first();
    await expect(first.locator('[data-comment-body]')).toHaveText('Made-up second remark');
    await first.locator('[data-comment-edit]').click();
    await first.locator('textarea').fill('Made-up second remark, corrected');
    await first.locator('[data-comment-save]').click();
    await expect(first.locator('[data-comment-body]')).toHaveText('Made-up second remark, corrected');
    await undo();
    await expect(first.locator('[data-comment-body]')).toHaveText('Made-up second remark');

    // delete (the app's own question first), then Undo brings it back and it stays after a reload
    await first.locator('[data-comment-remove]').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-comment]')).toHaveCount(0);
    await undo();
    await expect(page.locator('[data-comment]')).toHaveCount(1);
    await page.reload();
    await hydrated(page);
    await expect(page.locator('[data-comment-body]')).toHaveText('Made-up second remark');
  });
}

test('an Undo that takes a moment says so at once, then says Undone, and the comment is back', async ({ page }) => {
  test.setTimeout(120_000);
  const member = await makePerson();
  await withTeam(member, 'test_cmt_slow_undo');
  const number = await taskOf(member);
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, `/tasks/${number}?tab=comments`);
  await hydrated(page);
  await page.locator('[data-add-comment] textarea').fill('Made-up slow remark');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.locator('[data-comment]')).toHaveCount(1);
  await page.locator('[data-comment-remove]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('[data-comment]')).toHaveCount(0);
  // the Undo reaches the database slowly (three seconds)
  await page.route('**/rpc/undo', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.locator('[data-sonner-toast][data-front="true"]').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undoing…'), 'a message at once, while the Undo works').toBeVisible({ timeout: 800 });
  await expect(page.getByText('Undone', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-comment]')).toHaveCount(1);
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-comment-body]')).toHaveText('Made-up slow remark');
});

for (const waitMs of [0, 1000, 3000]) {
  test(`a slow server (2 s): Undo ${waitMs / 1000} s after the delete message puts the comment back on the screen and in the database`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const member = await makePerson();
    await withTeam(member, `test_cmt_slow_${waitMs}`);
    const number = await taskOf(member);
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, member.email, `/tasks/${number}?tab=comments`);
    await hydrated(page);
    await page.route('**/tasks/**', async (route) => {
      if (route.request().headers()['rsc']) await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.locator('[data-add-comment] textarea').fill('Made-up slow-server remark');
    await page.getByRole('button', { name: 'Add comment' }).click();
    await expect(page.locator('[data-comment]')).toHaveCount(1);
    await page.waitForTimeout(3000); // the page's own re-read has landed
    await page.locator('[data-comment-remove]').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-comment]')).toHaveCount(0);
    await page.waitForTimeout(waitMs);
    await page.locator('[data-sonner-toast][data-front="true"]').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible({ timeout: 10_000 });
    // once the re-reads have all landed, the screen still shows it
    await page.waitForTimeout(6000);
    await expect(page.locator('[data-comment]'), 'the comment is back on the screen').toHaveCount(1);
    await page.reload();
    await hydrated(page);
    await expect(page.locator('[data-comment-body]'), 'and in the database').toHaveText('Made-up slow-server remark');
  });
}

test('after Undo the list shows the comment even when the page re-read is very late (the screen reads it again itself)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const member = await makePerson();
  await withTeam(member, 'test_cmt_noreread');
  const number = await taskOf(member);
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, `/tasks/${number}?tab=comments`);
  await hydrated(page);
  await page.locator('[data-add-comment] textarea').fill('Made-up no-re-read remark');
  await page.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.locator('[data-comment]')).toHaveCount(1);
  await page.waitForTimeout(2500);
  await page.locator('[data-comment-remove]').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('[data-comment]')).toHaveCount(0);
  await page.waitForTimeout(2500); // the page's own re-read of the deleted state has landed
  let cut = true;
  await page.route('**/tasks/**', async (route) => {
    // the page's own re-read does not come back for a long time
    if (cut && route.request().headers()['rsc']) await new Promise((r) => setTimeout(r, 20_000));
    await route.continue().catch(() => {});
  });
  await page.locator('[data-sonner-toast][data-front="true"]').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('Undone', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-comment]'), 'the comment is back on the screen').toHaveCount(1, { timeout: 3000 });
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-comment]'), 'and stays').toHaveCount(1);
  cut = false;
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-comment-body]'), 'and is in the database').toHaveText('Made-up no-re-read remark');
});
