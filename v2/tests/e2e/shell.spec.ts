/**
 * The shell: drawer 232/56 with the pin remembered, Ctrl K, the Create menu, the off-canvas sheet
 * under 1,024 px, no page title in the top bar, every nav entry a link.
 */
import { expect, test } from '@playwright/test';
import { THEMES, fitToPage, open, setPrefs } from './helpers';

test('the drawer is 232 px pinned, 56 px collapsed, and the choice survives a reload', async ({
  page,
  context,
}) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/my-day');
  const drawer = page.locator('[data-drawer]');
  expect((await drawer.boundingBox())!.width).toBeCloseTo(232, 0);
  await page.locator('[data-drawer-collapse]').click();
  await expect(drawer).toHaveAttribute('data-expanded', 'false');
  expect((await drawer.boundingBox())!.width).toBeCloseTo(56, 0);
  await page.reload();
  await expect(page.locator('[data-drawer]')).toHaveAttribute('data-expanded', 'false');
  // collapsed: the rail opens as an overlay on hover and closes on Escape
  await page.locator('[data-drawer]').hover();
  await expect(page.locator('[data-drawer]')).toHaveAttribute('data-expanded', 'true');
  await page.mouse.move(800, 400);
  await expect(page.locator('[data-drawer]')).toHaveAttribute('data-expanded', 'false');
});

test('Ctrl K opens the palette and goes to a page', async ({ page, context }) => {
  await setPrefs(context, { theme: 'light' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/my-day');
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder('Go to a page or search…').fill('Tas');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(palette).toBeHidden();
  await expect(page.locator('[data-drawer] a[aria-current="page"]')).toHaveText('Tasks');
});

test('the Create menu lists the create actions and the top bar carries no page title', async ({
  page,
  context,
}) => {
  await setPrefs(context, { theme: 'colorful' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/partners');
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem', { name: 'Task' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Invoice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-topbar]')).not.toContainText('Partners');
  await expect(page.locator('h1')).toHaveText('Partners');
});

test('under 1,024 px the drawer is an off-canvas sheet that Escape closes', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 400, height: 800 });
  await open(page, '/my-day');
  await expect(page.locator('[data-drawer]:visible')).toHaveCount(0);
  await page.locator('[data-open-menu]').click();
  await expect(page.locator('[data-drawer]:visible')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-drawer]:visible')).toHaveCount(0);
});

test('every drawer entry is a link and the active one is marked', async ({ page, context }) => {
  await setPrefs(context, { theme: 'dark' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kpis');
  const links = page.locator('[data-drawer] a[href]');
  await expect(links).toHaveCount(11); // logo, 8 pages, Settings, the profile
  await expect(page.locator('[data-drawer] a[aria-current="page"]')).toHaveAttribute('href', '/kpis');
});

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · my-day · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      await open(page, '/my-day');
      await expect(page.locator('h1')).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: `tests/e2e/screenshots/my-day-${theme}-${width}.png` });
    });
  }
}
