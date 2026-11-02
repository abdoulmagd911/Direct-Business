/**
 * A record that does not exist answers a real 404, drawn as Not found inside the shell, and a page that exists still
 * answers 200 (W32; the Architect's order of 2 Nov: 442101f6's app-wide loading frame started every answer as 200
 * before the page knew whether its record existed). Everyone here is made up (rule 7).
 * Sabotage: tests/sabotage/an-app-wide-loading-frame.mjs.
 */
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

test('signed in, a task, organisation, person or settings group that does not exist answers 404', async ({ page }) => {
  const person = await makePerson({ admin: true });
  await signIn(page, person.email, '/my-day');
  for (const path of [
    '/tasks/TSK-1999-0',
    `/partners/${randomUUID()}`,
    `/people/${randomUUID()}`,
    '/settings/no-such-group',
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} answers 404`).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' }), path).toBeVisible();
  }
  expect((await page.goto('/tasks'))?.status(), 'a page that exists is still 200').toBe(200);
});
