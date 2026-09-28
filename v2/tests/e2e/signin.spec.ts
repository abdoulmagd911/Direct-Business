/**
 * The styled sign-in page (canvas 1 and 1b): one step at a time; the emailed code is the only door (V59); a refused
 * address is told in words; the code step verifies and lands on the asked-for page. Runs against the
 * development stand-in; P3-2 swaps in the real door behind the same screen.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { THEMES, fitToPage, open, setPrefs } from './helpers';

test('email step → code step → signed in on the deep link', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/sign-in?next=%2Ftasks');
  await expect(page.getByRole('heading', { name: 'Commercial Workspace' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Google|Zoom/ }),
    'the only door is the emailed code (V59)',
  ).toHaveCount(0);
  await expect(page.locator('[data-step="code"]')).toHaveCount(0);

  await page.getByLabel('Work email').fill('someone@example.com');
  await page.locator('[data-door="code"]').click();
  await expect(page.locator('p[role="alert"]')).toHaveText('This email is not on the list — ask an admin');

  await page.getByLabel('Work email').fill('a@directksa.com');
  await page.locator('[data-door="code"]').click();
  await expect(page.locator('[data-step="code"]')).toBeVisible();
  await expect(page.locator('[data-step="email"]')).toHaveCount(0);
  await expect(page.getByLabel('Digit 1')).toBeFocused();

  await page.getByLabel('Digit 1').fill('1');
  await page.getByLabel('Digit 2').fill('1');
  await page.getByLabel('Digit 3').fill('1');
  await page.getByLabel('Digit 4').fill('1');
  await page.getByLabel('Digit 5').fill('1');
  await page.getByLabel('Digit 6').fill('1');
  await expect(page.locator('p[role="alert"]')).toHaveText('That code is not right');

  await page.getByLabel('Digit 1').fill('000000');
  await expect(page).toHaveURL(/\/tasks$/);
});

test('axe · sign-in', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await open(page, '/sign-in');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
  ).toEqual([]);
});

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · sign-in · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      await open(page, '/sign-in');
      await expect(page.getByLabel('Work email')).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: `tests/e2e/screenshots/sign-in-${theme}-${width}.png` });
    });
  }
}
