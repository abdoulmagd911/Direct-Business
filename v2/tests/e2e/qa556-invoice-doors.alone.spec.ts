/**
 * QA-556: New invoice is offered at all three doors to a person with Full on Finance — the desktop Create menu, Ctrl K
 * and the phone's floating + — and lands on /finance/new; a person with Finance at View gets no Invoice at any of them
 * (and still gets the other items, so the absence is the level and not an empty menu). Each case runs in English and in
 * Arabic. It runs alone: turning Arabic on is an app setting that reaches everyone (ACC-129), so it is switched on for
 * the length of this file and off again. Every person is made up.
 * Sabotage: tests/sabotage/qa556.mjs "finance-page-not-built".
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setPrefs } from './helpers';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

type Words = { top: { create: string }; create: { invoice: string } };
/** The words as the catalogs spell them, so the spec holds the screen to the catalog in each language. */
const catalog = (code: 'en' | 'ar') =>
  JSON.parse(readFileSync(join(process.cwd(), 'messages', `${code}.json`), 'utf8')) as Words;
const LANGS = [
  { code: 'en', words: catalog('en') },
  { code: 'ar', words: catalog('ar') },
] as const;

let admin: TestPerson;

test.beforeAll(async () => {
  admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: QA-556 specs', $1)`,
    [admin.id],
  );
});

test.afterAll(async () => {
  await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
});

/** A member with Finance at View: Create still offers their other items, never Invoice. */
async function viewOnlyOnFinance(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
     values ($1, 'finance', 'view', 'Made-up: view only on Finance (QA-556)', $1)`,
    [person.id],
  );
  return person;
}

for (const lang of LANGS) {
  const create = lang.words.top.create;
  const invoice = lang.words.create.invoice;

  test.describe(`in ${lang.code}`, () => {
    test(`Full on Finance: the desktop Create menu, Ctrl K and the phone + all offer Invoice, which opens /finance/new`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, admin.email, '/my-day');
      await hydrated(page);
      // the language is chosen after signing in: the sign-in helper types into the English form
      await setPrefs(context, { locale: lang.code });
      await page.goto('/my-day');
      await hydrated(page);
      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);

      // 1 · the desktop Create menu
      await page.locator('[data-create]').click();
      const item = page.locator('[data-create-item="invoice"]');
      await expect(item, 'Create offers Invoice').toBeVisible();
      await expect(item).toHaveText(invoice);
      await item.click();
      await expect(page).toHaveURL(/\/finance\/new$/);
      await hydrated(page);
      await expect(page.locator('[data-new-invoice]')).toBeVisible();

      // 2 · Ctrl K
      await page.goto('/my-day');
      await hydrated(page);
      await page.keyboard.press('Control+k');
      const palette = page.locator('[data-command-palette]');
      await palette.getByRole('combobox').fill(invoice);
      const option = palette.getByRole('option', { name: `${create} · ${invoice}`, exact: true });
      await expect(option, 'Ctrl K offers Invoice').toBeVisible();
      await option.click();
      await expect(page).toHaveURL(/\/finance\/new$/);

      // 3 · the phone's floating +
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/my-day');
      await hydrated(page);
      await page.locator('[data-create-floating]').click();
      const phoneItem = page.locator('[data-create-item="invoice"]');
      await expect(phoneItem, 'the + offers Invoice').toBeVisible();
      await phoneItem.click();
      await expect(page).toHaveURL(/\/finance\/new$/);
    });

    test(`View on Finance: no Invoice at any of the three doors, and the other items are still there`, async ({
      page,
      context,
    }) => {
      const person = await viewOnlyOnFinance();
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, person.email, '/my-day');
      await hydrated(page);
      await setPrefs(context, { locale: lang.code });
      await page.goto('/my-day');
      await hydrated(page);
      await expect(page.locator('html')).toHaveAttribute('lang', lang.code);

      await page.locator('[data-create]').click();
      await expect(page.locator('[data-create-item="client"]'), 'Create still offers other items').toBeVisible();
      await expect(page.locator('[data-create-item="invoice"]'), 'no Invoice in Create').toHaveCount(0);
      await page.keyboard.press('Escape');

      await page.keyboard.press('Control+k');
      const palette = page.locator('[data-command-palette]');
      await palette.getByRole('combobox').fill(invoice);
      await expect(palette.getByRole('option', { name: `${create} · ${invoice}`, exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/my-day');
      await hydrated(page);
      await page.locator('[data-create-floating]').click();
      await expect(page.locator('[data-create-item="client"]'), 'the + still offers other items').toBeVisible();
      await expect(page.locator('[data-create-item="invoice"]'), 'no Invoice in the +').toHaveCount(0);
    });
  });
}
