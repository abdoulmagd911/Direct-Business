import { expect, test } from '@playwright/test';
import { attemptSignIn, makePerson, signIn, sql } from './support/stack';

// ACC-100 · V128, V162: switching a person off bans their auth users in the same call (/auth/admin/switch); undoing
// the switch-off through /auth/admin/undo re-syncs Auth — the ban is lifted — and the person signs in again. Made up.
// Sabotages: tests/sabotage/e2e-sign-in.mjs "e2e-undo-leaves-the-ban", "e2e-switch-leaves-auth-behind".
test('undoing a switch-off lifts its ban and the person signs in again', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const person = await makePerson();
  const bannedNow = async () =>
    (
      await sql<{ banned: boolean }>(
        `select coalesce(banned_until > now(), false) as banned from auth.users where id = $1`,
        [person.authUserId],
      )
    )[0]?.banned;

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);
  const off = await adminPage.request.post('/auth/admin/switch', {
    data: { person_id: person.id, on: false, reason: 'Test: switched off by mistake' },
  });
  expect(off.status(), 'an admin switches the person off').toBe(200);
  const { request_id: requestId } = (await off.json()) as { request_id: string };
  expect(await bannedNow(), 'the switch-off bans the auth user').toBe(true);

  const personCtx = await browser.newContext();
  const page = await personCtx.newPage();
  await page.goto('/sign-in');
  await attemptSignIn(page, person.email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Your account is switched off');

  const undone = await adminPage.request.post('/auth/admin/undo', { data: { request_id: requestId } });
  const body = (await undone.json()) as { ok: boolean; auth_resync: string[] };
  expect(body.ok).toBe(true);
  expect(body.auth_resync, 'the undo names the person').toEqual([person.id]);
  expect(await bannedNow(), 'the undone switch-off lifts the ban').toBe(false);

  await signIn(page, person.email, '/tasks');
  await expect(page.getByTestId('address')).toHaveText('/tasks');
  await adminCtx.close();
  await personCtx.close();
});
