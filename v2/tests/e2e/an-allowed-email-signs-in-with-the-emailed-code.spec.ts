import { expect, test } from '@playwright/test';
import { DOOR_SENDS_MAIL, logOf, makePerson, signIn, sql } from './support/stack';

// P3-2 · V59, V166: an allowed email signs in through the door the page offers — the password, or the emailed 6-digit
// code from the mail catcher under SIGN_IN_METHOD=code — the device is registered (V74) and the sign-in is logged: the
// code door logs the code it sent, the password door's pre-check logs refusals only. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-sign-in-forgets-the-device".
test('an allowed email signs in with the emailed code', async ({ page }) => {
  const person = await makePerson();
  await signIn(page, person.email);
  await expect(page.getByTestId('address')).toHaveText('/my-day');
  await page.locator('[data-profile-chip]').click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await logOf(person.email)).toEqual(DOOR_SENDS_MAIL ? ['code_sent', 'ok'] : ['ok']);
  const devices = await sql(`select 1 from core.device_session where person_id = $1 and signed_out_at is null`, [
    person.id,
  ]);
  expect(devices).toHaveLength(1);
});
