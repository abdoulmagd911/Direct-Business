import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

// V166 · e-mail and password: an admin's route gives a person's sign-in a starting password — refused below ten
// characters and refused to anyone but an admin — and Auth then takes that password; the sign-in it opens completes as
// must_change_password and reaches nothing else until the change is recorded. The person's own screens are builder B's.
// Every value is made up. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-password-never-reaches-auth".
const STARTING = 'Made-up-start-2027';

function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test('an admin sets a starting password, which must be changed before anything else', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  const person = await makePerson();
  const [emailRow] = await sql<{ id: string }>(`select id from core.person_email where email = $1`, [person.email]);

  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  await signIn(memberPage, member.email);
  const refused = await memberPage.request.post('/auth/admin/password', {
    data: { email_id: emailRow?.id, password: STARTING, reason: 'Test: not mine to set' },
  });
  expect(refused.status(), 'a team member sets no password').toBe(403);

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);
  const short = await adminPage.request.post('/auth/admin/password', {
    data: { email_id: emailRow?.id, password: 'Made-up-9', reason: 'Test: too short' },
  });
  expect(short.status()).toBe(422);
  expect(((await short.json()) as { error: { key: string } }).error.key).toBe('password.too_short');

  const set = await adminPage.request.post('/auth/admin/password', {
    data: { email_id: emailRow?.id, password: STARTING, reason: 'Test: first sign-in' },
  });
  expect(set.status(), 'an admin sets it').toBe(200);

  const db = publicClient();
  const signed = await db.auth.signInWithPassword({ email: person.email, password: STARTING });
  expect(signed.error, 'Auth took the starting password').toBeNull();
  const done = await db.schema('api').rpc('sign_in_complete', { p_provider: 'email' });
  expect(done.data, 'the sign-in completes as must_change_password').toBe('must_change_password');
  const me = await db.schema('api').rpc('me');
  expect((me.data as { status: string }).status).toBe('must_change_password');
  const org = await db.schema('api').rpc('org');
  expect(org.error?.message, 'and every door refuses until it is changed').toBe('auth.no_active_person');
  const cleared = await db.schema('api').rpc('password_changed', { p_auth_user: person.authUserId });
  expect(cleared.error, 'the browser cannot record the change itself').not.toBeNull();

  await memberCtx.close();
  await adminCtx.close();
});
