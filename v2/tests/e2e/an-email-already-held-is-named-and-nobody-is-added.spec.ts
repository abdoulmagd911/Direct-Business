/**
 * An e-mail already held (V178; the production finding W24): Settings → Organization & access → Add person with an
 * e-mail another person holds — in other capitals — is refused in words that name the holder, never "The server did
 * not answer", and nobody is added: the person and the e-mail are one request.
 * Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-a-taken-email-reads-as-a-broken-server".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

test('adding a person with an e-mail someone holds names the holder and adds nobody', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const holder = await makePerson();
  const tag = Date.now().toString(36);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  await page.locator('[data-person-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill(`Test Person Twice ${tag}`);
  await dialog.getByLabel('Work email').fill(holder.email.toUpperCase());
  await dialog.locator('[data-person-save]').click();
  await expect(toast(page, `That email already belongs to ${holder.name}`)).toBeVisible();
  const [row] = await sql<{ n: number }>('select count(*)::int as n from core.person where full_name_en = $1', [
    `Test Person Twice ${tag}`,
  ]);
  expect(row!.n, 'nobody is added without their e-mail').toBe(0);
});
