import { expect, test } from '@playwright/test';
import { logOf, makePerson, sendCode, signIn, sql } from './support/stack';

// P3-2 · §4 steps 2 and 5: the admin's allow-list route adds an email (the database row, a confirmed auth user, the
// link), and that person signs in with a code; removing the email refuses the session at once and bans the auth
// user, so no new code is sent. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-removed-email-not-banned".
test('an admin allows an email, and removing it refuses its sign-in', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const newcomer = await makePerson({ listed: false });
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);

  const added = await adminPage.request.post('/auth/admin/emails', {
    data: { person_id: newcomer.id, email: newcomer.email, primary: true },
  });
  const addedBody = (await added.json()) as { ok: boolean; id: string; auth_user_id: string };
  expect(addedBody.ok).toBe(true);

  const newcomerCtx = await browser.newContext();
  const page = await newcomerCtx.newPage();
  await signIn(page, newcomer.email, '/overview');
  await expect(page.getByTestId('address')).toHaveText('/overview');

  const removed = await adminPage.request.post('/auth/admin/emails/remove', {
    data: { id: addedBody.id, reason: 'Test: the email is no longer used' },
  });
  expect(((await removed.json()) as { ban: string[] }).ban).toEqual([addedBody.auth_user_id]);
  const banned = await sql<{ banned: boolean }>(`select banned_until > now() as banned from auth.users where id = $1`, [
    addedBody.auth_user_id,
  ]);
  expect(banned[0]?.banned, "the removed email's auth user is banned").toBe(true);

  await page.reload();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This email is not on the list — ask an admin');
  await sendCode(page, newcomer.email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This email is not on the list — ask an admin');
  expect((await logOf(newcomer.email)).slice(-1)).toEqual(['not_listed']);
  await adminCtx.close();
  await newcomerCtx.close();
});
