/**
 * Landing 31 · five themes and their switcher (the theme-switcher rules board): Light (default), Dark, Direct, Turquoise
 * (opt-in) and System (follows the device, live). The switcher is in three places — My profile → Look (five cards),
 * the profile menu on a PC, and a sheet from More on a phone; a pick changes the whole app at once and is saved to the
 * profile. Before sign-in the page wears the theme last used on the device, or the device's own on a first visit.
 * Primary buttons are the deep orange with white words in every theme; Revenue green is the brief's in Light and
 * Direct and a lifted green in the two dark themes. The sign-in page is layout A: the slate panel, the card, the
 * workspace's name as the heading with its last word in the orange pill.
 * Sabotages: tests/sabotage/landing-31-themes.mjs. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { smallWords } from './support/look';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase();
    // the browser may hand back the short form (#fff): written out in full so the two forms compare equal
    return /^#[0-9a-f]{3}$/.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v;
  }, name);
const stored = async (id: string) =>
  (await sql<{ theme: string | null }>(`select theme from core.person_profile where person_id = $1`, [id]))[0]?.theme;
const FIVE = ['light', 'dark', 'direct', 'turquoise', 'system'];

test('the profile menu on a PC switches the theme at once, keeps the menu open and saves it', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-profile-chip]').click();
  const items = page.locator('[data-theme-menu] [data-theme-item]');
  expect(
    await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-theme-item'))),
    'the menu lists the five themes',
  ).toEqual(FIVE);
  await page.locator('[data-theme-item="turquoise"]').click();
  await expect.poll(() => theme(page), 'the app changes at once').toBe('turquoise');
  await expect(page.locator('[data-theme-menu]'), 'the menu stays open to try another').toBeVisible();
  await expect.poll(() => stored(member.id), 'the profile holds the choice').toBe('turquoise');
  await page.locator('[data-theme-item="direct"]').click();
  await expect.poll(() => theme(page)).toBe('direct');
  await expect.poll(() => stored(member.id), 'a second pick in a row saves too').toBe('direct');
  await page.reload();
  await hydrated(page);
  expect(await theme(page), 'a reload keeps it').toBe('direct');
});

test('on a phone, More → Theme opens the sheet of five rows and a pick changes the app and saves', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-bottom-more]').click();
  await page.locator('[data-more-theme]').click();
  const rows = page.locator('[data-more-theme-sheet] [data-theme-row]');
  await expect(rows, 'five rows').toHaveCount(5);
  const sizes = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...sizes), 'every row is a 44 px target').toBeGreaterThanOrEqual(43.5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'the sheet does not make the page scroll sideways').toBeLessThanOrEqual(0);
  await page.locator('[data-theme-row="dark"]').click();
  await expect.poll(() => theme(page), 'the app changes at once').toBe('dark');
  await expect.poll(() => stored(member.id), 'the profile holds the choice').toBe('dark');
  await expect(page.locator('[data-theme-row="dark"]'), 'the picked row is the checked one').toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.locator('[data-more-theme-back]').click();
  await expect(page.locator('[data-more-sign-out]'), 'Back returns to the More list').toBeVisible();
});

test('System follows the device, live; the buttons and the Revenue green keep the brief’s colours in every theme', async ({
  page,
}) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  const seen: Record<string, { bg: string; primary: string; onPrimary: string; success: string }> = {};
  for (const k of ['dark', 'direct', 'turquoise', 'light']) {
    await page.locator(`[data-theme-card="${k}"]`).click();
    await expect.poll(() => theme(page)).toBe(k);
    seen[k] = {
      bg: await token(page, '--bg'),
      primary: await token(page, '--primary'),
      onPrimary: await token(page, '--on-primary'),
      success: await token(page, '--success'),
    };
    await expect.poll(() => stored(member.id)).toBe(k);
  }
  for (const k of Object.keys(seen)) {
    expect(seen[k]!.primary, `${k}: primary buttons are the deep orange`).toBe('#c8460c');
    expect(seen[k]!.onPrimary, `${k}: with white words`).toBe('#ffffff');
  }
  expect(seen.light!.success, 'Revenue green in Light').toBe('#127a3d');
  expect(seen.direct!.success, 'Revenue green in Direct').toBe('#127a3d');
  expect(seen.dark!.success, 'a lifted green in Dark').not.toBe('#127a3d');
  expect(seen.turquoise!.success, 'a lifted green in Turquoise').not.toBe('#127a3d');
  expect(new Set(Object.values(seen).map((s) => s.bg)).size, 'four drawn themes, four page colours').toBe(4);

  await page.locator('[data-theme-card="system"]').click();
  await expect.poll(() => theme(page)).toBe('system');
  await expect.poll(() => token(page, '--bg'), 'System on a light device is Light').toBe(seen.light!.bg);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() => token(page, '--bg'), 'the device turns dark: the app follows without a reload')
    .toBe(seen.dark!.bg);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => token(page, '--bg'), 'and back').toBe(seen.light!.bg);
  await expect.poll(() => stored(member.id), 'System is saved as itself').toBe('system');
});

test('before sign-in: the device’s own theme on a first visit, then the theme last used here', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/sign-in');
  expect(await theme(page), 'a first visit follows the device').toBe('system');
  const member = await makePerson();
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  await page.locator('[data-theme-card="dark"]').click();
  await expect.poll(() => stored(member.id)).toBe('dark');
  await page.request.post('/auth/sign-out');
  await page.goto('/sign-in');
  expect(await theme(page), 'the sign-in page wears the theme last used on this device').toBe('dark');
});

for (const locale of ['en'] as ('en' | 'ar')[]) {
  for (const width of [375, 1280]) {
    test(`sign-in is layout A in ${locale} at ${width} px: the card, the heading with its pill, nothing cut off`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([{ name: 'v2.locale', value: locale, url: baseURL! }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sign-in');
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      const heading = page.locator('[data-door-heading]');
      await expect(heading).toBeVisible();
      await expect(heading, 'the heading is the workspace’s name').toHaveAccessibleName(
        locale === 'en' ? 'Commercial Workspace' : /.+/,
      );
      const pill = heading.locator('.door-heading-pill');
      await expect(pill, 'its last word sits in the pill').toHaveText(locale === 'en' ? 'Workspace' : 'التجارية');
      const colours = await pill.evaluate((e) => {
        const s = getComputedStyle(e);
        return { bg: s.backgroundColor, fg: s.color };
      });
      expect(colours.bg, 'the pill is the deep orange').toBe('rgb(200, 70, 12)');
      expect(colours.fg, 'with white words').toBe('rgb(255, 255, 255)');
      await expect(page.locator('[data-door-card]')).toBeVisible();
      await expect(page.locator('[data-brand-panel]'), 'the slate panel shows from 1024 px').toBeVisible({
        visible: width >= 1024,
      });
      const button = page.locator('[data-door="password"]');
      const box = await button.boundingBox();
      expect(box!.height, 'the Sign in button is a full 44 px target or more').toBeGreaterThanOrEqual(44);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
      expect(await smallWords(page), 'no words under 12 px').toEqual([]);
    });
  }
}
