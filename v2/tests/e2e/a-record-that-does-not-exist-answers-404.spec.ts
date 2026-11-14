/**
 * A record that does not exist answers a real 404, drawn as Not found inside the shell, and a page that exists still
 * answers 200 (W32; the Architect's order of 2 Nov: 442101f6's app-wide loading frame started every answer as 200
 * before the page knew whether its record existed). Everyone here is made up (rule 7).
 * L24: the heading is per path — an organisation record that does not exist draws PartnerGone
 * ("This organisation is not here", deliberate L23 product behaviour, with the way back to Partners), while a task,
 * person or settings group draws the plain "Page not found". The Partners/Suppliers loading frame is scoped to the
 * list only via the (list) route group, so the record route's notFound() yields a real 404.
 * Sabotage: tests/sabotage/an-app-wide-loading-frame.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

test('signed in, a task, organisation, person or settings group that does not exist answers 404', async ({ page }) => {
  const person = await makePerson({ admin: true });
  await signIn(page, person.email, '/my-day');
  for (const { path, heading } of [
    { path: '/tasks/TSK-1999-0', heading: 'Page not found' },
    { path: `/partners/${randomUUID()}`, heading: 'This organisation is not here' },
    { path: `/suppliers/${randomUUID()}`, heading: 'This organisation is not here' },
    { path: `/people/${randomUUID()}`, heading: 'Page not found' },
    { path: '/settings/no-such-group', heading: 'Page not found' },
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} answers 404`).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: heading }), path).toBeVisible();
  }
  expect((await page.goto('/tasks'))?.status(), 'a page that exists is still 200').toBe(200);
});
