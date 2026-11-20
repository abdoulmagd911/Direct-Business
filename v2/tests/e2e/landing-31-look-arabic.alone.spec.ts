/**
 * Landing 31 · the look bar in Arabic (right to left): the six key screens × the five themes, at 1,440 px and at
 * 375 px — the page wears the theme, reads right to left, nothing scrolls sideways and no word is under 12 px; and the
 * sign-in page is layout A in Arabic, its heading's pill in the deep orange. Arabic is a switch of the whole app, so
 * this runs alone. Sabotages: tests/sabotage/landing-31-themes.mjs. Every value is made up.
 */
import { expect, test } from '@playwright/test';
import { withArabicOn } from './support/arabic';
import { smallWords, walkLook } from './support/look';
import { makePerson, signIn, sql } from './support/stack';

for (const width of [1440, 375]) {
  test(`the six key screens in the five themes — Arabic, ${width} px`, async ({ page }) => {
    test.setTimeout(420_000);
    const admin = await makePerson({ admin: true });
    await withArabicOn(admin.id, 'Made-up reason', async () => {
      await signIn(page, admin.email, '/my-day');
      await sql(
        `insert into core.person_profile (person_id, created_by, locale) values ($1, $1, 'ar')
           on conflict (person_id) do update set locale = 'ar'`,
        [admin.id],
      );
      await page.context().addCookies([{ name: 'v2.locale', value: 'ar', url: new URL(page.url()).origin }]);
      await walkLook(page, admin.id, width, 'rtl');
    });
  });

  test(`sign-in is layout A in Arabic at ${width} px`, async ({ page, baseURL }) => {
    const admin = await makePerson({ admin: true });
    await withArabicOn(admin.id, 'Made-up reason', async () => {
      await page.context().addCookies([{ name: 'v2.locale', value: 'ar', url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sign-in');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const pill = page.locator('[data-door-heading] .door-heading-pill');
      await expect(pill, 'the pill holds the Arabic word').toHaveText('مساحة العمل');
      expect(await pill.evaluate((e) => getComputedStyle(e).backgroundColor), 'the pill is the deep orange').toBe(
        'rgb(200, 70, 12)',
      );
      await expect(page.locator('[data-door-card]')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
      expect(await smallWords(page), 'no word is under 12 px').toEqual([]);
    });
  });
}
