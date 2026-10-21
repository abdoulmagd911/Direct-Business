/**
 * What V645 asks of Settings, as data only: the Partners settings page lists the activity types WhatsApp, Email and
 * Ticket beside the old ones, and the internal counterparts — Operations, Product, Website and app developers, Support —
 * as a list of their own, in that order, with both names; an admin sees them at a phone and a desk width. Every value
 * is made up.
 * Sabotage: tests/sabotage/settings-internal-lists.mjs "settings-hides-the-internal-counterparts".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const [label, width, height] of [
  ['phone 375', 375, 800],
  ['desk 1440', 1440, 900],
] as const) {
  test(`${label}: Settings lists WhatsApp, Email and Ticket as activity types and the internal counterparts in order`, async ({
    page,
  }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width, height });
    await signIn(page, admin.email, '/settings/partners');
    await hydrated(page);

    const types = page.locator('[data-list="activity_type"]');
    for (const key of ['whatsapp', 'email', 'ticket'])
      await expect(types.locator(`[data-list-entry="${key}"]`), `${key} is an activity type`).toHaveCount(1);
    await expect(types.locator('[data-list-entry="whatsapp"]')).toContainText('WhatsApp');
    await expect(types.locator('[data-list-entry="ticket"]')).toContainText('Ticket');

    const internal = page.locator('[data-list="internal_counterpart"]');
    await expect(internal, 'the internal counterparts are a list of their own').toBeVisible();
    await expect(internal.getByRole('heading', { name: 'Internal counterpart' })).toBeVisible();
    const keys = await internal
      .locator('[data-list-entry]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-list-entry')));
    expect(keys, 'Operations, Product, Website and app developers, Support — in that order').toEqual([
      'operations',
      'product',
      'website_app_developers',
      'support',
    ]);
    await expect(internal.locator('[data-list-entry="website_app_developers"]')).toContainText(
      'Website and app developers',
    );
  });
}
