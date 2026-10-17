/**
 * Architect's order of 16 Oct (builder B): Log activity's disabled Save says in one line what is still to choose, and
 * after saving the client's header (Last activity, Next step) shows the new day and step in place — the page is not
 * reloaded. Checked at 1440 and at 375 px, where the line fits and the page does not scroll sideways.
 * Sabotages: tests/sabotage/log-activity.mjs "a-disabled-save-says-nothing", "the-header-stays-old-after-saving".
 */
import { type Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [1440, 375]) {
  test(`Log activity at ${width}px says why Save is off, and the header refreshes in place`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: width === 375 ? 800 : 1000 });
    await signIn(page, admin.email, '/clients');
    const r = await callAs(context, 'partner_create', {
      p_partner: { trade_name_en: `Test Org ${tag()}`, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const id = (r.body as { id: string }).id;
    await page.goto(`/clients/${id}`);
    await hydrated(page);
    await page.evaluate(() => {
      (window as unknown as { __same: boolean }).__same = true;
    });
    const figures = page.locator('[data-key-figures]');
    await expect(figures).toContainText('No activity yet');

    await page.locator('[data-activity-log]').first().click();
    const form = page.locator('[data-activity-form]');
    const why = page.locator('[data-activity-why]');
    const save = page.locator('[data-activity-save]');
    await expect(save).toBeDisabled();
    await expect(why, 'the line under the form').toHaveText('Choose a type');

    await form.getByLabel('Type').click();
    await page.getByRole('option', { name: 'Call' }).click();
    await expect(why).toHaveText('Choose an outcome');
    await form.getByLabel('Outcome').click();
    await page.getByRole('option', { name: 'Answered' }).click();
    await expect(why, 'nothing missing, no line').toHaveCount(0);
    await expect(save).toBeEnabled();

    await form.getByLabel('Next step', { exact: true }).fill('Send the made-up offer');
    await expect(why).toHaveText('Choose a next-step date');
    await expect(save).toBeDisabled();
    // the line sits inside the dialog and the page does not scroll sideways
    const box = await why.boundingBox();
    expect(box!.x + box!.width, 'the line fits the screen').toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await form.getByLabel('Next step on').fill('2099-01-15');
    await expect(why).toHaveCount(0);
    await save.click();
    await expect(figures, 'Last activity shows a day').not.toContainText('No activity yet');
    await expect(figures).toContainText('15 Jan 2099');
    await expect(figures).toContainText('Send the made-up offer');
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same), 'no reload').toBe(true);
  });
}
