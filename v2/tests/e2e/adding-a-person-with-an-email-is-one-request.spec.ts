import { expect, test } from '@playwright/test';
import { givePassword, makePerson, signIn, sql, unlistedEmail } from './support/stack';

// ACC-093: Settings → People → Add sends the person with their allowed e-mail, role and sign-in switch to
// /auth/admin/people — one request in the log, one Undo — and the e-mail's auth user is linked in the same call, so
// the new person can sign in. Made up.
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-a-new-person-without-a-sign-in".
test('adding a person with their email is one request, and they can sign in', async ({ browser }) => {
  const admin = await makePerson({ admin: true });
  const [dep] = await sql<{ id: string }>(`select id from core.department where code = 'commercial'`);
  const [role] = await sql<{ id: string }>(`select id from core.role where key = 'member'`);
  const email = unlistedEmail();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, admin.email);

  const res = await page.request.post('/auth/admin/people', {
    data: {
      person: {
        full_name_en: 'Test Person Added',
        department_id: dep?.id,
        role_id: role?.id,
        can_sign_in: true,
        email,
      },
      reason: 'Test: a new person',
    },
  });
  expect(res.status(), 'an admin adds the person').toBe(200);
  const body = (await res.json()) as { id: string; request_id: string; auth_user_id: string | null };
  expect(body.auth_user_id, 'the e-mail has its sign-in').toBeTruthy();
  const tables = await sql<{ table_name: string }>(
    `select distinct table_name from audit.change where request_id = $1 and table_name like 'core.person%'
     order by table_name`,
    [body.request_id],
  );
  expect(
    tables.map((t) => t.table_name),
    'the person and the e-mail are one request',
  ).toEqual(['core.person', 'core.person_email']);

  await givePassword(email);
  const newCtx = await browser.newContext();
  const newPage = await newCtx.newPage();
  await signIn(newPage, email, '/tasks');
  await expect(newPage.getByTestId('address')).toHaveText('/tasks');
  await ctx.close();
  await newCtx.close();
});
