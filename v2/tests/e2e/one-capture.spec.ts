/**
 * One way to capture (V633): My day's in-page Capture is a single button that opens the same Quick capture sheet as
 * Create → Capture and the phone + — Note, Idea, Checklist, Reminder, Only me by default. The separate note-only box is
 * gone, and "/" still opens the sheet from the keyboard. At 375 and 1,440 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });

for (const width of [375, 1440]) {
  test(`My day has one capture door: a button that opens the same sheet with all five kinds — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    await expect(page.locator('[data-capture-input]'), 'the note-only box is gone').toHaveCount(0);
    await expect(page.locator('[data-capture-open]'), 'one capture button').toHaveCount(1);
    const button = (await page.locator('[data-capture-open]').boundingBox())!;
    if (width < 700) expect(button.height, 'a finger-high button on a phone (V630)').toBeGreaterThanOrEqual(43.5);

    await page.locator('[data-capture-open]').click();
    await expect(page.locator('[data-quick-capture]')).toBeVisible();
    await expect(page.locator('[data-quick-kind]'), 'the same five kinds as Create and the +').toHaveText([
      'Note',
      'Idea',
      'Checklist',
      'Reminder',
      'Meeting',
    ]);
    await expect(page.locator('[data-quick-visibility="private"]'), 'Only me by default').toHaveAttribute(
      'aria-checked',
      'true',
    );

    const words = `One door ${width}`;
    await page.locator('[data-quick-text]').fill(words);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Note captured')).toBeVisible();
    await expect(page, 'and the person is still on My day').toHaveURL(/\/my-day$/);
    await expect(page.locator('[data-my-note]', { hasText: words }), 'the note is in the list').toBeVisible();
  });
}

test('"/" on My day opens the same sheet from the keyboard', async ({ page }) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('/');
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
  await expect(page.locator('[data-quick-text]')).toBeFocused();
});

test('a Meeting captured from the sheet is a meeting note, still on My day, ready for Turn into', async ({ page }) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-capture-open]').click();
  await page.locator('[data-quick-kind="meeting"]').click();
  await page.locator('[data-quick-text]').fill('Kick-off with the made-up client');
  await page.locator('[data-quick-save]').click();
  await expect(toast(page, 'Meeting captured')).toBeVisible();
  const [row] = await sql<{ kind: string; visibility: string }>(
    `select kind, visibility from my.note where person_id = $1 and title = $2`,
    [me.id, 'Kick-off with the made-up client'],
  );
  expect(row?.kind, 'filed as a meeting note').toBe('meeting');
  expect(row?.visibility, 'private by default').toBe('private');
  await expect(page.locator('[data-my-note][data-note-kind="meeting"]')).toBeVisible();
});
