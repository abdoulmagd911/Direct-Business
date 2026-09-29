/**
 * Organization & access (V97, V125, V132): an admin adds a person with an allowed email and that person signs in;
 * switching them off refuses their next request; a manager sees no access controls; a changed starting level shows in
 * the member's drawer after a reload; every change is in Activity and undoes; a team retires with its people moved.
 * Sabotage: tests/sabotage/screens.mjs "matrix-skips-the-reason".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { givePassword, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

test('an admin adds a person who then signs in; switching them off signs them out on their next request', async ({
  page,
  browser,
}) => {
  const admin = await makePerson({ admin: true });
  const tag = Date.now().toString(36);
  const email = `test.e2e-new-${tag}@example.test`;
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/org');
  await hydrated(page);
  await page.locator('[data-person-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill(`Test Person New ${tag}`);
  await dialog.getByLabel('Job title').fill('Made-up title');
  await dialog.getByLabel('Work email').fill(email);
  await dialog.locator('[data-person-save]').click();
  await expect(toast(page, `Test Person New ${tag} added`)).toBeVisible();
  await expect(page).toHaveURL(/\/people\//);
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: `Test Person New ${tag}` })).toBeVisible();
  await expect(page.locator('[data-record-rail]')).toContainText(email);

  // the new person signs in on their own browser (their password, as an admin's Set password gives it)
  await givePassword(email);
  const theirs = await browser.newContext();
  const their = await theirs.newPage();
  await signIn(their, email, '/my-day');
  await expect(their.getByTestId('address')).toHaveText('/my-day');

  // the admin switches them off: their next request is refused with the reason
  const reason = `Made-up reason ${tag}`;
  await page.locator('[data-person-switch]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill(reason);
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, 'Switched off')).toBeVisible();
  await their.goto('/tasks');
  await expect(their).toHaveURL(/\/sign-in\?/);
  await expect(their.getByRole('main').getByRole('alert')).toHaveText('Your account is switched off');
  await theirs.close();

  // the change is in Activity, and undoes
  await page.goto('/activity');
  await hydrated(page);
  const row = page.locator('[data-history-row]', { hasText: reason }).first();
  await expect(row).toBeVisible();
  await row.locator('[data-undo-request]').click();
  await expect(toast(page, 'Undone')).toBeVisible();
  const [back] = await sql<{ can_sign_in: boolean }>(
    `select can_sign_in from core.person where id = (select person_id from core.person_email where email = $1)`,
    [email],
  );
  expect(back!.can_sign_in).toBe(true);
});

test('a manager sees no access controls; a changed starting level reaches the member after a reload', async ({
  page,
  browser,
}) => {
  const admin = await makePerson({ admin: true });
  const manager = await makePerson();
  const member = await makePerson();
  await sql(`update core.person set role_id = (select id from core.role where key = 'manager') where id = $1`, [
    manager.id,
  ]);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, manager.email, `/people/${member.id}`);
  await hydrated(page);
  // the role and level selects are the admin's; a manager sees values only (V97)
  await expect(page.locator('[data-record-rail]').getByRole('combobox')).toHaveCount(0);
  await expect(page.locator('[data-person-edit]')).toHaveCount(0);

  // the member's drawer before: no Overview (a member starts at none there)
  const theirs = await browser.newContext();
  const their = await theirs.newPage();
  await signIn(their, member.email, '/my-day');
  await expect(their.locator('[data-drawer]').getByRole('link', { name: 'Overview' })).toHaveCount(0);

  // the admin gives the member role View on Overview, with a reason
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.setViewportSize({ width: 1500, height: 1000 });
  await signIn(adminPage, admin.email, '/settings/org?tab=access');
  await hydrated(adminPage);
  const cell = adminPage.locator('[data-access-page="overview"] [data-access-role="member"]');
  await cell.getByRole('combobox').click();
  await adminPage.getByRole('option', { name: 'View' }).click();
  await adminPage.getByRole('dialog').getByLabel('Reason').fill('Made-up reason');
  await adminPage.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(adminPage, 'Access changed')).toBeVisible();
  await their.reload();
  await their.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
  await expect(their.locator('[data-drawer]').getByRole('link', { name: 'Overview' })).toBeVisible();
  // and back (one Undo), so the seed stays as it was for the other specs
  await toast(adminPage, 'Access changed').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(adminPage, 'Undone')).toBeVisible();
  await theirs.close();
  await adminCtx.close();
});

test('a team retires with its people moved, in one change with one Undo', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const tag = Date.now().toString(36);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/settings/org?tab=teams');
  await hydrated(page);
  for (const code of [`ta_${tag}`, `tb_${tag}`]) {
    await page.locator('[data-team-add]').click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Name', { exact: true }).fill(`Test team ${code}`);
    await d.getByLabel('Code').fill(code);
    await expect(d.locator('[data-team-save]'), 'the Arabic name is required (V97)').toBeDisabled();
    await d.getByLabel('Name (Arabic)').fill(`فريق تجريبي ${code}`);
    await d.locator('[data-team-save]').click();
    await expect(toast(page, 'Team saved')).toBeVisible();
    await expect(page.locator(`[data-team-row="${code}"]`)).toBeVisible();
  }
  const [teamA] = await sql<{ id: string }>(`select id from core.team where code = $1`, [`ta_${tag}`]);
  await sql(`update core.person set team_id = $1 where id = $2`, [teamA!.id, admin.id]);
  await page.reload();
  await hydrated(page);
  const rowA = page.locator(`[data-team-row="ta_${tag}"]`);
  await rowA.locator('[data-team-retire]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('1 people');
  await dialog.getByLabel('Move its people to').click();
  await page.getByRole('option', { name: `Test team tb_${tag}` }).click();
  await dialog.getByLabel('Reason').fill('Made-up reason');
  await dialog.locator('[data-reason-save]').click();
  await expect(toast(page, 'retired')).toBeVisible();
  const [moved] = await sql<{ code: string }>(
    `select t.code from core.person p join core.team t on t.id = p.team_id where p.id = $1`,
    [admin.id],
  );
  expect(moved!.code).toBe(`tb_${tag}`);
  await toast(page, 'retired').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  const [back] = await sql<{ code: string; active: boolean }>(
    `select t.code, t.active from core.person p join core.team t on t.id = p.team_id where p.id = $1`,
    [admin.id],
  );
  expect(back).toMatchObject({ code: `ta_${tag}`, active: true });
});

test('a non-admin is refused Settings by address', async ({ page }) => {
  const member = await makePerson();
  await signIn(page, member.email, '/settings/work');
  await hydrated(page);
  await expect(page.locator('[data-state="no-access"]')).toBeVisible();
  await expect(page.locator('[data-setting]')).toHaveCount(0);
});

test('an admin edits one field of a person: only that field is sent, and the form reopens on the stored values', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const member = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, `/people/${member.id}`);
  await hydrated(page);

  // one field changed → one field in the request (the old app's lesson: never every field, never a stale copy)
  await page.locator('[data-person-edit]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Full name')).toHaveValue(member.name);
  await dialog.getByLabel('Job title').fill('Made-up title');
  const sent = page.waitForRequest((r) => r.url().includes('/rpc/person_update') && r.method() === 'POST');
  await dialog.locator('[data-person-save]').click();
  const body = (await sent).postDataJSON() as { p_changes: Record<string, unknown>; p_version: number };
  expect(Object.keys(body.p_changes), 'only the changed fields are sent').toEqual(['job_title_en']);
  await expect(toast(page, 'updated')).toBeVisible();
  await expect(page.getByRole('main').getByText(/^Made-up title · /)).toBeVisible();

  // someone else changes the record (a team, by SQL here); the form, reopened after a reload, starts from that —
  // and the write is checked against the fresh version, so it is not refused as a conflict
  const tag = Date.now().toString(36);
  const [team] = await sql<{ id: string; name: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id, name_en as name`,
    [member.id, `te_${tag}`, `Test Team Edit ${tag}`, `فريق اختبار ${tag}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
  // the page reads again without a reload (a tab and back is a client-side navigation: the screen stays mounted)
  await page.getByRole('main').getByRole('link', { name: 'Activity' }).click();
  await page.getByRole('main').getByRole('link', { name: 'Overview' }).click();
  await expect(page.locator('[data-record-rail]')).toContainText(team!.name);
  await page.locator('[data-person-edit]').click();
  await expect(page.getByRole('dialog').getByLabel('Team'), 'the form shows the stored value').toContainText(
    team!.name,
  );
  await expect(page.getByRole('dialog').getByLabel('Job title')).toHaveValue('Made-up title');
  await page.getByRole('dialog').getByLabel('Job title').fill('Made-up title two');
  const again = page.waitForRequest((r) => r.url().includes('/rpc/person_update') && r.method() === 'POST');
  await page.getByRole('dialog').locator('[data-person-save]').click();
  const second = (await again).postDataJSON() as { p_changes: Record<string, unknown>; p_version: number };
  expect(Object.keys(second.p_changes)).toEqual(['job_title_en']);
  expect(second.p_version).toBeGreaterThan(body.p_version);
  await expect(toast(page, 'updated').last()).toBeVisible();
  await expect(page.getByRole('main').getByText(/^Made-up title two · /)).toBeVisible();
});
