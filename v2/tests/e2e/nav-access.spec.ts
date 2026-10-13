/**
 * The 13 Oct sweep, nav and Finance (V238): the Suppliers page is titled Suppliers (its tab sits under it, Clients keeps
 * its own title), at desktop and phone width; and on a wide Finance window the lists beside the figures fill while the heavy
 * reads (the closed months, the health line) are still on their way — the page never sits on one grey wait. Every value is
 * made up.
 * Sabotage: tests/sabotage/nav-access.mjs "suppliers-page-says-clients", "finance-lists-wait-for-the-heavy-reads".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`${size.name}: the Suppliers page is titled Suppliers and Clients keeps its title`, async ({ page }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page, admin.email, '/suppliers');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1 }), 'the title is the page on screen').toHaveText('Suppliers');
    await expect(page.locator('[data-side-tab="supplier_partner"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('/clients');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');
    await expect(page.locator('[data-side-tab="client"]')).toHaveAttribute('aria-current', 'page');
  });
}

test('desktop: Finance fills the lists beside the figures while the heavy reads are still on their way', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  // the closed months and the health line are the heavy reads: hold them back, as a slow database would
  await page.route('**/rest/v1/rpc/finance_*', async (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop()!;
    try {
      if (fn === 'finance_closed_months' || fn === 'finance_health') await new Promise((r) => setTimeout(r, 6000));
      const response = await route.fetch();
      await route.fulfill({ response }).catch(() => {
        // the page gave up on this request; the server has answered all the same
      });
    } catch {
      // the test ended while the server was still answering
    }
  });
  await signIn(page, admin.email, '/finance?period=mtd');
  await hydrated(page);
  await expect(
    page.locator('[data-finance-not-invoiced]'),
    'Not yet invoiced fills before the heavy reads',
  ).toBeVisible({
    timeout: 4000,
  });
  await expect(
    page.locator('[data-finance-service], [data-finance-service-empty]').first(),
    'By service fills too',
  ).toBeVisible({
    timeout: 4000,
  });
  await expect(page.locator('[data-finance-months]'), 'the months are still on their way').toHaveCount(0);
  await expect(page.locator('[data-finance-months]'), 'and arrive when their read does').toBeVisible({
    timeout: 30_000,
  });
});
