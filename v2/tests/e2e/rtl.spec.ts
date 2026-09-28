/**
 * Pseudo-Arabic: the English catalog under dir="rtl" (the development override). The drawer moves to
 * the inline start (the right), the detail panel to the inline end (the left), directional icons flip,
 * and nothing keeps a physical position — the source-level rule is check-no-physical-css.
 */
import { expect, test } from '@playwright/test';
import { open, setPrefs, shot } from './helpers';

test('the shell mirrors under dir=rtl', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct', dir: 'rtl' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kit');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const drawer = (await page.locator('[data-drawer]').boundingBox())!;
  const main = (await page.locator('main').boundingBox())!;
  expect(drawer.x, 'drawer sits on the right').toBeGreaterThan(main.x);
  expect(drawer.width).toBeCloseTo(232, 0);

  const collapse = page.locator('[data-drawer-collapse] svg');
  const transform = await collapse.evaluate((el) => getComputedStyle(el).transform);
  expect(transform, 'the collapse icon is mirrored').toMatch(/matrix\(-1,/);

  await page.locator('[data-kit-section="Table"] tr[data-index]').first().click();
  const panel = page.locator('aside[data-detail-panel]');
  await expect(panel).toBeVisible();
  const pb = (await panel.boundingBox())!;
  expect(pb.x + pb.width, 'the panel sits on the left').toBeLessThan(main.x + main.width / 2);
  expect(pb.width).toBeCloseTo(480, 0);

  const numeric = page.locator('[data-kit-section="Table"] td.text-end').first();
  expect(await numeric.evaluate((el) => getComputedStyle(el).textAlign)).toBe('end');
  await page.screenshot({ path: shot('kit-direct-rtl-1500') });
});

test('sign-in mirrors under dir=rtl', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct', dir: 'rtl' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/sign-in');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const lang = (await page.getByRole('group', { name: 'Language' }).boundingBox())!;
  expect(lang.x, 'the language switch is at the inline end (left)').toBeLessThan(200);
  await page.screenshot({ path: shot('signin-direct-rtl-1500') });
});
