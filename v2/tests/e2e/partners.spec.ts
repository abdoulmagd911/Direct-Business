/**
 * P3-9a — Clients, and Suppliers & partners (V98, V146–V154): an admin creates a supplier from its list and the record
 * opens with its five header figures; the Client side is switched on from the record's ⋯ door; At risk refuses to save
 * without a reason; an activity is logged and appears in the timeline; the Arabic trade name is found by search; the
 * hover card names the number and both sides. Then twenty organisations are assigned in one command with one Undo.
 * Sabotages: tests/sabotage/screens.mjs "at-risk-needs-no-reason", "bulk-assign-one-by-one", "hover-card-shows-one-side".
 */
import { type BrowserContext, type Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const tag = () => Math.random().toString(36).slice(2, 8);

async function createPartner(context: BrowserContext, name: string, side: 'client' | 'supplier_partner', type: string) {
  const r = await callAs(context, 'partner_create', { p_partner: { trade_name_en: name, sides: [{ side, type }] } });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return (r.body as { id: string }).id;
}

test('an admin creates a supplier, switches its Client side on, sets At risk with a reason, logs a call; Arabic search; the hover card', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  const t = tag();
  const name = `Test Org ${t}`;
  const arabic = `شركة اختبار ${t}`;
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/suppliers');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Suppliers & partners' })).toBeVisible();

  // New supplier & partner: trade name, Arabic name, type — the record opens once saved
  await page.locator('[data-partner-new]').click();
  const form = page.locator('[data-partner-form]');
  await form.getByLabel('Trade name', { exact: true }).fill(name);
  await form.getByLabel('Trade name (Arabic)').fill(arabic);
  await form.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Supplier', exact: true }).click();
  await page.locator('[data-partner-save]').click();
  await expect(toast(page, `${name} added`)).toBeVisible();
  await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]{36}$/);
  await hydrated(page);
  const id = page.url().split('/').pop()!;
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  const figures = page.locator('[data-key-figures]');
  for (const label of ['Last activity', 'Next step', 'Contracts', 'Contacts', 'Files']) {
    await expect(figures.getByText(label, { exact: true }), `the ${label} figure`).toBeVisible();
  }

  // the ⋯ door: switch the Client side on
  await page.locator('[data-partner-more]').click();
  await page.locator('[data-side-on="client"]').click();
  await page.locator('[data-side-form="client"]').getByLabel('Type').click();
  await page.getByRole('option', { name: 'Corporate' }).click();
  await page.locator('[data-side-save]').click();
  await expect(toast(page, 'Client side switched on')).toBeVisible();

  // At risk needs a reason: refused in place until one is chosen
  await page.locator('[data-partner-more]').click();
  await page.locator('[data-status-set="client"]').click();
  const status = page.locator('[data-status-form]');
  await status.getByLabel('Status').click();
  await page.getByRole('option', { name: 'At risk' }).click();
  await expect(status.getByText('At risk and Lost need a reason')).toBeVisible();
  await expect(page.locator('[data-status-save]')).toBeDisabled();
  await status.getByLabel('Reason').click();
  await page.getByRole('option', { name: 'Competitor' }).first().click();
  await page.locator('[data-status-save]').click();
  await expect(toast(page, 'Status set to At risk')).toBeVisible();

  // Log activity: a call with an outcome, in the timeline at once
  await page.getByRole('button', { name: 'Log activity' }).first().click();
  const activity = page.locator('[data-activity-form]');
  await activity.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Call' }).click();
  await activity.getByLabel('Outcome').click();
  await page.getByRole('option', { name: 'Answered' }).click();
  await activity.getByLabel('What happened').fill(`Called about ${t}`);
  await page.locator('[data-activity-save]').click();
  await expect(toast(page, 'Call logged')).toBeVisible();
  await expect(page.locator('[data-partner-notes]')).toContainText(`Called about ${t}`);

  // the Arabic name finds it on the Clients list (the side is on now); the hover card names number and both sides
  await page.goto(`/clients?q=${encodeURIComponent(`اختبار ${t}`)}`);
  await hydrated(page);
  const link = page.locator(`[data-partner-link="${id}"]`);
  await expect(link).toBeVisible();
  await link.hover();
  const hover = page.locator(`[data-partner-hover="${id}"]`);
  await expect(hover).toBeVisible();
  const [row] = await sql<{ number: string }>(`select number from partner.partner where id = $1`, [id]);
  await expect(hover).toContainText(row!.number);
  await expect(hover).toContainText('Client · Corporate · At risk');
  await expect(hover).toContainText('Supplier & partner · Supplier');
});

test('twenty organisations are assigned in one command, with one Undo', async ({ page, context }) => {
  const admin = await makePerson({ admin: true });
  const other = await makePerson();
  const t = tag();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, '/clients');
  await hydrated(page);
  const ids: string[] = [];
  for (let i = 0; i < 20; i += 1)
    ids.push(await createPartner(context, `Bulk ${t} ${String(i).padStart(2, '0')}`, 'client', 'corporate'));

  await page.goto(`/clients?q=${encodeURIComponent(`Bulk ${t}`)}`);
  await hydrated(page);
  await expect(page.locator('[data-partner-link]')).toHaveCount(20);
  await page.getByLabel('Select all').click();
  const bulk = page.locator('[data-bulk-bar]');
  await expect(bulk.locator('[data-bulk-count]')).toHaveText('20 selected');
  await bulk.locator('[data-bulk-action="assign"]').click();
  await page.getByRole('combobox', { name: 'Owner' }).click();
  await page.getByRole('option', { name: other.name }).click();
  await page.locator('[data-assign-save]').click();
  await expect(toast(page, '20 assigned')).toBeVisible();
  await expect(bulk).toHaveCount(0);

  const owned = () =>
    sql<{ n: string }>(
      `select count(*)::text as n from partner.partner_side s
        where s.partner_id = any($1::uuid[]) and s.side = 'client' and s.owner_id = $2 and s.deleted_at is null`,
      [ids, other.id],
    ).then((r) => Number(r[0]!.n));
  await expect.poll(owned, { message: 'every selected organisation is owned by the new owner' }).toBe(20);
  const [req] = await sql<{ n: string }>(
    `select count(distinct c.request_id)::text as n from audit.change c
      where c.table_name = 'partner.partner_side' and c.row_id in (select id from partner.partner_side where partner_id = any($1::uuid[]))
        and c.at > now() - interval '2 minutes'`,
    [ids],
  );
  expect(Number(req!.n), 'one request for the whole selection').toBe(1);

  // one Undo puts every owner back
  await toast(page, '20 assigned').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, 'Undone')).toBeVisible();
  await expect.poll(owned, { message: 'the Undo takes the owner off all twenty' }).toBe(0);
});
