/**
 * Landing 40 — per-member settings (the owner's approved design of 22 Nov 2026), on the real stack.
 * On a person's record an admin finds "Extra access for this person": three rows, each As their role, Allowed or
 * View only, every change with its reason and logged. A team member set to Allowed on Import gets the import section
 * on Finance and a colleague does not; back at As their role it is gone; a Viewer's record offers no picker at all —
 * a Viewer stays view-only. The database decides (XTR-01 to XTR-04). Every value is made up.
 * Sabotages: tests/sabotage/landing-40.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { hydrated, personAs, signedInAdmin, signedInAs } from './support/landing-32';

const extra = (page: Page) => page.locator('[data-extra-access]');
const row = (page: Page, key: string) => extra(page).locator(`[data-extra-row="${key}"]`);

/** Pick a choice on a row and give the reason the dialog asks for. */
async function choose(page: Page, key: string, choice: string, reason: string) {
  await row(page, key).getByRole('combobox').click();
  await page.getByRole('option', { name: choice, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog, 'every change asks for its reason').toBeVisible();
  await dialog.getByLabel('Reason').fill(reason);
  await dialog.locator('[data-reason-save]').click();
  await expect(
    page.locator('[data-sonner-toast][data-removed="false"]', { hasText: 'Access changed' }).first(),
    'the change is said',
  ).toBeVisible();
}

test('an admin sets a team member to Allowed on Import: that member imports, a colleague does not, and As their role takes it back', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const { admin } = await signedInAdmin(page);
  const member = await personAs('member');
  const colleague = await personAs('member');

  await page.goto(`/people/${member.id}`);
  await hydrated(page);
  await expect(extra(page), 'the section is on the record').toBeVisible();
  await expect(extra(page)).toContainText('Extra access for this person');
  await expect(extra(page).locator('[data-extra-row]'), 'three rows').toHaveCount(3);
  for (const [key, label] of [
    ['import', 'Import files on Finance'],
    ['edit_others', "Edit someone else's work"],
    ['credit', 'Change credit limits'],
  ] as const) {
    await expect(extra(page), `the ${key} row is named`).toContainText(label);
    await expect(row(page, key), `${key} starts As their role`).toHaveAttribute('data-extra-choice', 'as_role');
  }
  await row(page, 'import').getByRole('combobox').click();
  await expect(page.getByRole('option'), 'three choices').toHaveText(['As their role', 'Allowed', 'View only']);
  await page.keyboard.press('Escape');

  // before: with Finance at Full, neither member is offered the import
  const theirs = await signedInAs(browser, member, '/finance');
  await hydrated(theirs.page);
  await expect(theirs.page.locator('[data-finance-overview]'), 'the member reads Finance').toBeVisible();
  await expect(
    theirs.page.locator('[data-finance-import-section]'),
    'a member is not offered the import by role',
  ).toHaveCount(0);

  await choose(page, 'import', 'Allowed', 'Made up: she does the monthly review');
  await expect(row(page, 'import'), 'the row says Allowed').toHaveAttribute('data-extra-choice', 'allowed');
  await expect(row(page, 'import').locator('[data-extra-set]'), 'and who set it').toContainText(admin.name);

  await theirs.page.reload();
  await hydrated(theirs.page);
  await expect(
    theirs.page.locator('[data-finance-import-section]'),
    'the member set to Allowed gets the import',
  ).toBeVisible();
  const other = await signedInAs(browser, colleague, '/finance');
  await hydrated(other.page);
  await expect(other.page.locator('[data-finance-overview]')).toBeVisible();
  await expect(
    other.page.locator('[data-finance-import-section]'),
    'the setting changed that one person only',
  ).toHaveCount(0);
  await other.context.close();

  await choose(page, 'import', 'As their role', 'Made up: the review is handed back');
  await expect(row(page, 'import'), 'the row is back at As their role').toHaveAttribute('data-extra-choice', 'as_role');
  await expect(row(page, 'import').locator('[data-extra-set]'), 'no setting, no note').toHaveCount(0);
  await theirs.page.reload();
  await hydrated(theirs.page);
  await expect(theirs.page.locator('[data-finance-overview]')).toBeVisible();
  await expect(
    theirs.page.locator('[data-finance-import-section]'),
    'back at As their role the import is gone',
  ).toHaveCount(0);
  await theirs.context.close();
});

test('View only on a manager takes the credit limit away, and a Viewer’s record offers no picker', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await signedInAdmin(page);
  const manager = await personAs('manager');
  const viewer = await personAs('viewer');

  const theirs = await signedInAs(browser, manager, '/settings/finance');
  await hydrated(theirs.page);
  await expect(
    theirs.page.locator('[data-credit-limit="edit"]'),
    'by role a manager changes the credit limit',
  ).toBeVisible();

  await page.goto(`/people/${manager.id}`);
  await hydrated(page);
  await choose(page, 'credit', 'View only', 'Made up: not this quarter');
  await expect(row(page, 'credit')).toHaveAttribute('data-extra-choice', 'view_only');
  await theirs.page.reload();
  await hydrated(theirs.page);
  await expect(
    theirs.page.locator('[data-credit-limit="view"]'),
    'set to View only, the manager only reads it',
  ).toBeVisible();
  await theirs.context.close();

  await page.goto(`/people/${viewer.id}`);
  await hydrated(page);
  await expect(extra(page), 'the section is there for a Viewer too').toBeVisible();
  await expect(extra(page).locator('[data-extra-note]'), 'and says a Viewer stays view-only').toContainText(
    'A Viewer stays view-only',
  );
  await expect(extra(page).getByRole('combobox'), 'with no picker').toHaveCount(0);
});
