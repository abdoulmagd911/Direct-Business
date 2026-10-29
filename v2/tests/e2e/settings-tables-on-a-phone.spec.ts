/**
 * QA-593: Settings tables on a phone (375 px). Teams, Departments and the setting lists of Finance, Partners, Work and App are
 * cards, like People. The Access matrix and the Roles table keep their grid and say they scroll: a soft edge with a chevron
 * at the end of the box while there is more to see, and the Access matrix keeps its first column (the page or capability) in
 * place as the roles scroll past. A Settings table that scrolls sideways with no cue fails this. Every value is made up.
 * Sabotages: tests/sabotage/settings-tables-phone.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** Every box inside the page that scrolls sideways now, and whether it shows a cue. */
const scrollers = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main *'))
      .filter((el) => {
        const o = getComputedStyle(el).overflowX;
        return (
          (o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 1 && el.getClientRects().length > 0
        );
      })
      .map((el) => ({
        what: `${el.closest('[data-access-matrix]') ? 'access matrix' : el.closest('[data-roles]') ? 'roles' : el.closest('[data-activity-sign-ins]') ? 'sign-ins' : el.tagName.toLowerCase()}`,
        cue: !!el.parentElement?.querySelector('[data-scroll-cue]'),
      })),
  );

test('Settings tables on a phone are cards or say that they scroll — and the Access matrix keeps its first column', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);

  const pages = [
    '/settings/org',
    '/settings/org?tab=teams',
    '/settings/org?tab=access',
    '/settings/finance',
    '/settings/partners',
    '/settings/work',
    '/settings/app',
    '/activity?tab=signIns',
  ];
  const silent: string[] = [];
  for (const path of pages) {
    await page.goto(path);
    await hydrated(page);
    for (const s of await scrollers(page)) if (!s.cue) silent.push(`${path}: a ${s.what} scrolls sideways with no cue`);
    // the lists and teams are cards, not tables, on a phone
    if (path !== '/settings/org?tab=access' && path !== '/activity?tab=signIns')
      expect(await page.locator('main table:visible').count(), `${path} has no table on a phone`).toBe(0);
  }
  expect(silent, 'a Settings table that scrolls sideways shows a cue').toEqual([]);

  // the Access matrix: the cue shows, the first column stays while the roles scroll past, and the cue goes at the end
  await page.goto('/settings/org?tab=access');
  await hydrated(page);
  const matrix = page.locator('[data-access-matrix]');
  await expect(matrix.locator('[data-scroll-cue]'), 'the matrix shows it scrolls').toBeVisible();
  const first = matrix.locator('th[scope="row"]').first();
  const before = (await first.boundingBox())!;
  await matrix.locator('> div').evaluate((el) => el.scrollBy({ left: 400 }));
  const after = (await first.boundingBox())!;
  expect(Math.abs(after.x - before.x), 'the first column stays in place as the roles scroll').toBeLessThan(2);
  await matrix.locator('> div').evaluate((el) => el.scrollBy({ left: 100000 }));
  await expect(matrix.locator('[data-scroll-cue]'), 'the cue goes at the last column').toHaveCount(0);
});
