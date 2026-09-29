/** Screenshots of the P3-5 screens: My profile, Organization & access, a Settings group, a person's record page, Activity — four themes at 1,500 and 400 px. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { THEMES, fitToPage, setPrefs, shot } from './helpers';
import { makePerson, signIn } from './support/stack';

const SCREENS: [string, (id: string) => string][] = [
  ['profile', () => '/profile'],
  ['settings-org', () => '/settings/org'],
  ['settings-work', () => '/settings/work'],
  ['person', (id) => `/people/${id}`],
  ['activity', () => '/activity'],
];

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · P3-5 · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      const admin = await makePerson({ admin: true });
      await signIn(page, admin.email, '/profile');
      for (const [name, path] of SCREENS) {
        await page.goto(path(admin.id));
        await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
        await expect(page.locator('h1').first()).toBeVisible();
        await page.setViewportSize({ width, height: 900 });
        await fitToPage(page, width);
        await page.screenshot({ path: shot(`${name}-${theme}-${width}`) });
      }
    });
  }
}

test('axe · the P3-5 screens', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/profile');
  for (const [, path] of SCREENS) {
    await page.goto(path(admin.id));
    await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(
      results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${path(admin.id)} ${v.id}`),
    ).toEqual([]);
  }
});
