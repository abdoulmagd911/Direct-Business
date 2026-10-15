/**
 * Productivity stage 2, PR 2 — the reminder alert. At a reminder's time a card shows under the top bar on any page, with
 * the reminder's words, Done and Snooze (Later today · Tomorrow · Next week). It is the bell's item and the same one: Done
 * in either place clears both. One timer shows it at its time with no reload; it never takes focus from a field being
 * typed in and never covers the phone's floating +. At 375 and 1,440 px. Every value is made up.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);
const alert = (page: Page) => page.locator('[data-reminder-alert]');

/** A Reminder made the ordinary way, then moved to `seconds` from now (negative: gone by) and told by the job if due. */
async function reminder(context: BrowserContext, personId: string, text: string, seconds: number, tell = true) {
  const made = await callAs(context, 'note_capture', {
    p_kind: 'reminder',
    p_values: { title: text, remind_at: new Date(Date.now() + 3_600_000).toISOString() },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  await sql(
    `update core.reminder r set remind_at = now() + ($3 || ' seconds')::interval
       from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
    [personId, text, String(seconds)],
  );
  if (tell) await sql(`select notify.send_reminders()`);
}

for (const width of [375, 1440]) {
  test(`a reminder at its time shows the alert on any page; Done ends it in the alert and in the bell — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    const text = `Call back ${tag()}`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await expect(alert(page), 'nothing is due, nothing is drawn').toHaveCount(0);
    await reminder(page.context(), me.id, text, -60);

    for (const path of ['/my-day', '/tasks']) {
      await page.goto(path);
      await hydrated(page);
      await expect(alert(page), `the alert shows on ${path}`).toBeVisible();
      await expect(alert(page).locator('[data-alert-text]')).toHaveText(text);
    }
    const box = (await alert(page).boundingBox())!;
    const bar = (await page.locator('[data-topbar]').boundingBox())!;
    expect(box.y, 'under the top bar').toBeGreaterThanOrEqual(bar.y + bar.height - 0.5);
    if (width < 700) {
      for (const part of ['[data-alert-done]', '[data-alert-snooze]', '[data-alert-text]']) {
        const b = (await alert(page).locator(part).boundingBox())!;
        expect(b.height, `${part} is a 44 px target`).toBeGreaterThanOrEqual(43.5);
      }
    }
    if (width < 700) {
      const plus = (await page.locator('[data-create-floating]').boundingBox())!;
      expect(box.y + box.height, 'the alert stays above the floating +').toBeLessThan(plus.y);
      expect(box.x + box.width, 'no sideways scroll').toBeLessThanOrEqual(width);
    }

    // the bell holds the same item once
    await page.locator('[data-bell]').click();
    await expect(
      page.locator('[data-notifications-panel] [data-unread]'),
      'the bell holds the same item, once (a new person has no other)',
    ).toHaveCount(1);
    await page.keyboard.press('Escape');

    await alert(page).locator('[data-alert-done]').click();
    await expect(alert(page), 'Done ends the alert').toHaveCount(0);
    await expect(page.locator('[data-bell]'), 'and clears the bell').toHaveAttribute('data-unread', '0');
    const [row] = await sql<{ n: number }>(
      `select count(*)::int as n from notify.notification where person_id = $1 and read_at is null and entity_table = 'core.reminder'`,
      [me.id],
    );
    expect(row?.n, 'no unread alert is left').toBe(0);
  });
}

test('Snooze > Tomorrow moves the reminder to the next working day at nine and puts the alert away', async ({
  page,
}) => {
  const me = await makePerson({ admin: true });
  const text = `Snooze ${tag()}`;
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await reminder(page.context(), me.id, text, -60);
  await page.reload();
  await hydrated(page);
  await alert(page).locator('[data-alert-snooze]').click();
  const [word] = await sql<{ name: string }>(
    `select case when core.next_working_day(core.riyadh_today()) = core.riyadh_today() + 1 then 'Tomorrow'
                 else trim(to_char(core.next_working_day(core.riyadh_today()), 'FMDay')) end as name`,
  );
  await expect(
    page.locator('[data-alert-snooze-to="tomorrow"]'),
    'Tomorrow is called by its day when the next working day is not tomorrow',
  ).toContainText(word!.name);
  await expect(page.locator('[data-alert-snooze-to="next_week"]')).toBeVisible();
  await page.locator('[data-alert-snooze-to="tomorrow"]').click();
  await expect(alert(page), 'the alert is put away').toHaveCount(0);
  const [row] = await sql<{ at: string; tomorrow: string }>(
    `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as at,
            core.next_working_day(core.riyadh_today())::text || ' 09:00' as tomorrow
       from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
    [me.id, text],
  );
  expect(row?.at, 'moved to tomorrow at nine, Riyadh time').toBe(row?.tomorrow);
});

test('the alert comes up by itself at the reminder’s time, with no reload, and does not take focus from a field', async ({
  page,
}) => {
  const me = await makePerson({ admin: true });
  const text = `By itself ${tag()}`;
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await reminder(page.context(), me.id, text, 6, false);
  await page.reload();
  await hydrated(page);
  await page.evaluate(() => {
    const field = document.createElement('input');
    field.setAttribute('data-test-field', '');
    document.body.appendChild(field);
    field.focus();
  });
  await page.keyboard.type('half a sentence');
  await expect(alert(page), 'not before its time').toHaveCount(0);
  await page.waitForTimeout(7_000);
  await sql(`select notify.send_reminders()`);
  await expect(alert(page), 'at its time, from the one timer').toBeVisible({ timeout: 20_000 });
  expect(
    await page.evaluate(() => document.activeElement?.hasAttribute('data-test-field')),
    'focus stayed in the field',
  ).toBe(true);
  await expect(page.locator('[data-test-field]')).toHaveValue('half a sentence');
});
