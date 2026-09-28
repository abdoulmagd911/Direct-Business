import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// P3-2 · §4 step 7: a deep link opened signed out goes through the sign-in page and comes back to the same address,
// query included. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-deep-links-forget-where".
test('a signed-out deep link returns to the same address after sign-in', async ({ page }) => {
  const person = await makePerson();
  await page.goto('/partners/some-partner?tab=files');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fpartners%2Fsome-partner%3Ftab%3Dfiles$/);
  await signIn(page, person.email, '/partners/some-partner?tab=files');
  await expect(page).toHaveURL(/\/partners\/some-partner\?tab=files$/);
  await expect(page.getByTestId('address')).toHaveText('/partners/some-partner');
});
