/**
 * L (26 Oct): the weekly review stayed on "Loading Weekly review" for good on production. Its route was the only one
 * with its own loading screen, so the review came down the line after it, and React puts a late part in place on the
 * browser's next frame. A browser that is not painting (a tab or pane in the background, a phone with its screen off)
 * draws no next frame, so the loading screen stayed. The review now arrives with the page, like every other screen.
 * Here the browser never draws a frame at all, and the read answers a second late for this person alone (as far away as
 * production's database, and a little more): the review must still be there, by its address and from My day's door.
 * Every value is made up.
 * Sabotage: tests/sabotage/weekly-review-waits-for-a-frame.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

/** A browser that never draws its next frame. */
const noFrames = (page: Page) =>
  page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });

/** The weekly review's read answers `seconds` late for `personId` alone; the returned function puts it back. */
async function slowReadFor(personId: string, seconds: number) {
  const [was] = await sql<{ def: string }>(`select pg_get_functiondef('api.weekly_review(date)'::regprocedure) as def`);
  await sql(`
    create or replace function api.weekly_review(p_day date default null) returns jsonb
    language plpgsql stable security invoker set search_path = '' as $$
    begin
      if authz.me() = '${personId}'::uuid then perform pg_catalog.pg_sleep(${seconds}); end if;
      return my.weekly_review(p_day);
    end
    $$`);
  return () => sql(was!.def);
}

test('the weekly review loads in a browser that draws no frame — by its address and from My day', async ({ page }) => {
  const me = await makePerson();
  const putBack = await slowReadFor(me.id, 1);
  try {
    await noFrames(page);
    await signIn(page, me.email, '/my-day');
    // opened by its address (typed, reloaded, a link from outside the app)
    await page.goto('/my-day/week');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('h1')).toHaveText('Weekly review');
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(page.locator('[data-state="empty"]')).toHaveText('Nothing done, slipped or due this week yet');
    await expect(page.locator('[data-state="loading"]')).toHaveCount(0);

    // and from My day's door
    await page.goto('/my-day');
    await page.locator('[data-week-door]').click();
    await page.waitForURL(/\/my-day\/week$/);
    await expect(page.locator('[data-state="empty"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-state="loading"]')).toHaveCount(0);
  } finally {
    await putBack();
  }
});
