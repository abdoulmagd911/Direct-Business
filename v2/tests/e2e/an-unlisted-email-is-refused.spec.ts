import { expect, test } from '@playwright/test';
import { logOf, mailsTo, sendCode, unlistedEmail } from './support/stack';

// P3-2 · §4 step 1: sign-ups are off — an email nobody allowed gets no code, only the line, and the attempt is logged.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-codes-for-anyone".
// The emailed-code door stays in the code behind SIGN_IN_METHOD=code (owner, 29 Sep 13:50: the door is email + password);
// its promises run when that door is on. password.spec.ts holds the same promises for the password door.
test.skip(process.env.SIGN_IN_METHOD !== 'code', 'the code door is off');

test('an unlisted email is refused', async ({ page }) => {
  const email = unlistedEmail();
  await page.goto('/sign-in');
  await sendCode(page, email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    "This email isn't on the team list. Ask your admin to add you.",
  );
  await expect(page.getByLabel('Digit 1 of 6')).toHaveCount(0);
  expect(await mailsTo(email)).toHaveLength(0);
  expect(await logOf(email)).toEqual(['not_listed']);
});
