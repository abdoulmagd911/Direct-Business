/**
 * The shell: drawer 232/56 with the pin remembered, Ctrl K, the Create menu, the bottom bar under
 * 640 px (V85), no page title in the top bar, every nav entry a link.
 */
import { expect, test } from '@playwright/test';
import { THEMES, fitToPage, open, setPrefs, shot } from './helpers';
import { makePerson, signIn } from './support/stack';

test('the drawer is 232 px pinned, 56 px collapsed, and the choice survives a reload', async ({ page, context }) => {
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

test('the Create menu lists the create actions and the top bar carries no page title', async ({ page, context }) => {
  await setPrefs(context, { theme: 'colorful' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/partners?view=clients');
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem', { name: 'Task' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Invoice' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-topbar]')).not.toContainText('Partners');
  await expect(page.locator('h1')).toHaveText('Clients');
  await expect(page.locator('[data-drawer] a[aria-current="page"]')).toHaveText('Clients');
});

test('under 640 px the bottom bar carries My day · Tasks · Clients · KPIs · More, and More opens the rest', async ({
  page,
  context,
}) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 400, height: 800 });
  await open(page, '/my-day');
  await expect(page.locator('[data-drawer]')).toBeHidden();
  const bar = page.locator('[data-bottom-bar]');
  await expect(bar).toBeVisible();
  await expect(bar.locator('a, button')).toHaveText(['My day', 'Tasks', 'Clients', 'KPIs', 'More']);
  await expect(bar.locator('a[aria-current="page"]')).toHaveText('My day');
  await page.locator('[data-bottom-more]').click();
  const sheet = page.locator('[data-more-sheet]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Pipeline' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-bottom-more]')).toBeFocused();
  await expect(page.locator('[data-create-floating]')).toBeVisible();
  await expect(page.locator('[data-create]')).toBeHidden();
});

test('a tablet keeps the drawer and has no bottom bar (V85)', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 800, height: 900 });
  await open(page, '/my-day');
  await expect(page.locator('[data-drawer]')).toBeVisible();
  await expect(page.locator('[data-bottom-bar]')).toBeHidden();
  await expect(page.locator('[data-create-floating]')).toBeHidden();
});

test('every drawer entry is a link and the active one is marked', async ({ page, context }) => {
  await setPrefs(context, { theme: 'dark' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kpis');
  const links = page.locator('[data-drawer] a[href]');
  await expect(links).toHaveCount(14); // logo, 11 entries (Partners is Clients + Suppliers & partners), Settings, the profile
  await expect(page.locator('[data-drawer] a[aria-current="page"]')).toHaveAttribute('href', '/kpis');
});

test('the drawer comes from the registry: a team member sees no Settings and no page at level none', async ({
  page,
  context,
}) => {
  // A member's role starts at none on Overview (src/modules/overview/module.ts) and Settings is the admin's door.
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  const member = await makePerson();
  await signIn(page, member.email, '/my-day');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  const labels = await page.locator('[data-drawer] a[href]:not([data-entity])').allInnerTexts();
  expect(labels.map((l) => l.trim()).filter(Boolean)).toEqual([
    'My day',
    'Clients',
    'Suppliers & partners',
    'Pipeline',
    'Projects',
    'Tasks',
    'Finance',
    'KPIs',
    'Reports',
    'Appraisal',
  ]);
  await expect(page.locator('[data-drawer]').getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await page.locator('[data-profile-chip]').click();
  await expect(page.getByRole('menuitem', { name: 'My profile' })).toBeVisible();
});

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · my-day · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      await open(page, '/my-day');
      await expect(page.locator('h1')).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`my-day-${theme}-${width}`) });
    });
  }
}
