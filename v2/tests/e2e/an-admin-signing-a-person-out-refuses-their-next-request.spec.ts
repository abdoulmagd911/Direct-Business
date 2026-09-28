import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// P3-2 · V74: an admin signs a person out (the server route, the database logs it); the person's next request is
// refused. A team member may not do the same. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-refused-devices-not-told-why".
test('an admin signing a person out refuses their next request', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  const adminCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  const memberPage = await memberCtx.newPage();
  await signIn(adminPage, admin.email);
  await signIn(memberPage, member.email, '/tasks');

  const refused = await memberPage.request.post('/auth/admin/sign-out', { data: { person_id: admin.id } });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toEqual({ ok: false, error: { kind: 'PermissionDenied', key: 'access.needs_admin' } });

  const done = await adminPage.request.post('/auth/admin/sign-out', { data: { person_id: member.id } });
  expect(await done.json()).toEqual({ ok: true, signed_out: 1 });

  await memberPage.reload();
  await expect(memberPage).toHaveURL(/\/sign-in\?/);
  await expect(memberPage.getByRole('main').getByRole('alert')).toHaveText(
    'An admin signed this device out — send a new code',
  );
  await adminCtx.close();
  await memberCtx.close();
});
