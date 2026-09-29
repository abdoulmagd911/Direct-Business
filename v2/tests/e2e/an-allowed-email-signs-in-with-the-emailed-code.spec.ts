import { expect, test } from '@playwright/test';
import { logOf, makePerson, signIn, sql } from './support/stack';

// P3-2 · V59: the emailed 6-digit code is the door. An allowed email gets a code from the mail catcher, the code signs
// in, the device is registered (V74) and the sign-in is logged. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-sign-in-forgets-the-device".
test('an allowed email signs in with the emailed code', async ({ page }) => {
  const person = await makePerson();
  await signIn(page, person.email);
  await expect(page.getByTestId('address')).toHaveText('/my-day');
  await page.locator('[data-profile-chip]').click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await logOf(person.email)).toEqual(['code_sent', 'ok']);
  const devices = await sql(`select 1 from core.device_session where person_id = $1 and signed_out_at is null`, [
    person.id,
  ]);
  expect(devices).toHaveLength(1);
});
