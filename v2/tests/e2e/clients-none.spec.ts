/**
 * A person with Partners at none (QA-505, QA-504): `/partners` says they have no access, in words, never a list that
 * could not load; and when they still have Suppliers, the menu carries Suppliers as its own door — it is no tab of a
 * page they cannot see. Every value is made up.
 * Sabotages: tests/sabotage/screens.mjs "clients-none-reads-as-a-list", "suppliers-door-lost-when-clients-none".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function memberWithPartnersNone(suppliers: 'kept' | 'none') {
  const person = await makePerson();
  for (const key of suppliers === 'none' ? ['clients', 'suppliers_partners'] : ['clients'])
    await sql(
      `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
       values ($1, $2, 'none', 'Made up: no access', $1)`,
      [person.id, key],
    );
  return person;
}

test('Partners at none says no access on /partners, never a list that could not load (QA-505)', async ({ page }) => {
  const person = await memberWithPartnersNone('none');
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, person.email, '/partners');
  await hydrated(page);
  const state = page.locator('[data-state="no-access"]');
  await expect(state, 'the no-access state, not a list that could not load').toBeVisible();
  await expect(state).toContainText('You do not have access to Partners');
  await expect(page.locator('[data-partners-total]')).toHaveCount(0);
});

test('with Partners at none and Suppliers kept, the menu has a door to Suppliers (QA-504)', async ({ page }) => {
  const person = await memberWithPartnersNone('kept');
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, person.email, '/my-day');
  await hydrated(page);
  const door = page.locator('[data-drawer] a[href="/suppliers"]');
  await expect(door, 'a person with Partners none still has a door to Suppliers').toBeVisible();
  await expect(door).toHaveText('Suppliers');
  await expect(page.locator('[data-drawer] a[href="/partners"]')).toHaveCount(0);
  await door.click();
  await expect(page).toHaveURL(/\/suppliers/);
  await hydrated(page);
  await expect(page.locator('[data-partners-total]'), 'the Suppliers list opens').toBeVisible();
});
