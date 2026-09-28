import { expect, test } from '@playwright/test';
import { makePerson, sessionOf, signIn, sql } from './support/stack';

// P3-2 · V74: a device stays signed in until sign-out, but one unused for 30 days asks for a new code. The two devices'
// last use is moved back in the database (the app's clock is the database's: requests cannot carry a test clock).
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-gate-lets-refusals-in".
test('a device idle for 31 days asks for a new code while one used yesterday does not', async ({ browser }) => {
  const person = await makePerson();
  const idle = await browser.newContext();
  const recent = await browser.newContext();
  const idlePage = await idle.newPage();
  const recentPage = await recent.newPage();
  await signIn(idlePage, person.email, '/my-day');
  await signIn(recentPage, person.email, '/my-day');

  const move = async (sessionId: string, days: number) =>
    sql(`update core.device_session set last_seen_at = now() - make_interval(days => $2) where auth_session_id = $1`, [
      sessionId,
      days,
    ]);
  await move((await sessionOf(idle)).sessionId, 31);
  await move((await sessionOf(recent)).sessionId, 1);

  await idlePage.reload();
  await expect(idlePage, 'the idle device asks for a new code').toHaveURL(/\/sign-in\?/);
  await expect(idlePage.getByRole('main').getByRole('alert')).toHaveText(
    'This device was not used for 30 days — send a new code',
  );

  await recentPage.reload();
  await expect(recentPage.getByTestId('address')).toHaveText('/my-day');
  await idle.close();
  await recent.close();
});
