import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// P3-2 · §4 step 7: a deep link opened signed out goes through the sign-in page and comes back to the same address,
// query included. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-deep-links-forget-where".
test('a signed-out deep link returns to the same address after sign-in', async ({ page }) => {
  const person = await makePerson();
  await page.goto('/tasks/some-task?tab=files');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Ftasks%2Fsome-task%3Ftab%3Dfiles$/);
  await signIn(page, person.email, '/tasks/some-task?tab=files');
  await expect(page).toHaveURL(/\/tasks\/some-task\?tab=files$/);
  await expect(page.getByTestId('address')).toHaveText('/tasks/some-task');
});
