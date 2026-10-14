/**
 * One add control per width (daily use 11, V633): on a PC it is Create in the top bar, on a phone the +, and both open
 * the same menu. Create → Capture opens the Quick capture sheet — Note, Idea, Checklist, Reminder, Meeting, Only me by
 * default — so My day has no Capture button of its own; "/" still opens the sheet from the keyboard. At 375 and
 * 1,440 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { openCapture } from './support/capture';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const PC = { width: 1440, height: 1000 };
const PHONE = { width: 375, height: 800 };

/** The items the open Create menu (or the + menu) offers, in order. */
async function menuItems(page: Page, trigger: string) {
  await page.locator(trigger).click();
  const items = await page
    .locator('[data-create-item]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-create-item')));
  await page.keyboard.press('Escape');
  return items;
}

test('one add control per width: Create on a PC, the + on a phone, and both open the same menu', async ({ page }) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize(PC);
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('[data-create]'), 'Create on a PC').toBeVisible();
  await expect(page.locator('[data-create-floating]'), 'no + on a PC').toBeHidden();
  const wide = await menuItems(page, '[data-create]');
  expect(wide[0], 'Capture comes first').toBe('capture');

  await page.setViewportSize(PHONE);
  await expect(page.locator('[data-create-floating]'), 'the + on a phone').toBeVisible();
  await expect(page.locator('[data-create]'), 'no Create on a phone').toBeHidden();
  expect(await menuItems(page, '[data-create-floating]'), 'the + opens the same menu as Create').toEqual(wide);
});

for (const size of [PHONE, PC]) {
  test(`My day has one capture door: Create → Capture opens the sheet with all five kinds — at ${size.width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize(size);
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    await expect(page.locator('[data-capture-input]'), 'no note-only box').toHaveCount(0);
    await expect(page.locator('[data-capture-open]'), 'no Capture button of its own on My day').toHaveCount(0);
    await expect(
      page.locator('[data-state="empty"]', { hasText: 'No notes yet' }),
      'the empty line points to the one add control',
    ).toHaveText('No notes yet. Notes you capture with Create (or + on a phone) appear here.');

    await openCapture(page);
    await expect(page.locator('[data-quick-kind]'), 'five kinds').toHaveText([
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

    const words = `One door ${size.width}`;
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
  await openCapture(page);
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
