/**
 * V654 — the notifications panel (the bell) closes when the page changes, on an outside tap and on Escape, at 375 px
 * (bottom bar) and 1,440 px (drawer), in English and Arabic. Every value is made up.
 * Sabotages: tests/sabotage/screens.mjs "bell-stays-open-on-a-new-page".
 */
import { expect, test, type Page } from '@playwright/test';
import { setPrefs } from './helpers';
import { withArabicOn } from './support/arabic';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [375, 1440]) {
  for (const locale of ['en', 'ar'] as const) {
    test(`the bell panel closes on a page change, an outside tap and Escape — ${width} px, ${locale}`, async ({
      page,
      context,
    }) => {
      const admin = await makePerson({ admin: true });
      const run = async () => {
        await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
        // Sign in first, while the door is still in English: setPrefs({ locale: 'ar' }) before signIn makes the door
        // render in Arabic (F205/D12 honours the locale cookie), so signIn's getByLabel('Work email') can never match
        // and times out. Same sign-in-first-then-locale pattern as
        // dates-in-arabic-keep-their-letters-joined.alone.spec.ts — and the ar legs run with the Arabic switch on
        // (withArabicOn), which signed-in language needs (ACC-139): the cookie alone is forced back to English.
        await signIn(page, admin.email, '/my-day');
        await hydrated(page);
        if (locale !== 'en') {
          await setPrefs(context, { locale });
          await page.reload();
          await hydrated(page);
          await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        }
        const panel = page.locator('[data-notifications-panel]');
        const bell = page.locator('[data-bell]');

        // go to a second page by a link in the shell, so the history has two pages
        await page
          .locator(width < 640 ? '[data-bottom-bar] a[href="/tasks"]' : '[data-drawer] a[href="/tasks"]')
          .click();
        await page.waitForURL('**/tasks');
        await hydrated(page);

        // open, then Back: the page changes under the open panel, which closes
        await bell.click();
        await expect(panel).toBeVisible();
        await page.goBack();
        await page.waitForURL('**/my-day');
        await expect(panel, 'closed by the page change').toHaveCount(0);

        // an outside tap closes it (on a phone the panel fills the width, so there is no outside to tap)
        if (width >= 640) {
          await bell.click();
          await expect(panel).toBeVisible();
          await page.mouse.click(locale === 'ar' ? width - 100 : 100, 400);
          await expect(panel, 'closed by an outside tap').toHaveCount(0);
        }

        // Escape closes it
        await bell.click();
        await expect(panel).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(panel, 'closed by Escape').toHaveCount(0);
      };
      // the en legs pass unchanged and need no wrapper; the ar legs run with the Arabic switch on.
      if (locale === 'ar') await withArabicOn(admin.id, 'Made-up reason: Arabic bell', run);
      else await run();
    });
  }
}
