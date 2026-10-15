import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, type TestPerson } from './support/stack';

// QA-561: the real Sign out button, clicked, lands on the sign-in page with nothing of the person left on screen — the
// profile chip at 1,440 px and More at 375 px. The redirect after the form's POST is a relative address: an absolute
// one built from the server's own host (localhost under `next start`) left the page where the browser was not, and the
// CSP's form-action 'self' blocked it — the session ended on the server while the screen kept the person's data.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-sign-out-redirects-to-the-server-host".

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function signedOutCleanly(page: Page, person: TestPerson) {
  await expect(page, 'the browser lands on the sign-in page').toHaveURL(/\/sign-in(\?|$)/);
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }).or(page.getByRole('button', { name: 'Send code' })),
  ).toBeVisible();
  await expect(page.getByText(person.name), 'nothing of the person is left on screen').toHaveCount(0);
  // the session is gone too: their first page sends them back to sign in
  await page.goto('/my-day');
  await expect(page).toHaveURL(/\/sign-in(\?|$)/);
}

test('the profile chip at 1,440 px signs out to the sign-in page with nothing left', async ({ page }) => {
  const person = await makePerson();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, person.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('[data-profile-chip]')).toContainText(person.name);

  await page.locator('[data-profile-chip]').click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await signedOutCleanly(page, person);
});

test('More at 375 px signs out to the sign-in page with nothing left', async ({ page }) => {
  const person = await makePerson();
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, person.email, '/my-day');
  await hydrated(page);

  await page.locator('[data-bottom-more]').click();
  const sheet = page.locator('[data-more-sheet]');
  await expect(sheet.locator('[data-more-sign-out]')).toBeVisible();
  await sheet.locator('[data-more-sign-out]').click();
  await signedOutCleanly(page, person);
});
