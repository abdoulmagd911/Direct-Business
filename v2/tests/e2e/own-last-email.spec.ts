/**
 * QA-208 (screen half): an admin's record offers no Remove beside their own last allowed email — removing it would lock
 * them out of the app — while another person's only email, and one's own when there are two, still can be removed.
 * Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "own-last-email-offers-remove".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test("no Remove beside one's own last allowed email; another person's, and one's own second, keep it (QA-208)", async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const other = await makePerson();
  await signIn(page, admin.email, `/people/${admin.id}`);
  await hydrated(page);
  await expect(page.locator(`[data-person-email="${admin.email}"]`)).toBeVisible();
  await expect(
    page.locator(`[data-person-email="${admin.email}"] [data-email-remove]`),
    "no Remove on one's own last email",
  ).toHaveCount(0);

  await page.goto(`/people/${other.id}`);
  await hydrated(page);
  await expect(page.locator(`[data-person-email="${other.email}"] [data-email-remove]`)).toBeVisible();

  const second = `test.e2e-second-${Date.now().toString(36)}@example.test`;
  await sql(`insert into core.person_email (person_id, email, is_primary) values ($1, $2, false)`, [admin.id, second]);
  await page.goto(`/people/${admin.id}`);
  await hydrated(page);
  await expect(page.locator(`[data-person-email="${second}"] [data-email-remove]`)).toBeVisible();
});
