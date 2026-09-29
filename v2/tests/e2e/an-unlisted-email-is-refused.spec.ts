import { expect, test } from '@playwright/test';
import { logOf, mailsTo, sendCode, unlistedEmail } from './support/stack';

// P3-2 · §4 step 1: sign-ups are off — an email nobody allowed gets no code, only the line, and the attempt is logged.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-codes-for-anyone".
test('an unlisted email is refused', async ({ page }) => {
  const email = unlistedEmail();
  await page.goto('/sign-in');
  await sendCode(page, email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This email is not on the list — ask an admin');
  await expect(page.getByLabel('Digit 1 of 6')).toHaveCount(0);
  expect(await mailsTo(email)).toHaveLength(0);
  expect(await logOf(email)).toEqual(['not_listed']);
});
