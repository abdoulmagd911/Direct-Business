/**
 * Productivity Stage 2, builder B2's half — the reminders in My day's Today block: one due today shows with a one-tap done
 * that ends it. (The When chips have builder B's own spec; Arabic and the "Follow up: <record>" tag are drawn without a
 * browser, in the unit tests, because Arabic is off in a fresh stack.) Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

test('a reminder due today shows in Today and one tap ends it', async ({ page }) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const made = await callAs(page.context(), 'note_capture', {
    p_kind: 'reminder',
    p_values: { title: `Send the Dune Foods file ${t}`, remind_at: new Date(Date.now() + 86_400_000).toISOString() },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  // bring it to this Riyadh day without waiting for the clock
  await sql(
    `update core.reminder r set remind_at = core.clock() + interval '2 minutes'
       from my.note n where n.id = r.note_id and n.person_id = $1 and n.title = $2`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  await page.reload();
  await hydrated(page);
  const row = page.locator('[data-today-reminder]', { hasText: `Send the Dune Foods file ${t}` });
  await expect(row).toBeVisible();
  expect((await row.locator('[data-reminder-done]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await row.locator('[data-reminder-done]').click();
  await expect(row).toHaveCount(0);
  const [gone] = await sql<{ n: number }>(
    `select count(*)::int as n from core.reminder r join my.note n on n.id = r.note_id
      where n.person_id = $1 and n.title = $2 and r.deleted_at is null`,
    [me.id, `Send the Dune Foods file ${t}`],
  );
  expect(gone!.n, 'one tap ended the reminder').toBe(0);
});
