/**
 * Productivity Stage 2, builder B2's half — the Reminder's "When" in Quick capture and the reminders in My day's Today
 * block. When: Tomorrow chosen with the result written under the chips ("Wed 14 Oct · 09:00"); Pick a day shows Day,
 * Time and five time chips and the line follows; Save needs no further tap and stores Riyadh time. Today: a reminder due
 * today shows with a one-tap done that ends it. At 375 and 1,440 px, no sideways scroll, 44 px targets. Every value is
 * made up. (Arabic and the follow-up's "Follow up: <record>" tag are drawn without a browser, in the unit tests: Arabic is
 * off in a fresh stack, and the end-to-end database did not hold Stage 2's follow-up column when this was written.)
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);
const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function openReminderSheet(page: Page, wide: boolean) {
  await page.locator(wide ? '[data-create]' : '[data-create-floating]').click();
  await page.locator('[data-create-item="capture"]').click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
  await page.locator('[data-quick-kind="reminder"]').click();
}

for (const width of [375, 1440]) {
  test(`a Reminder asks When with chips, Tomorrow chosen, the result written out, and saves Riyadh time — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    const t = tag();
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, me.email, '/clients');
    await hydrated(page);
    await openReminderSheet(page, wide);

    await expect(page.locator('[data-quick-when-choice="tomorrow"]'), 'Tomorrow is chosen').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.locator('[data-quick-when-choice="next"]')).toBeVisible();
    await expect(page.locator('[data-quick-when-choice="pick"]')).toBeVisible();
    await expect(page.locator('[data-quick-when-line]'), 'the result is written out').toHaveText(
      /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} · 09:00$/,
    );
    await expect(page.locator('input[type="datetime-local"]'), 'the raw field is gone').toHaveCount(0);
    for (const c of ['tomorrow', 'next', 'pick'])
      expect(
        (await page.locator(`[data-quick-when-choice="${c}"]`).boundingBox())!.height,
        'a chip is a 44 px target',
      ).toBeGreaterThanOrEqual(44);

    await page.locator('[data-quick-when-choice="pick"]').click();
    await expect(page.locator('[data-quick-day]')).toBeVisible();
    await expect(page.locator('[data-quick-time]')).toBeVisible();
    await expect(page.locator('[data-quick-time-chip]')).toHaveCount(5);
    await page.locator('[data-quick-time-chip="15:00"]').click();
    await expect(page.locator('[data-quick-when-line]')).toContainText('15:00');
    expect(await noSideways(page), 'no sideways scroll').toBe(true);

    await page.locator('[data-quick-text]').fill(`Call Sahab Tech ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(page.locator('[data-quick-capture]')).toHaveCount(0);
    const [r] = await sql<{ local: string }>(
      `select to_char(r.remind_at at time zone 'Asia/Riyadh', 'HH24:MI') as local
         from core.reminder r join my.note n on n.id = r.note_id where n.person_id = $1 and n.title = $2`,
      [me.id, `Call Sahab Tech ${t}`],
    );
    expect(r?.local, 'the time picked is Riyadh time').toBe('15:00');
  });
}

test('a reminder due today shows in Today and one tap ends it', async ({ page }) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'note_capture', {
    p_kind: 'reminder',
    p_values: { title: `Send the Dune Foods file ${t}`, remind_at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  // bring it to this Riyadh day without waiting for the clock
  await sql(
    `update core.reminder r set remind_at = core.clock() + interval '2 minutes'
       from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  await page.reload();
  await hydrated(page);
  const row = page.locator('[data-today-reminder]', { hasText: `Send the Dune Foods file ${t}` });
  await expect(row).toBeVisible();
  expect((await row.locator('[data-reminder-done]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await row.locator('[data-reminder-done]').click();
  await expect(row).toHaveCount(0);
  const [gone] = await sql<{ n: number }>(
    `select count(*)::int as n from core.reminder r join my.note n on n.id = r.note_id
      where n.person_id = $1 and n.title = $2 and r.deleted_at is null`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  expect(gone!.n, 'one tap ended the reminder').toBe(0);
});
