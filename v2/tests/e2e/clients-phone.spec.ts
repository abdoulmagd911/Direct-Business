/**
 * V630 on the Clients list, on a phone: one add action (the floating +), one Filter button that holds the search and
 * the chips and shows how many are on, nothing wider than the screen — at 375 and at 320 px. A wide screen keeps the
 * header button and every control in its row. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "clients-header-add-stays-on-a-phone", "clients-filters-stay-in-the-row-on-a-phone",
 * "clients-filter-button-forgets-its-count", "clients-filter-button-shows-on-a-wide-screen".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

const drawn = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  return b && b.width > 0 && b.height > 0 ? b : null;
};

for (const width of [375, 320]) {
  test(`phone ${width}: Clients has one add action and one Filter button (V630)`, async ({ page }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: 812 });
    await signIn(page, admin.email, '/clients');
    await hydrated(page);

    expect(await drawn(page, '[data-partner-new]'), 'the header New client button is not drawn on a phone').toBeNull();
    expect(await drawn(page, '[data-create-bar]'), 'the floating + is the one add action').not.toBeNull();

    const filter = await drawn(page, '[data-filter-toggle]');
    expect(filter, 'a Filter button is drawn').not.toBeNull();
    expect(filter!.height, 'the Filter button is a finger tall').toBeGreaterThanOrEqual(43.5);
    expect(await drawn(page, '[data-partners-search]'), 'the search is folded away').toBeNull();
    expect(await drawn(page, '[data-partners-more]'), 'More filters is folded away').toBeNull();
    await expect(page.locator('[data-filter-count]')).toHaveCount(0);

    await page.locator('[data-filter-toggle]').click();
    expect(await drawn(page, '[data-partners-search]'), 'opening Filter shows the search').not.toBeNull();
    await page.locator('[data-partners-search]').fill('zzz');
    await page.locator('[data-partners-search]').press('Enter');
    await expect(page.locator('[data-filter-count]'), 'the button counts the search').toHaveText('1');

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      'the page does not scroll sideways',
    ).toBeLessThanOrEqual(width);
  });
}

test('desk 1440: Clients keeps its header button and every filter in the row', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/clients');
  await hydrated(page);
  expect(await drawn(page, '[data-partner-new]'), 'the header button is drawn').not.toBeNull();
  expect(await drawn(page, '[data-partners-search]'), 'the search is in the row').not.toBeNull();
  expect(await drawn(page, '[data-partners-more]'), 'More filters is in the row').not.toBeNull();
  expect(await drawn(page, '[data-filter-toggle]'), 'no Filter button on a wide screen').toBeNull();
});
