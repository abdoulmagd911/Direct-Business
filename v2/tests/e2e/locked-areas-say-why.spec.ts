import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// V605: a locked area says why, in one line, never a bare word beside a lock — the oversight found the bare word on the
// owner's own account. At 390 px, as a member: the Activity page, and a colleague's Activity tab. Made-up people only.
// Sabotage: tests/sabotage/tasks.mjs "e2e-locked-activity-says-only-activity".

test('phone: a member is told why Activity and a colleague’s history are locked', async ({ browser }) => {
  const member = await makePerson();
  const colleague = await makePerson();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await signIn(page, member.email, '/activity');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
  await expect(page.locator('[data-state="no-access"]'), 'the Activity page says who it is for').toHaveText(
    'Activity is for managers, heads of department and admins',
  );

  await page.goto(`/people/${colleague.id}?tab=activity`);
  await expect(page.locator('[data-state="no-access"]'), 'a colleague’s history says who it is for').toHaveText(
    "A person's history is for admins, and for the person themselves",
  );
  await ctx.close();
});
