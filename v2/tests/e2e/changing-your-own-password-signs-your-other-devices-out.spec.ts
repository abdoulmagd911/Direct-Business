import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD, makePerson, signIn, sql } from './support/stack';

// ACC-021 · V166: My profile → Change password signs every other device of the person out at once, as their own
// sign-out, and the change is logged as theirs; the device that changed it stays in. Made up.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-own-password-keeps-the-other-devices".
test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('changing your own password signs your other devices out', async ({ browser }) => {
  const person = await makePerson();
  const hereCtx = await browser.newContext();
  const here = await hereCtx.newPage();
  const thereCtx = await browser.newContext();
  const there = await thereCtx.newPage();
  await signIn(there, person.email, '/tasks');
  await signIn(here, person.email, '/profile');
  await hydrated(here);

  const changed = `Changed-${Date.now().toString(36)}-pass`;
  await here.locator('[data-password-current]').fill(TEST_PASSWORD);
  await here.locator('[data-password-new]').fill(changed);
  await here.locator('[data-password-again]').fill(changed);
  await here.locator('[data-password-save]').click();
  await expect(here.locator('[data-sonner-toast]', { hasText: 'Password changed' }).first()).toBeVisible();

  await here.goto('/tasks');
  await expect(here.getByTestId('address'), 'this device stays in').toHaveText('/tasks');
  await there.reload();
  await expect(there, 'the other device is signed out').toHaveURL(/\/sign-in\?/);
  await expect(there.getByRole('main').getByRole('alert')).toHaveText('This device was signed out — sign in again');
  const logged = await sql(
    `select 1 from audit.request where actor_id = $1 and label_key = 'person_auth.password_changed'`,
    [person.id],
  );
  expect(logged, "logged as the person's own").toHaveLength(1);
  await hereCtx.close();
  await thereCtx.close();
});
