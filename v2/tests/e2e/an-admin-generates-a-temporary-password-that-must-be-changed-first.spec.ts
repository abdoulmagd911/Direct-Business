import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// V431, V441, V166 · e-mail and password: an admin's route generates a person's temporary password — refused to anyone
// but an admin and without a reason — answers it once, 14 characters or more, and Auth takes it; the sign-in it opens
// completes as must_change_password and reaches nothing else until the change is recorded, which the browser cannot do.
// "Generate for everyone without a password" skips who already has one; replacing one is a confirmed Reset (V451). The person's own screens are builder B's.
// Every value is made up. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-password-never-reaches-auth".
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test('an admin generates a temporary password, which must be changed before anything else', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  const person = await makePerson();

  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  await signIn(memberPage, member.email);
  const refused = await memberPage.request.post('/auth/admin/password', {
    data: { person_id: person.id, reason: 'Test: not mine to generate' },
  });
  expect(refused.status(), 'a team member generates no password').toBe(403);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);
  const noReason = await adminPage.request.post('/auth/admin/password', { data: { person_id: person.id } });
  expect(noReason.status(), 'a generate needs its reason').toBe(422);

  const made = await adminPage.request.post('/auth/admin/password', {
    data: { person_id: person.id, reason: 'Test: first sign-in' },
  });
  expect(made.status(), 'an admin generates it').toBe(200);
  const { temporary_password: password } = (await made.json()) as { temporary_password: string };
  expect(password.length, 'fourteen characters or more, answered once').toBeGreaterThanOrEqual(14);

  const db = publicClient();
  const signed = await db.auth.signInWithPassword({ email: person.email, password });
  expect(signed.error, 'Auth took the generated password').toBeNull();
  const done = await db.schema('api').rpc('sign_in_complete', { p_provider: 'email' });
  expect(done.data, 'the sign-in completes as must_change_password').toBe('must_change_password');
  const me = await db.schema('api').rpc('me');
  expect((me.data as { status: string }).status).toBe('must_change_password');
  const org = await db.schema('api').rpc('org');
  expect(org.error?.message, 'and every door refuses until it is changed').toBe('auth.no_active_person');
  const cleared = await db.schema('api').rpc('password_changed', { p_auth_user: person.authUserId });
  expect(cleared.error, 'the browser cannot record the change itself').not.toBeNull();

  const again = await adminPage.request.post('/auth/admin/password', {
    data: { person_id: person.id, reason: 'Test: again' },
  });
  expect(again.status(), 'a password the person holds is kept').toBe(422);
  expect(((await again.json()) as { error: { key: string } }).error.key).toBe('person_password.has_one');
  const unconfirmed = await adminPage.request.post('/auth/admin/password/reset', {
    data: { person_id: person.id, reason: 'Test: reset' },
  });
  expect(unconfirmed.status(), 'a Reset is confirmed, never implied (V451)').toBe(422);
  const reset = await adminPage.request.post('/auth/admin/password/reset', {
    data: { person_id: person.id, reason: 'Test: reset', confirm: true },
  });
  expect(reset.status(), 'unless the admin asks for a Reset and confirms it').toBe(200);

  const everyone = await adminPage.request.post('/auth/admin/password/everyone', {
    data: { reason: 'Test: everyone without one' },
  });
  const list = ((await everyone.json()) as { people: { person_id: string; temporary_password: string }[] }).people;
  expect(
    list.map((p) => p.person_id),
    'everyone without a password gets one',
  ).toContain(member.id);
  expect(
    list.map((p) => p.person_id),
    'but not who already has one',
  ).not.toContain(person.id);

  await memberCtx.close();
  await adminCtx.close();
});
