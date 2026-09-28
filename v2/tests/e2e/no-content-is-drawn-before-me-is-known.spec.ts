import { expect, test } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

// P3-2 · A5: nothing inside the app is drawn before api.me() has answered — not for a signed-out visitor, and not for
// a session the database now refuses: every response on the way (the page, its data stream) carries no content, only
// the way to the sign-in page. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-gate-draws-first".
const CONTENT = 'data-testid="address"';

test('no content is drawn before me is known', async ({ page, request }) => {
  const signedOut = await request.get('/partners/7', { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers()['location']).toMatch(/^\/sign-in\?next=%2Fpartners%2F7$/);
  expect(await signedOut.text()).not.toContain('/partners/7<');

  const person = await makePerson();
  await signIn(page, person.email, '/partners/7');
  await expect(page.getByTestId('address')).toHaveText('/partners/7');
  await sql(`update core.person set can_sign_in = false where id = $1`, [person.id]);

  for (const headers of [{}, { rsc: '1' }] as Record<string, string>[]) {
    const refused = await page.request.get('/partners/8', { maxRedirects: 0, headers });
    const body = await refused.text();
    expect(body, 'a refused session gets no content').not.toContain(CONTENT);
    expect(body, 'a refused session gets no content').not.toContain('/partners/8');
  }

  const bodies: string[] = [];
  page.on('response', async (r) => {
    if (r.request().resourceType() === 'document' || r.headers()['content-type']?.includes('text/x-component'))
      bodies.push(await r.text().catch(() => ''));
  });
  await page.goto('/partners/9');
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Your account is switched off');
  for (const body of bodies) expect(body, 'a refused session gets no content').not.toContain('/partners/9<');
});
