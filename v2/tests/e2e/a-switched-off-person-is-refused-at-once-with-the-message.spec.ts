import { expect, test } from '@playwright/test';
import { logOf, mailsTo, makePerson, sendCode, signIn, sql } from './support/stack';

// P3-2 · §4 step 5: a listed person who is switched off gets no code and is told so; a signed-in person switched off
// is refused on their very next request, with the same line. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-codes-for-anyone".
test('a switched-off person is refused at once with the message', async ({ page }) => {
  const off = await makePerson({ canSignIn: false });
  await page.goto('/sign-in');
  await sendCode(page, off.email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Your account is switched off');
  expect(await mailsTo(off.email)).toHaveLength(0);
  expect(await logOf(off.email)).toEqual(['switched_off']);

  const on = await makePerson();
  await signIn(page, on.email, '/tasks');
  await expect(page.getByTestId('address')).toHaveText('/tasks');
  await sql(`update core.person set can_sign_in = false where id = $1`, [on.id]);
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Your account is switched off');
  await expect(page.getByTestId('address')).toHaveCount(0);
});
