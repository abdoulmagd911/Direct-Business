/**
 * W-daily 13 (the supervisor's find after #263): no date shows as 2026-10-19 and no time shows with AM/PM. At 375 px and
 * at 1,440 px: the task form's Due box writes a picked day as `20 Oct 2026` and reads it back typed that way; the When
 * picker's Time is a 24-hour box that reads "930pm" as 21:30, and the page holds no browser time input. Every value is
 * made up. Sabotages: tests/sabotage/one-date-everywhere.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { openCapture } from './support/capture';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const tag = () => Math.random().toString(36).slice(2, 8);
const WIDTHS = [375, 1440] as const;

async function personWithTeam() {
  const me = await makePerson({ admin: true });
  const t = tag();
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `dt_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  return me;
}

for (const width of WIDTHS) {
  test(`a picked Due day is written 20 Oct 2026 and read back typed that way — at ${width} px`, async ({ page }) => {
    const me = await personWithTeam();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/tasks/new');
    await hydrated(page);
    const due = page.locator('form[data-quick-add] input[name="due"]');
    await expect(due, 'the hint is a day written the one way').toHaveAttribute('placeholder', '20 Oct 2026');
    await due.fill('2026-10-20');
    await page.locator('form[data-quick-add] input[name="title"]').focus();
    await expect(due, 'a day typed ISO is written back as 20 Oct 2026').toHaveValue('20 Oct 2026');
    await due.fill('21 Oct 2026');
    await expect(page.locator('[data-due-result]'), 'the written day is read').toContainText('21 Oct 2026');
    await page.locator('[data-due-chip="today"]').click();
    expect(await due.inputValue(), 'a chip writes the day the same way').toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });

  test(`the When picker's Time is a 24-hour box: 930pm is 21:30, and there is no browser time input — at ${width} px`, async ({
    page,
  }) => {
    const me = await personWithTeam();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await openCapture(page);
    await page.locator('[data-quick-kind="reminder"]').click();
    await page.locator('[data-when-chip="pick"]').click();
    const time = page.locator('[data-when-time-field]');
    await expect(time).toBeVisible();
    await expect(page.locator('input[type="time"]'), 'no browser time input, which shows AM/PM').toHaveCount(0);
    await time.fill('930pm');
    await expect(page.locator('[data-when-result]'), 'the time is read as 24-hour').toContainText('· 21:30');
    await page.locator('[data-when-day]').focus();
    await expect(time, 'and written back as 24-hour').toHaveValue('21:30');
    await page.locator('[data-when-time="15:00"]').click();
    await expect(time, 'a time chip is written into the box').toHaveValue('15:00');
    await expect(page.locator('[data-when-result]')).toContainText('· 15:00');
  });
}
