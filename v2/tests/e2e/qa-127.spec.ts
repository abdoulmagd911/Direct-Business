/**
 * QA's review of #127 (round 15): the admin and test accounts are named from `core.person.account` (QA-181); the People
 * table keeps Status on screen at 1440 (QA-183a); the sign-in log keeps the email readable on a phone (QA-183b); a
 * settings list fits a phone with Edit and Archive in reach, and the settings groups are all in sight (QA-183c, d);
 * Side type shows each entry's side and Status reason each reason's status, both asked for in Add entry (QA-176,
 * QA-177). The frame's own crash page (QA-184) is proved in tests/unit/shell. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "account-read-from-kind", "list-hides-its-side".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('the admin and test accounts are named as accounts, with no department or team (QA-181)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const account = await makePerson({ admin: true });
  // one test account per database (person_one_account_of_each): borrow the mark, and hand it back afterwards
  const [held] = await sql<{ id: string }>(
    `update core.person set account = 'team_member' where account = 'test_account' returning id`,
  );
  await sql(`update core.person set account = 'test_account' where id = $1`, [account.id]);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, admin.email, '/settings/org');
    await hydrated(page);
    await page.getByPlaceholder('Search by name or email').fill(account.name);
    const row = page.locator(`[data-person-row="${account.id}"]`);
    await expect(row.locator('[data-person-role]'), 'named from core.person.account').toHaveText('Test account');
    await expect(row.locator('td').nth(2)).toHaveText('—');
    await expect(row.locator('td').nth(3)).toHaveText('—');
  } finally {
    await sql(`update core.person set account = 'team_member' where id = $1`, [account.id]);
    if (held) await sql(`update core.person set account = 'test_account' where id = $1`, [held.id]);
  }
});

test('the People table keeps Status on screen at 1440 (QA-183a)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  const status = page.locator('[data-person-status]').first();
  await expect(status).toBeVisible();
  const box = (await status.boundingBox())!;
  const table = (
    await page
      .locator('table')
      .first()
      .evaluateHandle((t) => t.parentElement!)
  ).asElement()!;
  const frame = (await table.boundingBox())!;
  expect(box.x + box.width, 'Status ends inside the table box').toBeLessThanOrEqual(frame.x + frame.width + 1);
  expect(await status.innerText(), 'the chip says its word, not only its dot').toMatch(/\w{3,}/);
});

test('on a phone the sign-in log keeps the email readable (QA-183b)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, admin.email, `/people/${admin.id}`);
  await hydrated(page);
  const email = page.locator('[data-sign-in-email]').first();
  await expect(email).toBeVisible();
  expect((await email.boundingBox())!.width, 'more than a letter').toBeGreaterThan(120);
});

test('on a phone a settings list keeps Edit and Archive in reach, and every settings group is in sight (QA-183c, d)', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, admin.email, '/settings/work');
  await hydrated(page);
  const archive = page.locator('[data-list="priority"] [data-list-archive]').first();
  await expect(archive).toBeVisible();
  const a = (await archive.boundingBox())!;
  expect(a.x + a.width, 'Archive is on screen').toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const link of await page.locator('[data-settings-groups] a').all()) {
    const b = (await link.boundingBox())!;
    expect(b.x >= 0 && b.x + b.width <= 390, `${await link.innerText()} is in sight`).toBe(true);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});

test('Side type shows each side and Status reason each status, and Add entry asks for them (QA-176, QA-177)', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, admin.email, '/settings/partners');
  await hydrated(page);
  const types = page.locator('[data-list="side_type"]');
  await expect(types.locator('th[data-list-column="side"]')).toHaveText('Side');
  await expect(types.locator('[data-list-extra="supplier_partner"]').first()).toHaveText('Supplier');
  await expect(types.locator('[data-list-extra="client"]').first()).toHaveText('Client');
  // the rows group by side: every Client entry before the first Supplier one
  const sides = await types
    .locator('[data-list-extra]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-list-extra')));
  expect(sides.lastIndexOf('client')).toBeLessThan(sides.indexOf('supplier_partner'));

  const reasons = page.locator('[data-list="side_status_reason"]');
  await expect(reasons.locator('th[data-list-column="status"]')).toHaveText('Status');
  await expect(reasons.locator('[data-list-extra="at_risk"]').first()).toHaveText('At risk');
  await expect(reasons.locator('[data-list-extra="lost"]').first()).toHaveText('Lost');

  // Add entry asks for the status, and Save waits for it
  await reasons.locator('[data-list-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Key', { exact: true }).fill('made_up_reason');
  await dialog.getByLabel('Name', { exact: true }).fill('Made-up reason');
  await dialog.getByLabel('Name (Arabic)').fill('سبب تجريبي');
  await expect(dialog.locator('[data-list-save]'), 'no status, no save').toBeDisabled();
  await dialog.getByLabel('Status').click();
  await page.getByRole('option', { name: 'Lost' }).click();
  await expect(dialog.locator('[data-list-save]')).toBeEnabled();
});
