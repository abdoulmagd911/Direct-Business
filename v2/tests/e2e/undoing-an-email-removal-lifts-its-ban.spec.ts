import { expect, test } from '@playwright/test';
import { givePassword, makePerson, signIn, sql } from './support/stack';

// P3-6d · V128, V144: undoing a sign-in change keeps Supabase Auth in step. An admin removes an allowed e-mail (its
// auth user is banned), then undoes the removal through /auth/admin/undo: the database names the person, their auth
// user is unbanned, and they sign in with a code again. A non-admin's undo is refused by the database.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-undo-leaves-the-ban".
test('undoing an e-mail removal lifts its ban', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  const newcomer = await makePerson({ listed: false });
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);

  const added = await adminPage.request.post('/auth/admin/emails', {
    data: { person_id: newcomer.id, email: newcomer.email, primary: true },
  });
  await givePassword(newcomer.email);
  const addedBody = (await added.json()) as { id: string; auth_user_id: string };
  const removed = await adminPage.request.post('/auth/admin/emails/remove', {
    data: { id: addedBody.id, reason: 'Test: removed by mistake' },
  });
  const removedBody = (await removed.json()) as { request_id: string };
  const bannedNow = async () =>
    (
      await sql<{ banned: boolean }>(
        `select coalesce(banned_until > now(), false) as banned from auth.users where id = $1`,
        [addedBody.auth_user_id],
      )
    )[0]?.banned;
  expect(await bannedNow(), 'the removal bans the auth user').toBe(true);

  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  await signIn(memberPage, member.email);
  const refused = await memberPage.request.post('/auth/admin/undo', { data: { request_id: removedBody.request_id } });
  expect(refused.status(), "a member cannot undo an e-mail's removal").toBe(403);

  const undone = await adminPage.request.post('/auth/admin/undo', { data: { request_id: removedBody.request_id } });
  const undoneBody = (await undone.json()) as { ok: boolean; auth_resync: string[] };
  expect(undoneBody.ok).toBe(true);
  expect(undoneBody.auth_resync).toEqual([newcomer.id]);
  expect(await bannedNow(), 'the undone removal lifts the ban').toBe(false);

  const newcomerCtx = await browser.newContext();
  const page = await newcomerCtx.newPage();
  await signIn(page, newcomer.email, '/overview');
  await expect(page.getByTestId('address')).toHaveText('/overview');
  await adminCtx.close();
  await memberCtx.close();
  await newcomerCtx.close();
});
