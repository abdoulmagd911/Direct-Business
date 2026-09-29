import { expect, test } from '@playwright/test';
import { callAs, deviceOf, makePerson, signIn } from './support/stack';

// P3-2 · V74: from one device a person signs another out (My profile → Devices calls api.device_sign_out); that device
// is refused on its next request, while the first stays signed in. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-refused-devices-not-told-why".
test('signing out a device from another refuses that device on its next request', async ({ browser }) => {
  const person = await makePerson();
  const laptop = await browser.newContext();
  const phone = await browser.newContext();
  const laptopPage = await laptop.newPage();
  const phonePage = await phone.newPage();
  await signIn(laptopPage, person.email, '/my-day');
  await signIn(phonePage, person.email, '/my-day');

  const answer = await callAs(laptop, 'device_sign_out', { p_device: await deviceOf(phone) });
  expect(answer).toEqual({ status: 200, body: 1 });

  await phonePage.reload();
  await expect(phonePage).toHaveURL(/\/sign-in\?/);
  await expect(phonePage.getByRole('main').getByRole('alert')).toHaveText('This device was signed out — sign in again');

  await laptopPage.reload();
  await expect(laptopPage.getByTestId('address')).toHaveText('/my-day');
  await laptop.close();
  await phone.close();
});
