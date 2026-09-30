import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// V441, V166 · "Generate for everyone without a password": one temporary password for each allowed, switched-on person
// the app knows has none, and never for one who holds a password — one the owner typed himself, or one generated
// before. It reaches every person, so it runs alone, after every other spec (playwright.config.ts). Every value is
// made up. Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-everyone-gets-nothing".
test('generate for everyone without a password gives one to each who has none, and to nobody who has one', async ({
  browser,
}) => {
  const admin = await makePerson({ admin: true });
  const without = await makePerson({ passwordRecorded: false });
  const holder = await makePerson();

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email);
  const everyone = await adminPage.request.post('/auth/admin/password/everyone', {
    data: { reason: 'Test: everyone without one' },
  });
  expect(everyone.status(), 'an admin generates for everyone without one').toBe(200);
  const list = ((await everyone.json()) as { people: { person_id: string; temporary_password: string }[] }).people;
  const named = list.map((p) => p.person_id);
  expect(named, 'everyone without a password gets one').toContain(without.id);
  expect(named, 'but not who already has one').not.toContain(holder.id);
  expect(named, 'nor the admin asking').not.toContain(admin.id);
  await adminCtx.close();
});
