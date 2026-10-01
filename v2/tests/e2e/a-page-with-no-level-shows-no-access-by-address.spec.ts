import { expect, test } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

// PRF-002: /finance, /kpis, /reports, /appraisal and /overview ask the page's level on the server: a person whose level
// on the page is none gets the no-access state by address, and an admin gets the page. Made up.
// Sabotage: tests/sabotage/e2e-pages.mjs "e2e-a-page-forgets-its-level".
const PAGES = ['finance', 'kpis', 'reports', 'appraisal', 'overview'] as const;

test('a page with no level shows no access by address', async ({ browser }) => {
  const person = await makePerson();
  for (const key of PAGES)
    await sql(
      `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
       values ($1, $2, 'none', 'Test: no access', $1)`,
      [person.id, key],
    );
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, person.email, '/tasks');
  for (const key of PAGES) {
    await page.goto(`/${key}`);
    await expect(page.locator('[data-state="no-access"]'), `/${key} refuses by address`).toBeVisible();
  }

  const admin = await makePerson({ admin: true });
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, admin.email, '/tasks');
  for (const key of PAGES) {
    await adminPage.goto(`/${key}`);
    await expect(adminPage.locator('[data-state="no-access"]'), `/${key} opens for an admin`).toHaveCount(0);
  }
  await ctx.close();
  await adminCtx.close();
});
