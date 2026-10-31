/**
 * The new-task form's Due (the Architect's ruling of 16 Oct, V286), at 375 px and 1,440 px: the When chips' Today,
 * Tomorrow and Next week, the date box and Clear; typing 20261020 into the box gives 20 Oct 2026 (on a PC the year part
 * took the whole number and left junk, then the form said "Pick a date" under Title); Due stays optional. The box reads
 * the typed day itself, so the computer's own date settings no longer decide where the digits land.
 * Every value is made up. Sabotages: tests/sabotage/new-task-due.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const WIDTHS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desk', width: 1440, height: 900 },
] as const;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A day written the way the app writes it: 2026-10-20 -> 20 Oct 2026. */
const written = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m! - 1]} ${y}`;
};

const riyadhToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tasks') where id = $1`,
    [person.id],
  );
  return person;
}

const dueOf = async (person: TestPerson, title: string) =>
  (
    await sql<{ due: string | null }>(
      `select to_char(due_on, 'YYYY-MM-DD') as due from work.task where title = $1 and created_by = $2`,
      [title, person.id],
    )
  )[0]?.due;

for (const w of WIDTHS) {
  test(`${w.name}: Due offers Today, Tomorrow, Next week, a date box and Clear; 20261020 typed is 20 Oct 2026`, async ({
    browser,
  }) => {
    const member = await memberWithTeam();
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, member.email, '/tasks/new');
    await hydrated(page);
    const form = page.locator('form[data-quick-add]');
    const due = form.locator('input[name="due"]');
    await expect(form.locator('[data-due-chip]'), 'Today, Tomorrow and Next week').toHaveCount(3);

    // a chip fills the box, Clear empties it
    await form.locator('[data-due-chip="today"]').click();
    await expect(due, 'Today is the Riyadh day, written the way dates are written').toHaveValue(written(riyadhToday()));
    await expect(form.locator('[data-due-chip="today"]')).toHaveAttribute('aria-checked', 'true');
    await form.locator('[data-due-clear]').click();
    await expect(due, 'Clear empties Due').toHaveValue('');
    await expect(form.locator('[data-due-clear]')).toHaveCount(0);

    // typed, digits only, key by key as a person types
    await due.focus();
    await page.keyboard.type('20261020');
    await expect(form.locator('[data-due-result]'), 'typing 20261020 gives 20 October 2026').toContainText(
      '20 Oct 2026',
    );
    await form.locator('input[name="title"]').focus();
    await expect(due, 'and the box says it back as the day, never 2026-10-20').toHaveValue('20 Oct 2026');

    const title = `Made-up due task ${randomUUID().slice(0, 6)}`;
    await form.locator('input[name="title"]').fill(title);
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(`Task added: ${title}`)).toBeVisible();
    await expect(page.getByText('Pick a date'), 'no Pick a date, under Title or anywhere').toHaveCount(0);
    expect(await dueOf(member, title), 'saved due 20 Oct 2026').toBe('2026-10-20');
    await ctx.close();
  });

  test(`${w.name}: Due stays optional; a half-typed day says Pick a date under Due, never under Title`, async ({
    browser,
  }) => {
    const member = await memberWithTeam();
    const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height } });
    const page = await ctx.newPage();
    await signIn(page, member.email, '/tasks/new');
    await hydrated(page);
    const form = page.locator('form[data-quick-add]');
    const due = form.locator('input[name="due"]');
    const title = `Made-up no-due task ${randomUUID().slice(0, 6)}`;
    await form.locator('input[name="title"]').fill(title);
    await due.focus();
    await page.keyboard.type('2026');
    await form.locator('button[type="submit"]').click();
    await expect(due, 'a half-typed day is marked on Due').toHaveAttribute('aria-invalid', 'true');
    const said = await due.getAttribute('aria-describedby');
    await expect(form.locator(`[id="${said}"]`), 'Pick a date is said under Due').toHaveText('Pick a date');
    await expect(form.locator('input[name="title"]'), 'never under Title').not.toHaveAttribute('aria-invalid', 'true');
    expect(await dueOf(member, title), 'nothing saved yet').toBeUndefined();

    // Due is optional: cleared, the task saves with no due day
    await form.locator('[data-due-clear]').click();
    await expect(due, 'Clear empties a half-typed day too').toHaveValue('');
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText(`Task added: ${title}`), 'an empty Due saves').toBeVisible();
    expect(await dueOf(member, title), 'saved with no due day').toBeNull();
    await ctx.close();
  });
}
