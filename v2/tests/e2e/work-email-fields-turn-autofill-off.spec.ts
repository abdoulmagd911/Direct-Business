/**
 * QA-200 (W21): the browser must not fill a saved login into the Work email of Add person or of a record's Add email —
 * both fields turn autofill off, as every other field of the person forms does. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "add-person-email-allows-autofill".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test("Add person's Work email and a record's Add email turn autofill off (QA-200)", async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const other = await makePerson();
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  await page.locator('[data-person-add]').click();
  await expect(
    page.getByRole('dialog').getByLabel('Work email'),
    "Add person's Work email turns autofill off",
  ).toHaveAttribute('autocomplete', 'off');
  await page.keyboard.press('Escape');
  await page.goto(`/people/${other.id}`);
  await hydrated(page);
  await page.locator('[data-email-add]').first().click();
  await expect(
    page.getByRole('dialog').getByLabel('Work email'),
    "Add email's field turns autofill off",
  ).toHaveAttribute('autocomplete', 'off');
});
