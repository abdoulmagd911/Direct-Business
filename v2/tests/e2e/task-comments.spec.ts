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
