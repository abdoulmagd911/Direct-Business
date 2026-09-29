/**
 * P3-7 (V401, §3.3, FLOW-08): two people edit one record — different fields both keep, the same field opens the
 * conflict dialog naming who changed it and the second person chooses; a change by someone else reaches the bell,
 * is marked read and snoozed; Follow tells a follower; saved views save, open first, remove and come back from
 * Recently deleted; a bulk action is one command for the whole selection; Ctrl K finds a person by name.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

async function editJobTitle(page: Page, title: string) {
  await page.locator('[data-person-edit]').click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Job title', { exact: true }).fill(title);
  await d.locator('[data-person-save]').click();
}

test('two people, one record: different fields both keep; the same field asks the second who changed it (FLOW-08)', async ({
  page,
  browser,
}) => {
  const a = await makePerson({ admin: true });
  const b = await makePerson({ admin: true });
  const target = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, a.email, `/people/${target.id}`);
  await hydrated(page);
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await pageB.setViewportSize({ width: 1500, height: 1000 });
  await signIn(pageB, b.email, `/people/${target.id}`);
  await hydrated(pageB);

  // A changes the job title; B, on the same stale page, changes the name: both keep (the database checks per field)
  await editJobTitle(page, 'Title from A');
  await expect(toast(page, 'updated')).toBeVisible();
  await pageB.locator('[data-person-edit]').click();
  await pageB.getByRole('dialog').getByLabel('Full name', { exact: true }).fill(`${target.name} B`);
  await pageB.getByRole('dialog').locator('[data-person-save]').click();
  await expect(toast(pageB, 'updated')).toBeVisible();
  await expect(pageB.getByRole('dialog')).toBeHidden();
  const [both] = await sql<{ full_name_en: string; job_title_en: string }>(
    `select full_name_en, job_title_en from core.person where id = $1`,
    [target.id],
  );
  expect(both).toMatchObject({ full_name_en: `${target.name} B`, job_title_en: 'Title from A' });

  // now the same field: A writes again; B (still on the earlier version) is told who changed it and chooses mine
  await page.reload();
  await hydrated(page);
  await editJobTitle(page, 'Title A again');
  await expect(toast(page, 'updated')).toBeVisible();
  await editJobTitle(pageB, 'Title from B');
  const conflict = pageB.locator('[data-conflict-dialog]');
  await expect(conflict).toBeVisible();
  await expect(pageB.getByRole('dialog', { name: `${a.name} changed this since you opened it` })).toBeVisible();
  const field = conflict.locator('[data-conflict-field="job_title_en"]');
  await expect(field).toContainText('Title A again');
  await expect(field).toContainText('Title from B');
  await expect(conflict.locator('[data-conflict-field]')).toHaveCount(1); // only the field both changed
  await expect(pageB.locator('[data-conflict-save]')).toBeDisabled();
  await field.locator('[data-conflict-pick="mine"]').check();
  await pageB.locator('[data-conflict-save]').click();
  await expect(conflict).toBeHidden();
  await expect(pageB.getByRole('dialog')).toBeHidden();
  await expect
    .poll(async () => {
      const [after] = await sql<{ job_title_en: string }>(`select job_title_en from core.person where id = $1`, [
        target.id,
      ]);
      return after!.job_title_en;
    })
    .toBe('Title from B');
  await ctxB.close();
});

test('a change by someone else reaches the bell; it is marked read and snoozed; Follow tells a follower', async ({
  page,
  browser,
}) => {
  const admin = await makePerson({ admin: true });
  // the one who is told is an admin too: a person record's follow reads through its visibility rule, which today
  // is the Organization & access page's level (admins only — builder A's NEED: people visible to everyone)
  const member = await makePerson({ admin: true });
  const other = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, member.email, `/people/${other.id}`);
  await hydrated(page);
  await expect(page.locator('[data-bell]')).toHaveAttribute('data-unread', '0');
  // the member follows the other person's record
  await page.locator('[data-follow]').click();
  await expect(page.locator('[data-follow][data-following]')).toBeVisible();

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await adminPage.setViewportSize({ width: 1500, height: 1000 });
  await signIn(adminPage, admin.email, `/people/${member.id}`);
  await hydrated(adminPage);
  await editJobTitle(adminPage, 'Made-up title');
  await expect(toast(adminPage, 'updated')).toBeVisible();
  await adminPage.goto(`/people/${other.id}`);
  await hydrated(adminPage);
  await editJobTitle(adminPage, 'Another made-up title');
  await expect(toast(adminPage, 'updated')).toBeVisible();

  // the bell: opening the panel re-reads; two unread — my own record changed, and the record I follow
  await page.locator('[data-bell]').click();
  const panel = page.locator('[data-notifications-panel]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-notification][data-unread]')).toHaveCount(2);
  await expect(panel).toContainText(`${admin.name} changed your Person`);
  await expect(panel).toContainText(`${admin.name} changed Person you follow`);
  await expect(page.locator('[data-bell]')).toHaveAttribute('data-unread', '2');
  await expect(panel.locator('[data-notifications-group="today"]')).toBeVisible();
  // snooze one until tomorrow: it leaves the list
  await panel.locator('[data-notification]').first().locator('[data-notification-snooze]').click();
  await page.getByRole('menuitem', { name: 'Until tomorrow 08:00' }).click();
  await expect(panel.locator('[data-notification]')).toHaveCount(1);
  const [snoozed] = await sql<{ n: string }>(
    `select count(*)::text as n from notify.notification where person_id = $1 and snoozed_until > now()`,
    [member.id],
  );
  expect(snoozed!.n).toBe('1');
  // mark all read: the dot and the count go
  await panel.locator('[data-notifications-mark-all]').click();
  await expect(panel.locator('[data-notification][data-unread]')).toHaveCount(0);
  await expect(page.locator('[data-bell]')).toHaveAttribute('data-unread', '0');
  // the item left (my own record's change) is a link to its record; Escape closes the panel and focus returns to the bell
  await expect(panel.locator('[data-notification-link]').first()).toHaveAttribute('href', `/people/${member.id}`);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('[data-bell]')).toBeFocused();
  await adminCtx.close();
});

test('a saved view saves, opens first, is removed and comes back from Recently deleted; a bulk action is one command', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const tag = Date.now().toString(36);
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/kit');
  await hydrated(page);
  const bar = page.locator('[data-saved-views]');
  await bar.locator('[data-view-save]').click();
  await page.getByRole('dialog').getByLabel('Name').fill(`Test view ${tag}`);
  await page.getByRole('dialog').locator('[data-view-save-confirm]').click();
  await expect(toast(page, 'View saved')).toBeVisible();
  const pill = bar.locator('[data-saved-view]', { hasText: `Test view ${tag}` });
  await expect(pill).toBeVisible();
  await expect(pill.getByRole('button', { name: `Test view ${tag}`, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const [saved] = await sql<{ id: string; query: { view: string } }>(
    `select id, query from core.saved_view where name = $1 and deleted_at is null`,
    [`Test view ${tag}`],
  );
  expect(saved!.query.view, 'the filters as they stood are what the view keeps').toBe('all');
  // open this view first
  await pill.locator('[data-view-menu]').click();
  await page.getByRole('menuitem', { name: 'Open this view first' }).click();
  await expect(pill.locator('[data-view-default-mark]')).toBeVisible();
  const [dflt] = await sql<{ saved_view_id: string }>(
    `select saved_view_id from core.person_default_view where person_id = $1 and page_key = 'clients'`,
    [admin.id],
  );
  expect(dflt!.saved_view_id).toBe(saved!.id);
  // remove: soft, and it waits in Recently deleted with Restore
  await pill.locator('[data-view-menu]').click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
  await expect(toast(page, `Test view ${tag} removed`)).toBeVisible();
  await expect(pill).toHaveCount(0);
  const [gone] = await sql<{ deleted: boolean }>(
    `select deleted_at is not null as deleted from core.saved_view where id = $1`,
    [saved!.id],
  );
  expect(gone!.deleted, 'removed, never deleted').toBe(true);
  await page.goto('/activity?tab=deleted');
  await hydrated(page);
  const row = page.locator(`[data-deleted-row="${saved!.id}"]`);
  // the row names the record type (its name joins when api.recently_deleted reads saved views' `name` — A's NEED)
  await expect(row).toContainText('Saved view');
  await row.locator('[data-deleted-restore]').click();
  await expect(toast(page, 'restored')).toBeVisible();
  await expect(row).toHaveCount(0);
  const [back] = await sql<{ deleted: boolean }>(
    `select deleted_at is not null as deleted from core.saved_view where id = $1`,
    [saved!.id],
  );
  expect(back!.deleted).toBe(false);

  // the bulk bar: three rows selected → one command with the three ids
  await page.goto('/kit');
  await hydrated(page);
  await expect(page.locator('[data-saved-view]', { hasText: `Test view ${tag}` })).toBeVisible();
  const table = page.locator('[data-kit-section="Table"]');
  for (let i = 0; i < 3; i += 1) await table.locator('tr[data-index]').nth(i).getByLabel('Select row').click();
  const bulk = page.locator('[data-bulk-bar]');
  await expect(bulk.locator('[data-bulk-count]')).toHaveText('3 selected');
  await bulk.locator('[data-bulk-action="assign"]').click();
  await expect(toast(page, '3 assigned')).toBeVisible();
  await expect(bulk).toHaveCount(0);
  await expect(page.locator('[data-bulk-calls]')).toHaveAttribute('data-bulk-calls', '1');
  await expect(page.locator('[data-bulk-calls]')).toHaveAttribute('data-bulk-ids', '3');
  // the saved view is removed again so the kit page stays as the other specs expect
  await sql(`update core.saved_view set deleted_at = now() where id = $1`, [saved!.id]);
});

test('Ctrl K finds a person by name and opens their record', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  const other = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await expect(palette).toBeVisible();
  await palette.getByRole('combobox').fill(other.name.slice(0, 16));
  const hit = palette.locator(`[data-palette-person="${other.id}"]`);
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(new RegExp(`/people/${other.id}$`));
});
