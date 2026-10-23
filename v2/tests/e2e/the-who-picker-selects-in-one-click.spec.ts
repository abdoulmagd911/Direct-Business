/**
 * The Architect's ruling on the shared "Who was it with?" picker (22 Oct; QA-586): one click or tap picks a result — never
 * a first click that only highlights — and Enter picks the highlighted row (the first at the start, ArrowDown moves it);
 * on a phone every result row is 44 px high. At 375 and 1,440 px, with a real press of the mouse. Every value is made up.
 * Sabotages: tests/sabotage/who-picker.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [375, 1440]) {
  test(`one press picks a result, Enter picks the highlighted row, and the rows are finger-high — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const t = tag();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    for (const n of ['A', 'B']) {
      const made = await callAs(context, 'partner_create', {
        p_partner: { trade_name_en: `Pickorg${t} ${n}`, sides: [{ side: 'client', type: 'corporate' }] },
      });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
    }
    const open = async () => {
      await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
      await page.locator('[data-create-item="activity"]').click();
      await expect(page.locator('[data-activity-who]')).toBeVisible();
      await page.locator('[data-partner-search]').fill(`Pickorg${t}`);
      await expect(page.locator('[data-partner-hit]')).toHaveCount(2);
    };

    // one real press of the mouse (move, down, up) picks the row
    await open();
    const rows = page.locator('[data-partner-hit]');
    if (width < 640) {
      for (const i of [0, 1])
        expect(
          (await rows.nth(i).boundingBox())!.height,
          'a result row is 44 px high on a phone',
        ).toBeGreaterThanOrEqual(43.5);
    }
    const box = (await rows.nth(1).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-partner-picked]'), 'one press picks the result').toBeVisible();
    await expect(page.locator('[data-activity-who-next]')).toBeEnabled();
    await page.keyboard.press('Escape');

    // the keyboard: the first row is highlighted at the start, ArrowDown moves it, Enter picks it
    await open();
    await expect(rows.nth(0), 'the first row starts highlighted').toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-partner-search]').press('ArrowDown');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    const second = await rows.nth(1).getAttribute('data-partner-hit');
    await page.locator('[data-partner-search]').press('Enter');
    await expect(page.locator(`[data-partner-picked="${second}"]`), 'Enter picks the highlighted row').toBeVisible();
  });
}
