/**
 * V639 (1) — a date typed in a title. "Call hotel tomorrow 6pm" typed into a Reminder is read as tomorrow at 18:00 Riyadh
 * time and shown as a chip the person can remove before saving; "Pay supplier tomorrow" typed into New task sets its due
 * day, shown the same way. The words stay in the title. At 375 and 1,440 px. Every value is made up.
 * Sabotage: tests/sabotage/title-date.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { openCapture } from './support/capture';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

async function admin() {
  const me = await makePerson({ admin: true });
  const t = randomUUID().slice(0, 6);
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [me.id, `td_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [me.id, team!.id]);
  return me;
}

const calendarTomorrow = async () => (await sql<{ d: string }>(`select (core.riyadh_today() + 1)::text as d`))[0]!.d;

for (const width of [375, 1440]) {
  test(`a date typed in a Reminder is read as a chip, saved as that time, and can be removed — at ${width} px`, async ({
    page,
  }) => {
    const me = await admin();
    const tomorrow = await calendarTomorrow();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await openCapture(page);
    await page.locator('[data-quick-kind="reminder"]').click();
    await expect(page.locator('[data-title-date]'), 'nothing typed, no chip').toHaveCount(0);

    await page.locator('[data-quick-text]').fill('Call hotel tomorrow 6pm');
    const chip = page.locator('[data-title-date]');
    await expect(chip, 'read as tomorrow').toHaveAttribute('data-title-date-day', tomorrow);
    await expect(chip).toContainText('18:00');
    await expect(page.locator('[data-when]'), 'the picker steps aside while a date is read').toHaveCount(0);
    if (width < 700)
      expect(
        (await chip.locator('[data-title-date-remove]').boundingBox())!.width,
        'a 44 px remove button',
      ).toBeGreaterThanOrEqual(43.5);

    // removing it brings the picker back and the words stay
    await chip.locator('[data-title-date-remove]').click();
    await expect(chip).toHaveCount(0);
    await expect(page.locator('[data-when]')).toBeVisible();
    await expect(page.locator('[data-quick-text]')).toHaveValue('Call hotel tomorrow 6pm');

    // typing a different date reads again; Save files it at that time
    await page.locator('[data-quick-text]').fill('Call hotel tomorrow 7pm');
    await expect(page.locator('[data-title-date]')).toContainText('19:00');
    await page.locator('[data-quick-save]').click();
    await expect(page.locator('[data-quick-capture]')).toHaveCount(0);
    const [row] = await sql<{ at: string }>(
      `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as at
         from core.reminder r join my.note n on n.id = r.note_id
        where n.person_id = $1 and n.title = 'Call hotel tomorrow 7pm'`,
      [me.id],
    );
    expect(row?.at, 'tomorrow 19:00, Riyadh time').toBe(`${tomorrow} 19:00`);
  });

  test(`a date typed in a New task title sets its due day, and removing the chip leaves it empty — at ${width} px`, async ({
    page,
  }) => {
    const me = await admin();
    const tomorrow = await calendarTomorrow();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/tasks/new');
    await hydrated(page);
    const form = page.locator('form[data-quick-add]');
    const title = form.locator('input[name="title"]');
    await title.fill('Pay supplier tomorrow');
    await expect(form.locator('[data-title-date]'), 'read as tomorrow').toHaveAttribute(
      'data-title-date-day',
      tomorrow,
    );
    await form.locator('[data-title-date-remove]').click();
    await expect(form.locator('[data-title-date]')).toHaveCount(0);
    await title.fill('Pay supplier tomorrow ');
    await title.fill('Pay supplier tomorrow');
    await expect(form.locator('[data-title-date]'), 'the removed date stays removed').toHaveCount(0);
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText('Task added: Pay supplier tomorrow')).toBeVisible();
    const [none] = await sql<{ due: string | null }>(
      `select to_char(due_on, 'YYYY-MM-DD') as due from work.task where title = 'Pay supplier tomorrow' and created_by = $1`,
      [me.id],
    );
    expect(none?.due, 'removed: no due day').toBeNull();

    // and left in, the same words set the day
    await page.goto('/tasks/new');
    await hydrated(page);
    await form.locator('input[name="title"]').fill('Chase the visa tomorrow');
    await expect(form.locator('[data-title-date]')).toBeVisible();
    await form.locator('button[type="submit"]').click();
    await expect(page.getByText('Task added: Chase the visa tomorrow')).toBeVisible();
    const [set] = await sql<{ due: string | null }>(
      `select to_char(due_on, 'YYYY-MM-DD') as due from work.task where title = 'Chase the visa tomorrow' and created_by = $1`,
      [me.id],
    );
    expect(set?.due, 'due tomorrow').toBe(tomorrow);
  });
}
