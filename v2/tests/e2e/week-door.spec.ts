/**
 * QA-557 — the door to the weekly review on My day's Me tab, at 375 px: one "This week" row that opens /my-day/week,
 * marked as review day exactly when Riyadh's date (the database's own) is a Thursday. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('the This week row on My day opens the weekly review — at 375 px', async ({ page }) => {
  const me = await makePerson();
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const door = page.locator('[data-week-door]');
  await expect(door).toHaveText(/This week/);
  const [row] = await sql<{ thursday: boolean }>(`select extract(isodow from core.riyadh_today()) = 4 as thursday`);
  await expect(door, 'marked on Thursday in Riyadh, and only then').toHaveAttribute(
    'data-week-door-thursday',
    String(row!.thursday),
  );
  const box = await door.boundingBox();
  expect(box!.height, 'a 44 px target').toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    'no sideways scroll',
  ).toBe(true);
  await door.click();
  await page.waitForURL(/\/my-day\/week$/);
  await expect(page.locator('h1')).toHaveText('Weekly review');
});
