/**
 * The owner's feedback on the Tasks pass (11 Oct, V630): completing is deliberate. Tapping a task's row opens the task;
 * only the separate, marked check control completes it, and then an Undo is on screen for a few seconds. On a phone the
 * Clients card opens its record the same way. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "task-row-tap-opens-nothing", "task-check-hides-its-mark",
 * "task-check-sits-under-the-row-link", "client-card-tap-opens-nothing".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function memberWithTask(): Promise<{ member: TestPerson; number: string; title: string }> {
  const member = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_taps', 'Test taps team', 'فريق النقر', $1)
     on conflict (department_id, code) do nothing`,
    [member.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_taps') where id = $1`,
    [member.id],
  );
  const number = `TSK-1996-${Math.floor(Math.random() * 90000) + 10000}`;
  const title = `Made-up deliberate tap task ${member.id.slice(0, 4)}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, (select team_id from core.person where id = $3),
             (select department_id from core.person where id = $3),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [number, title, member.id],
  );
  return { member, number, title };
}

/** A thumb on the middle of a line of text: whatever is drawn on top there gets the tap, as on a phone. */
async function tap(page: Page, target: ReturnType<Page['locator']>) {
  // the thumb scrolls to the line first: a list with more cards above it must not leave the tap below the screen
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

const meaning = async (number: string) =>
  (
    await sql<{ m: string }>(
      `select s.meaning as m from work.task t join work.task_status s on s.id = t.status_id where t.number = $1`,
      [number],
    )
  )[0]!.m;

for (const [name, width, height] of [
  ['phone', 375, 812],
  ['desk', 1440, 900],
] as const) {
  test(`${name}: a tap on a task's row opens the task and completes nothing; the check completes it, with an Undo (V630)`, async ({
    page,
  }) => {
    const { member, number, title } = await memberWithTask();
    await page.setViewportSize({ width, height });
    await signIn(page, member.email, '/tasks');
    await hydrated(page);
    const row = page.locator('li[data-task-row]', { hasText: title });
    await expect(row).toBeVisible();

    // the check is a marked control: its check glyph is drawn, not hidden until a hover
    const glyph = row.locator('[data-done-tick] svg');
    expect(
      await glyph.evaluate((el) => getComputedStyle(el).color),
      'the check control shows its mark before any touch',
    ).not.toBe('rgba(0, 0, 0, 0)');

    // a tap on the row's grey line opens the task
    await tap(page, row.locator('p').first());
    await expect(page, 'a tap on the row opens the task').toHaveURL(new RegExp(`/tasks/${number}$`));
    expect(await meaning(number), 'and completes nothing').not.toBe('done');

    // the check completes it without leaving the list, and an Undo follows
    await page.goto('/tasks');
    await hydrated(page);
    await page.locator('li[data-task-row]', { hasText: title }).locator('[data-done-tick]').click();
    await expect.poll(() => meaning(number), { message: 'the check marks it done' }).toBe('done');
    await expect(page, 'the check does not open the task').toHaveURL(/\/tasks$/);
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo, 'an Undo is on screen after completing').toBeVisible();
    await undo.click();
    await expect.poll(() => meaning(number), { message: 'Undo brings it back' }).not.toBe('done');
  });
}

test('phone 375: a tap on a Clients card opens its record', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, admin.email, '/clients');
  await hydrated(page);
  const created = await callAs(page.context(), 'partner_create', {
    p_partner: {
      trade_name_en: `Test Org Card Tap ${Math.random().toString(36).slice(2, 6)}`,
      sides: [{ side: 'client', type: 'corporate' }],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const id = (created.body as { id: string }).id;
  await page.goto('/clients');
  await hydrated(page);
  await tap(page, page.locator(`[data-partner-card="${id}"] .text-sm`).first());
  await expect(page, 'a tap on the card opens the record').toHaveURL(new RegExp(`/clients/${id}$`));
});
