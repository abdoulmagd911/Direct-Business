import { expect, test } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

// P3-2 · §4 step 7: a page left open keeps asking in the background (the router prefetches its links). Once its person
// is switched off, such a request is refused too — but it never clears the session, or the person's next real visit
// would find no session and never be told why (it happened on CI: org.spec's switch-off lost its line). The real visit
// is refused with the reason, and only then is the session cleared. Sabotage: tests/sabotage/e2e-sign-in.mjs
// "e2e-a-prefetch-signs-the-browser-out".
test('a background request never loses the reason for a refusal', async ({ page }) => {
  const person = await makePerson();
  await signIn(page, person.email, '/tasks');
  await expect(page.getByTestId('address')).toHaveText('/tasks');
  await sql(`update core.person set can_sign_in = false where id = $1`, [person.id]);

  // what the router does for a link on the open page, after the switch-off (Next adds its own _rsc on the way)
  const prefetch = await page.request.get('/auth/sign-out?next=%2Fmy-day', {
    headers: { RSC: '1', 'Next-Router-Prefetch': '1' },
  });
  expect(prefetch.url(), 'the background request is refused too').toContain('reason=switched_off');

  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByRole('main').getByRole('alert'), 'the real visit is still told why').toHaveText(
    'Your account is switched off',
  );
  await page.goto('/tasks');
  await expect(page, 'and then the session is gone').toHaveURL(/\/sign-in\?next=%2Ftasks$/);
});
