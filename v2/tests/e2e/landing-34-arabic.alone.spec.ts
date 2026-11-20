/**
 * Landing 34 · Arabic, through the screen (the test round of 19 Nov, items 11 and 12). It switches the app-wide
 * Arabic setting, so it runs alone and under the Arabic specs' one database lock.
 *  1. While Arabic is Off there is no language choice — not on the Arabic card, not in the profile menu.
 *  2. An admin turns Arabic On in Settings → App with the real switch: at once the card offers "Your language" and
 *     the profile menu a language group.
 *  3. Choosing العربية reloads into Arabic: right to left, My day and Finance in Arabic, the tab title in Arabic,
 *     and the Finance figures the same as in English, digit for digit, in Western digits.
 *  4. Saving Arabic back to Off does not take Settings down; the language choice goes and the app is English again.
 * The setting is put back to Off at the end, pass or fail. Every value is made up.
 * Sabotage: tests/sabotage/landing-34-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  DESKTOP,
  arabicIsMine,
  arabicIsOn,
  doorOf,
  hydrated,
  seedFinanceMonth,
  staffAs,
  tag,
} from './support/landing-34';
import { signIn } from './support/stack';

const ARABIC_CARD = '[data-setting="app.arabic_enabled"]';
const TILES = ['revenue', 'cost', 'profit', 'provisional'] as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

/** The digits of a figure as written ("1,500 SAR" and «1,500 ر.س» are both "1,500"). */
const digits = (s: string) => s.replace(/[^\d.,\-٠-٩۰-۹]/g, '').replace(/^[.,]+|[.,]+$/g, '');

/** Each card's exact figure and its Provisional part, as the digits on the screen. */
async function figures(page: Page): Promise<Record<string, string>> {
  await blocksSettled(page);
  const out: Record<string, string> = {};
  for (const kind of TILES) {
    const tile = page.locator(`[data-finance-tile="${kind}"]`);
    await expect(tile, `the ${kind} card is drawn`).toBeVisible();
    const exact = tile.locator('[data-finance-exact]');
    out[kind] = digits(await ((await exact.count()) ? exact : tile.locator('[data-finance-figure]')).innerText());
    const part = tile.locator('[data-finance-provisional-amount]');
    if (await part.count()) out[`${kind} · provisional`] = digits(await part.innerText());
  }
  out['months · provisional'] = digits(await page.locator('[data-finance-total-provisional]').innerText());
  return out;
}

/** The Arabic card's Change box: flip the switch, give a reason, save. The words are not used: they change language. */
async function flipArabic(page: Page, reason: string) {
  const card = page.locator(ARABIC_CARD);
  await card.locator('[data-setting-change]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('switch').click();
  await dialog.locator('textarea').fill(reason);
  await expect(dialog.locator('[data-setting-save]'), 'a changed value and a reason open Save').toBeEnabled();
  await dialog.locator('[data-setting-save]').click();
  await expect(dialog, 'the box closes once saved').toHaveCount(0, { timeout: 30_000 });
}

/** The crash body — "This page could not be drawn" — by its marks, whatever language it is said in (src/ui/CrashBody.tsx). */
const crashed = (page: Page) => page.locator('[data-state="crashed"], [data-crash-retry], [data-crash-home]');

test('an admin turns Arabic On, picks العربية, reads the same figures, and turns it Off again without a crash', async ({
  page,
}) => {
  test.setTimeout(420_000);
  await arabicIsMine(async () => {
    const admin = await staffAs('admin');
    await page.setViewportSize(DESKTOP);
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const month = await seedFinanceMonth(doorOf(page.context()), admin);

    // the figures in English
    await open(page, month.url);
    await expect(page.locator('html'), 'the app starts in English').toHaveAttribute('lang', 'en');
    const english = await figures(page);
    expect(english['revenue · provisional'], 'the English Provisional amount is the seeded one').toBe('1,500');

    // 1 · Off: no language choice anywhere
    await open(page, '/settings/app');
    const card = page.locator(ARABIC_CARD);
    await expect(card, 'the Arabic card is on Settings → App').toBeVisible();
    await expect(
      card.locator('[data-language-choice]'),
      'no language choice on the card while Arabic is off',
    ).toHaveCount(0);
    await page.locator('[data-profile-chip]').click();
    await expect(page.locator('[data-theme-menu]'), 'the profile menu is open').toBeVisible();
    await expect(
      page.locator('[data-language-menu]'),
      'no language group in the profile menu while Arabic is off',
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    // 2 · On, through the real switch: the choice is offered at once
    await flipArabic(page, `Made-up reason ${tag()}: Arabic on`);
    await expect
      .poll(arabicIsOn, { message: 'the switch saved Arabic On in the database', timeout: 20_000 })
      .toBe(true);
    await expect(page.locator('[data-state="crashed"]'), 'Settings is still drawn after the save').toHaveCount(0);
    const choice = card.locator('[data-language-choice]');
    await expect(choice, 'the card shows the language choice at once').toBeVisible({ timeout: 30_000 });
    await expect(choice.locator('[data-language-option="en"]'), 'English is the language in use').toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(choice.locator('[data-language-option="ar"]'), 'العربية is offered').toHaveText('العربية');
    await page.locator('[data-profile-chip]').click();
    const menu = page.locator('[data-language-menu]');
    await expect(menu, 'the profile menu shows the language group').toBeVisible();
    await expect(menu.locator('[data-language-item="en"]'), 'the menu offers English').toHaveText('English');
    await expect(menu.locator('[data-language-item="ar"]'), 'the menu offers العربية').toHaveText('العربية');
    await page.keyboard.press('Escape');

    // 3 · choosing العربية reloads into Arabic
    await choice.locator('[data-language-option="ar"]').click();
    const html = page.locator('html');
    await expect(html, 'choosing العربية reloads into Arabic').toHaveAttribute('lang', 'ar', { timeout: 45_000 });
    await expect(html, 'Arabic reads right to left').toHaveAttribute('dir', 'rtl');
    await hydrated(page);

    await open(page, '/my-day');
    await expect(html, 'My day stays in Arabic').toHaveAttribute('dir', 'rtl');
    await expect(page, 'the tab title is in Arabic').toHaveTitle('يومي · دايركت للشركات');
    await expect(page.locator('[data-todays-three] h2').first(), "My day's headings are in Arabic").toContainText(
      'ثلاثة اليوم',
    );
    await expect(page.locator('[data-todays-three] [data-three-own]'), "Today's three is in Arabic").toHaveText(
      'من قوائم مهامك أنت',
    );

    await open(page, month.url);
    await expect(html, 'Finance is in Arabic').toHaveAttribute('lang', 'ar');
    await expect(page.locator('#main h1').first(), "Finance's heading is in Arabic").toHaveText('المالية');
    await expect(page, "Finance's tab title is in Arabic").toHaveTitle('المالية · دايركت للشركات');
    const arabic = await figures(page);
    expect(arabic, 'the Finance figures in Arabic equal the English figures, digit for digit').toEqual(english);
    expect(
      Object.values(arabic).filter((v) => /[٠-٩۰-۹]/.test(v)),
      'the figures are in Western digits in Arabic too',
    ).toEqual([]);

    // 4 · back to Off: Settings stays up, the choice goes, the app is English again
    await open(page, '/settings/app');
    await expect(card.locator('[data-language-choice]'), 'the choice is on the card while Arabic is on').toBeVisible();
    await flipArabic(page, `Made-up reason ${tag()}: Arabic off`);
    await expect
      .poll(arabicIsOn, { message: 'the switch saved Arabic Off in the database', timeout: 20_000 })
      .toBe(false);
    await expect(crashed(page), 'saving Arabic back to Off does not take Settings down').toHaveCount(0);
    await expect(card, 'the Arabic card is still drawn after saving Off').toBeVisible();
    await expect(
      card.locator('[data-language-choice]'),
      'the language choice disappears once Arabic is off',
    ).toHaveCount(0, { timeout: 30_000 });
    // the save's own refresh has settled: still no crash
    await page.waitForTimeout(3000);
    await expect(crashed(page), 'Settings is still drawn once the refresh after the save has settled').toHaveCount(0);

    await page.reload();
    await hydrated(page);
    await expect(html, 'the app is English again').toHaveAttribute('lang', 'en');
    await expect(html, 'English reads left to right').toHaveAttribute('dir', 'ltr');
    await expect(page.locator(ARABIC_CARD), 'Settings → App is drawn in English').toBeVisible();
    await expect(crashed(page), 'Settings does not crash on a fresh load with Arabic off').toHaveCount(0);
    await page.locator('[data-profile-chip]').click();
    await expect(page.locator('[data-theme-menu]')).toBeVisible();
    await expect(
      page.locator('[data-language-menu]'),
      'the profile menu drops the language group once Arabic is off',
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});
