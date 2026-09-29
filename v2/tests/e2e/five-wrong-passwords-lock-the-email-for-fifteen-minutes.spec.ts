import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD, logOf, makePerson } from './support/stack';

// V172 · too many tries (the 17:22 audit): Supabase's own limit sees the app server's address, not the person's, so the
// database counts wrong passwords per e-mail. Four are refused as wrong; the fifth within fifteen minutes locks the
// e-mail for fifteen minutes and says so in the sign-in page's words — and then the right password is refused the
// same way, logged, never tried. Every value is made up. SQL: LOCK-01. Sabotage: tests/sabotage/e2e-sign-in.mjs
// "e2e-a-locked-email-reads-as-a-broken-server".
test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const refusal = (page: Page) => page.getByRole('main').getByRole('alert');

async function tryPassword(page: Page, email: string, password: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('five wrong passwords lock the e-mail for fifteen minutes, the right one included', async ({ page }) => {
  const person = await makePerson();
  await page.goto('/sign-in');
  for (let n = 1; n <= 4; n++) {
    await tryPassword(page, person.email, `Not-the-password-${n}`);
    await expect.poll(async () => (await logOf(person.email)).length, 'each try is logged').toBe(n);
    await expect(refusal(page)).toHaveText(
      "That email and password don't match. Try again or ask your admin to reset it.",
    );
  }
  await tryPassword(page, person.email, 'Not-the-password-5');
  await expect(refusal(page), "the fifth locks it, in the page's words").toHaveText(
    'Too many attempts. Try again in 15 minutes or ask your admin.',
  );
  await tryPassword(page, person.email, TEST_PASSWORD);
  await expect
    .poll(async () => (await logOf(person.email)).at(-1), 'the right password is refused, logged')
    .toBe('locked');
  await expect(refusal(page), 'and the right password is refused in the same words').toHaveText(
    'Too many attempts. Try again in 15 minutes or ask your admin.',
  );
  await expect(page).toHaveURL(/\/sign-in/);
  expect(await logOf(person.email)).toEqual([
    'wrong_password',
    'wrong_password',
    'wrong_password',
    'wrong_password',
    'wrong_password',
    'locked',
  ]);
});
