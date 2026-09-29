import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { TEST_PASSWORD, callServerAction, logOf, makePerson, signIn } from './support/stack';

// The 17:22 audit · a server action is reachable by its action ID from anything holding the page's bundle, so each one
// keeps its own rules on the server, whatever screen normally calls it:
//  · setOwnPassword sets a password only when the database says a change is due (api.me() → must_change_password) —
//    a signed-in person who is not due one is refused, and their password stays as it was (V166, V172);
//  · My profile's changePassword counts a wrong current password as a wrong password: the fifth locks the e-mail (V172);
//  · the emailed-code door's two steps, sendCode and verifyCode, refuse while the database has the door off (ACC-011).
// Every value is made up. Sabotages: tests/sabotage/e2e-sign-in.mjs "e2e-own-password-without-the-rule",
// "e2e-a-code-checked-while-the-door-is-off", "e2e-a-wrong-current-password-is-not-counted".
test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const PASSWORDS = 'src/core/auth/password-actions.ts';
const CODES = 'src/core/auth/actions.ts';

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (!error) await db.auth.signOut({ scope: 'local' });
  return !error;
}

test('setOwnPassword, changePassword, sendCode and verifyCode keep their rules when called by ID', async ({
  browser,
  page,
}) => {
  const person = await makePerson();
  await signIn(page, person.email);

  const stolen = 'Made-Up-Stolen-2026';
  const own = await callServerAction(page, '/set-password', PASSWORDS, 'setOwnPassword', [stolen, stolen, null]);
  expect(own, 'setOwnPassword sets a password only when the database says a change is due').toContain(
    '"error":"not_needed"',
  );
  expect(await passwordWorks(person.email, TEST_PASSWORD), 'the password stays as it was').toBe(true);
  expect(await passwordWorks(person.email, stolen), 'and the new one never reached Auth').toBe(false);

  // the code door, from a browser signed in as nobody
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  const sent = await callServerAction(stranger, '/sign-in', CODES, 'sendCode', [person.email]);
  expect(sent, 'sendCode refuses while the door is off').toContain('"error":"code_off"');
  const checked = await callServerAction(stranger, '/sign-in', CODES, 'verifyCode', [
    person.email,
    '123456',
    null,
    Date.now(),
  ]);
  expect(checked, 'verifyCode refuses while the door is off').toContain('"error":"code_off"');
  await strangerCtx.close();

  const before = (await logOf(person.email)).length;
  for (let n = 1; n <= 4; n++) {
    const wrong = await callServerAction(page, '/profile', PASSWORDS, 'changePassword', [
      `Not-the-current-${n}`,
      'Made-Up-New-Pass-2026',
      'Made-Up-New-Pass-2026',
    ]);
    expect(wrong, 'a wrong current password is refused').toContain('"error":"wrong_current"');
  }
  const fifth = await callServerAction(page, '/profile', PASSWORDS, 'changePassword', [
    'Not-the-current-5',
    'Made-Up-New-Pass-2026',
    'Made-Up-New-Pass-2026',
  ]);
  expect(fifth, 'a wrong current password counts as a wrong password: the fifth locks the e-mail').toContain(
    '"error":"rate_limited"',
  );
  expect((await logOf(person.email)).slice(before), 'each one logged').toEqual(Array(5).fill('wrong_password'));
  expect(await passwordWorks(person.email, 'Made-Up-New-Pass-2026'), 'and nothing was changed').toBe(false);
});
