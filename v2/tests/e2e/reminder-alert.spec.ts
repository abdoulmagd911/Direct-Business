/**
 * Productivity stage 2, PR 2 — the reminder alert. At a reminder's time a card shows under the top bar on any page, with
 * the reminder's words, Done and Snooze (Later today · Tomorrow · Next week). It is the bell's item and the same one: Done
 * in either place clears both. One timer shows it at its time with no reload; it never takes focus from a field being
 * typed in and never covers Create in the phone's bar. At 375 and 1,440 px. Every value is made up.
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
      for (const part of ['[data-alert-done]', '[data-alert-snooze]', '[data-alert-hide]', '[data-alert-text-link]']) {
        const b = (await alert(page).locator(part).boundingBox())!;
        expect(b.height, `${part} is a 44 px target`).toBeGreaterThanOrEqual(43.5);
      }
    }
    if (width < 700) {
      const plus = (await page.locator('[data-create-bar]').boundingBox())!;
      expect(box.y + box.height, 'the alert stays above Create in the bar').toBeLessThan(plus.y);
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

for (const width of [375, 1440]) {
  test(`Hide for now puts the bar away without finishing the reminder, and a new reminder brings it back — at ${width} px`, async ({
    page,
  }) => {
    // The ruling of 18 Oct: the bar takes its own room (never floats over the page), Hide for now neither finishes nor
    // snoozes, the reminder stays in the bell (counted) and on My day, and only a NEW due reminder brings the bar back.
    const me = await makePerson({ admin: true });
    const first = `Hide me ${tag()}`;
    const second = `Brand new ${tag()}`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/tasks');
    await hydrated(page);
    await reminder(page.context(), me.id, first, -60);
    await page.reload();
    await hydrated(page);
    await expect(alert(page)).toBeVisible();

    const box = (await alert(page).boundingBox())!;
    const main = (await page.locator('#main').boundingBox())!;
    expect(box.y + box.height, 'the bar takes its own room: the page starts below it').toBeLessThanOrEqual(
      main.y + 0.5,
    );
    expect(await alert(page).evaluate((el) => getComputedStyle(el).position), 'it does not float').not.toBe('fixed');
    const hide = alert(page).locator('[data-alert-hide]');
    if (width < 700) {
      // V643 (1): at most about 110 px on a phone, and the three buttons are one row
      expect(box.height, 'the bar is at most 110 px high on a phone').toBeLessThanOrEqual(110);
      const ys = await Promise.all(
        ['[data-alert-done]', '[data-alert-snooze]', '[data-alert-hide]'].map(async (q) => {
          const b = (await alert(page).locator(q).boundingBox())!;
          expect(b.width, `${q} is 44 px wide`).toBeGreaterThanOrEqual(43.5);
          return Math.round(b.y);
        }),
      );
      expect(new Set(ys).size, 'Done, Snooze and Hide are one row').toBe(1);
      await expect(hide, 'a short word on a phone').toHaveText('Hide');
    } else {
      await expect(hide).toHaveText('Hide for now');
    }
    if (width < 700)
      expect((await hide.boundingBox())!.height, 'Hide for now is a 44 px target').toBeGreaterThanOrEqual(43.5);

    await hide.click();
    await expect(alert(page), 'hidden').toHaveCount(0);
    await expect(page.locator('[data-bell]'), 'the reminder is still counted on the bell').toHaveAttribute(
      'data-unread',
      '1',
    );
    const [kept] = await sql<{ n: number }>(
      `select count(*)::int as n from notify.notification where person_id = $1 and read_at is null and entity_table = 'core.reminder'`,
      [me.id],
    );
    expect(kept?.n, 'not finished').toBe(1);
    await page.reload();
    await hydrated(page);
    await expect(alert(page), 'a reload does not bring it back').toHaveCount(0);
    await page.goto('/my-day');
    await hydrated(page);
    await expect(page.locator('[data-today-block]'), 'and it is still on My day').toContainText(first);

    await reminder(page.context(), me.id, second, -30);
    await page.reload();
    await hydrated(page);
    await expect(alert(page), 'a new reminder brings the bar back').toBeVisible();
    await expect(alert(page).locator('[data-alert-text]')).toHaveText(second);
    await expect(alert(page).locator('[data-alert-more]'), 'the hidden one is not counted in the bar').toHaveCount(0);
  });
}

for (const width of [375, 1440]) {
  test(`the bell draws its unread number, and a hidden reminder that is snoozed and due again brings the bar back — at ${width} px`, async ({
    page,
  }) => {
    // QA-578: the number on the bell is drawn. QA-579 (ruling of 19 Oct): Hide for now, then snooze, then due again at
    // its new time counts as NEW.
    const me = await makePerson({ admin: true });
    const text = `Again ${tag()}`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await reminder(page.context(), me.id, text, -60);
    await page.reload();
    await hydrated(page);
    await expect(page.locator('[data-bell]'), 'the unread number is drawn on the bell').toContainText('1');
    await alert(page).locator('[data-alert-hide]').click();
    await expect(alert(page)).toHaveCount(0);

    // snoozed and due again: the same reminder, a new time that has come
    await sql(
      `update core.reminder r set remind_at = r.remind_at - interval '30 seconds'
         from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
      [me.id, text],
    );
    await page.reload();
    await hydrated(page);
    await expect(alert(page), 'a snoozed reminder that is due again is new').toBeVisible();
    await expect(alert(page).locator('[data-alert-text]')).toHaveText(text);
  });
}

test('Snooze offers In 1 hour first, and it moves the reminder an hour on (V643 (2))', async ({ page }) => {
  const me = await makePerson({ admin: true });
  const text = `Hour ${tag()}`;
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await reminder(page.context(), me.id, text, -60);
  await page.reload();
  await hydrated(page);
  await alert(page).locator('[data-alert-snooze]').click();
  const first = page.locator('[data-alert-snooze-to]').first();
  await expect(first, 'In 1 hour is the first choice').toHaveAttribute('data-alert-snooze-to', 'one_hour');
  await expect(first).toContainText('In 1 hour');
  await first.click();
  await expect(alert(page), 'the alert is put away').toHaveCount(0);
  const [row] = await sql<{ minutes: number }>(
    `select round(extract(epoch from (r.remind_at - now())) / 60)::int as minutes
       from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
    [me.id, text],
  );
  expect(row?.minutes, 'an hour on').toBeGreaterThanOrEqual(59);
  expect(row?.minutes).toBeLessThanOrEqual(61);
});
