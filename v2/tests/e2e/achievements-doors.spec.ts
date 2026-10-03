/**
 * The shell's doors to Achievements (GC-4, V377, V605): the KPIs page opens on the Achievements list, /achievements
 * goes there too, and the + menu offers Achievement to a person at Own or Full on KPIs — not to one at View.
 * Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "kpis-page-no-longer-opens-achievements", "achievements-short-address-lost", "create-offers-achievement-at-full-only".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

test('/kpis and /achievements open the Achievements list', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/kpis');
  await hydrated(page);
  await expect(page, 'the KPIs page opens on Achievements').toHaveURL(/\/kpis\/achievements$/);
  await expect(page.locator('h1')).toHaveText('Achievements');
  await page.goto('/achievements');
  await expect(page, 'the short address goes to the list').toHaveURL(/\/kpis\/achievements$/);
  await expect(page.locator('h1')).toHaveText('Achievements');
});

test('the + menu offers Achievement at Own or Full on KPIs, and not at View', async ({ page, browser }) => {
  const owner = await makePerson();
  const reader = await makePerson();
  for (const [person, level] of [
    [owner, 'own'],
    [reader, 'view'],
  ] as const) {
    await sql(
      `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
       values ($1, 'kpis', $2, 'Made up: achievements doors', $1)`,
      [person.id, level],
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, owner.email, '/my-day');
  await hydrated(page);
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem', { name: 'Achievement' }), 'a person at Own may log one').toBeVisible();
  await page.keyboard.press('Escape');

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.setViewportSize({ width: 1440, height: 900 });
  await signIn(other, reader.email, '/my-day');
  await hydrated(other);
  await other.locator('[data-create]').click();
  await expect(other.getByRole('menu')).toBeVisible();
  await expect(other.getByRole('menuitem', { name: 'Achievement' }), 'a person at View may not').toHaveCount(0);
  await ctx.close();
});
