/**
 * V646 — Log activity in the +: between Task and Log achievement, it asks "Who was it with?" first (a client, lead or
 * supplier chosen by name), then opens the form a record page has and files the activity. At 375 px (the + in the
 * bottom bar) and 1,440 px (Create in the top bar). Every value is made up.
 * Sabotages: tests/sabotage/log-activity-entry.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [375, 1440]) {
  test(`the + offers Log activity between Task and the achievement, asks who it was with, and files it — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const name = `TEST Whoorg ${tag()}`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const made = await callAs(context, 'partner_create', {
      p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const partnerId = (made.body as { id: string }).id;

    await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
    const order = await page
      .locator('[data-create-item]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-create-item')));
    expect(order.indexOf('activity'), 'Log activity is offered').toBeGreaterThan(-1);
    expect(order.indexOf('activity'), 'after Task').toBeGreaterThan(order.indexOf('task'));
    expect(order.indexOf('activity'), 'before the achievement').toBeLessThan(order.indexOf('achievement'));
    const item = page.locator('[data-create-item="activity"]');
    if (width < 700) expect((await item.boundingBox())!.height, 'a 44 px item').toBeGreaterThanOrEqual(43.5);
    await item.click();

    // "Who was it with?" first; Next waits for an organisation
    const next = page.locator('[data-activity-who-next]');
    await expect(page.getByRole('dialog').first()).toContainText('Who was it with?');
    await expect(next).toBeDisabled();
    await page.locator('[data-partner-search]').fill(name.slice(0, 8));
    await page.locator(`[data-partner-hit="${partnerId}"]`).click();
    await expect(next).toBeEnabled();
    await next.click();

    // the form a record page has
    const form = page.locator('[data-activity-form]');
    await expect(form).toBeVisible();
    // the title says where it lands; Change goes back to the question and keeps the choice
    await expect(page.getByRole('dialog')).toContainText(`Log activity for ${name}`);
    await page.locator('[data-activity-change]').click();
    await expect(page.getByRole('dialog').first()).toContainText('Who was it with?');
    await expect(next).toBeEnabled();
    await next.click();
    await expect(form).toBeVisible();
    // the type opens on Call the first time, so it is never empty and only the outcome is still asked
    await expect(form.getByLabel('Type')).toContainText('Call');
    await form.getByLabel('Outcome').click();
    await page.getByRole('option', { name: 'Answered' }).click();
    await page.locator('[data-activity-save]').click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText(`Call logged for ${name}`)).toBeVisible();
    const [row] = await sql<{ n: number }>(
      `select count(*)::int as n from core.note
        where entity_table = 'partner.partner' and entity_id = $1 and activity_type_id is not null`,
      [partnerId],
    );
    expect(row?.n, 'the activity is filed against the organisation chosen').toBe(1);
  });
}
