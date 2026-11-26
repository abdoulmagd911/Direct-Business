/**
 * Landing 34 · Arabic, through the screen (the test round of 19 Nov, items 11 and 12; the rule of Landing 34b). It
 * switches the app-wide Arabic setting, so it runs alone and under the Arabic specs' one database lock.
 *
 * The rule (src/core/prefs/effective.ts, personLocale): Arabic off → everyone reads English. Arabic on → a signed-in
 * person reads the language they SAVED ("Your language" on the Arabic card, the profile menu, My profile), and a
 * person who never chose reads ARABIC. The cookie decides nothing for a signed-in person.
 *
 * Both people here have NO saved language (every other made-up person has English saved — support/stack.ts).
 *  1. Off: English, and no language choice — not on the Arabic card, not in the profile menu. The card says what the
 *     switch does.
 *  2. The admin turns Arabic On with the real switch: after the save their own screen IS Arabic, at once and without
 *     choosing — right to left, My day and Finance in Arabic, the tab titles in Arabic, the Finance figures the same
 *     as in English digit for digit, in Western digits. Nothing was saved as their choice. The card shows the choice.
 *  3. A second person with no saved language signs in on a fresh browser: Arabic, without choosing.
 *  4. The admin chooses English on the card: English while Arabic stays on — after a reload and after a fresh sign-in
 *     too — and the second person still reads Arabic. Choosing العربية in the profile menu: Arabic again.
 *  5. Saving Arabic back to Off: English for everyone at once, whatever they saved; Settings does not crash; the
 *     choice is gone.
 * The setting is put back to Off at the end, pass or fail. Every value is made up.
 * Sabotage: tests/sabotage/landing-34-e2e.mjs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  DESKTOP,
  arabicIsMine,
  arabicIsOn,
  doorOf,
  hydrated,
  seedFinanceMonth,
  signedInAs,
  staffAs,
  tag,
} from './support/landing-34';
import { savedLanguage, signIn } from './support/stack';

const ARABIC_CARD = '[data-setting="app.arabic_enabled"]';
const TILES = ['revenue', 'cost', 'profit', 'provisional'] as const;

/** What the Arabic card says the switch does, as each catalog spells it. */
const says = (code: 'en' | 'ar') =>
  (
    JSON.parse(readFileSync(join(process.cwd(), 'messages', `${code}.json`), 'utf8')) as {
      settings: { language: { whatArabicDoes: string } };
    }
  ).settings.language.whatArabicDoes;

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

/** The page is in this language, in its direction (the switch and a choice both load the page once more). */
async function reads(page: Page, code: 'en' | 'ar', why: string) {
  const html = page.locator('html');
  await expect(html, why).toHaveAttribute('lang', code, { timeout: 45_000 });
  await expect(html, `${why} — ${code === 'ar' ? 'right to left' : 'left to right'}`).toHaveAttribute(
    'dir',
    code === 'ar' ? 'rtl' : 'ltr',
  );
  await hydrated(page);
}

test('Arabic On is the workspace’s language for everyone who did not choose, a saved choice wins, and Off is English for all', async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000);
  await arabicIsMine(async () => {
    // two people who never chose a language
    const admin = await staffAs('admin', { locale: null });
    const colleague = await staffAs('member', { locale: null });
    expect(await savedLanguage(admin.id), 'the admin starts with no saved language').toBeNull();
    expect(await savedLanguage(colleague.id), 'the colleague starts with no saved language').toBeNull();
    await page.setViewportSize(DESKTOP);
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const month = await seedFinanceMonth(doorOf(page.context()), admin);

    // the figures in English
    await open(page, month.url);
    await expect(page.locator('html'), 'while Arabic is off the app is English').toHaveAttribute('lang', 'en');
    const english = await figures(page);
    expect(english['revenue · provisional'], 'the English Provisional amount is the seeded one').toBe('1,500');

    // 1 · Off: English, no language choice anywhere, and the card says what the switch does
    await open(page, '/settings/app');
    const card = page.locator(ARABIC_CARD);
    await expect(card, 'the Arabic card is on Settings → App').toBeVisible();
    await expect(card.locator('[data-setting-says]'), 'the card says what Arabic does, while it is off').toHaveText(
      says('en'),
    );
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

    // 2 · On, through the real switch: the admin's own screen is Arabic after the save, without choosing
    await flipArabic(page, `Made-up reason ${tag()}: Arabic on`);
    await expect
      .poll(arabicIsOn, { message: 'the switch saved Arabic On in the database', timeout: 20_000 })
      .toBe(true);
    await reads(page, 'ar', 'after the save the app is Arabic for the admin who chose no language');
    expect(await savedLanguage(admin.id), 'turning Arabic on saved no language as the admin’s own choice').toBeNull();
    await expect(crashed(page), 'Settings is still drawn after the save').toHaveCount(0);
    const choice = card.locator('[data-language-choice]');
    await expect(choice, 'the card shows the language choice at once').toBeVisible({ timeout: 30_000 });
    await expect(choice.locator('[data-language-option="ar"]'), 'العربية is offered').toHaveText('العربية');
    await expect(choice.locator('[data-language-option="en"]'), 'English is offered').toHaveText('English');
    await expect(choice.locator('[data-language-option="ar"]'), 'العربية is the language in use').toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(choice.locator('[data-language-option="en"]'), 'English is not the one in use').toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(card.locator('[data-setting-says]'), 'the card says what Arabic does, in Arabic').toHaveText(
      says('ar'),
    );
    await page.locator('[data-profile-chip]').click();
    const menu = page.locator('[data-language-menu]');
    await expect(menu, 'the profile menu shows the language group').toBeVisible();
    await expect(menu.locator('[data-language-item="en"]'), 'the menu offers English').toHaveText('English');
    await expect(menu.locator('[data-language-item="ar"]'), 'the menu offers العربية').toHaveText('العربية');
    await expect(menu.locator('[data-language-item="ar"]'), 'the menu marks العربية as in use').toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');

    const html = page.locator('html');
    await open(page, '/my-day');
    await expect(html, 'My day is in Arabic').toHaveAttribute('lang', 'ar');
    await expect(html, 'My day reads right to left').toHaveAttribute('dir', 'rtl');
    await expect(page, 'the tab title is in Arabic').toHaveTitle('يومي · دايركت للشركات');
    await expect(page.locator('[data-todays-three] h2').first(), "My day's headings are in Arabic").toContainText(
      'ثلاث مهام اليوم',
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

    // 3 · a second person with no saved language signs in on a fresh browser: Arabic, without choosing
    const second = await signedInAs(browser, colleague);
    try {
      await reads(second.page, 'ar', 'a person with no saved language signs in to Arabic once Arabic is on');
      await expect(second.page, "the colleague's tab title is in Arabic").toHaveTitle('يومي · دايركت للشركات');
      expect(await savedLanguage(colleague.id), 'signing in saved no language for the colleague').toBeNull();

      // 4 · the admin chooses English on the card: English while Arabic stays on
      await open(page, '/settings/app');
      await expect(html, 'Settings is in Arabic before the choice').toHaveAttribute('lang', 'ar');
      await choice.locator('[data-language-option="en"]').click();
      await reads(page, 'en', 'choosing English draws the app in English while Arabic stays on');
      expect(await arabicIsOn(), 'Arabic is still on for the workspace').toBe(true);
      await expect
        .poll(() => savedLanguage(admin.id), { message: 'the choice is saved in the admin’s profile' })
        .toBe('en');
      await expect(choice.locator('[data-language-option="en"]'), 'English is now the one in use').toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(card.locator('[data-setting-says]'), 'the card says what Arabic does, in English').toHaveText(
        says('en'),
      );
      await page.reload();
      await reads(page, 'en', 'the chosen English stays after a reload');
      await open(page, '/my-day');
      await expect(html, 'My day is English for the person who chose English').toHaveAttribute('lang', 'en');
      await expect(page.locator('[data-todays-three] h2').first(), 'My day’s headings are in English').toContainText(
        "Today's Three",
      );
      // a fresh sign-in on a browser that holds no cookie of theirs
      const fresh = await signedInAs(browser, admin);
      try {
        await reads(fresh.page, 'en', 'the chosen English stays after a fresh sign-in');
        await fresh.page.reload();
        await reads(fresh.page, 'en', 'and after a reload of that fresh sign-in');
      } finally {
        await fresh.context.close();
      }
      // one person's choice is theirs alone
      await second.page.reload();
      await reads(second.page, 'ar', 'the colleague who chose nothing still reads Arabic');

      // … and العربية again, from the profile menu
      await page.locator('[data-profile-chip]').click();
      await expect(menu, 'the profile menu shows the language group to the person who chose English').toBeVisible();
      await expect(menu.locator('[data-language-item="en"]'), 'the menu marks English as in use').toHaveAttribute(
        'aria-checked',
        'true',
      );
      await menu.locator('[data-language-item="ar"]').click();
      await reads(page, 'ar', 'choosing العربية in the profile menu draws the app in Arabic again');
      await expect
        .poll(() => savedLanguage(admin.id), { message: 'the Arabic choice is saved in the admin’s profile' })
        .toBe('ar');
      await expect(page, 'the tab title is in Arabic again').toHaveTitle('يومي · دايركت للشركات');

      // 5 · back to Off: English for everyone at once, Settings stays up, the choice goes
      await open(page, '/settings/app');
      await expect(
        card.locator('[data-language-choice]'),
        'the choice is on the card while Arabic is on',
      ).toBeVisible();
      await flipArabic(page, `Made-up reason ${tag()}: Arabic off`);
      await expect
        .poll(arabicIsOn, { message: 'the switch saved Arabic Off in the database', timeout: 20_000 })
        .toBe(false);
      await reads(page, 'en', 'after saving Off the app is English, though this person saved Arabic');
      expect(await savedLanguage(admin.id), 'the saved Arabic is kept for when Arabic is on again').toBe('ar');
      await expect(crashed(page), 'saving Arabic back to Off does not take Settings down').toHaveCount(0);
      await expect(card, 'the Arabic card is still drawn after saving Off').toBeVisible();
      await expect(
        card.locator('[data-language-choice]'),
        'the language choice disappears once Arabic is off',
      ).toHaveCount(0, { timeout: 30_000 });
      await expect(card.locator('[data-setting-says]'), 'the card still says what Arabic does, in English').toHaveText(
        says('en'),
      );
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

      // the colleague who never chose: English too, on their next page
      await second.page.goto('/my-day');
      await reads(second.page, 'en', 'once Arabic is off the colleague who chose nothing reads English');
      await expect(second.page.locator('[data-todays-three] h2').first(), 'their My day is in English').toContainText(
        "Today's Three",
      );
    } finally {
      await second.context.close();
    }
  });
});
