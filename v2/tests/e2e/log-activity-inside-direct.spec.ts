/**
 * V645 / V646 second part — Log activity with someone inside Direct: the question offers "Someone inside Direct", a
 * team or system from the Settings list (Operations …) is chosen, the form carries an optional ticket reference and
 * "Share with my team", and the activity is filed on the author's own record with no organisation. At 375 and 1,440 px.
 * Every value is made up.
 * Sabotages: tests/sabotage/log-activity-entry.mjs "log-activity-inside-needs-no-team", "log-activity-drops-the-ticket".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [375, 1440]) {
  test(`an activity with a team inside Direct needs the team, carries a ticket reference and has no organisation — at ${width} px`, async ({
    page,
  }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
    await page.locator('[data-create-item="activity"]').click();

    const next = page.locator('[data-activity-who-next]');
    await page.getByLabel('It was with').click();
    await page.getByRole('option', { name: 'Someone inside Direct' }).click();
    await expect(next, 'Next waits for a team or system').toBeDisabled();
    await expect(page.locator('[data-activity-who-why]')).toHaveText('Choose a team or system');
    await page.getByLabel('Team or system').click();
    await page.getByRole('option', { name: 'Operations' }).click();
    await expect(next).toBeEnabled();
    await next.click();

    const form = page.locator('[data-activity-form]');
    await expect(form).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Log activity for Operations');
    await expect(form.getByLabel('Type')).toContainText('Call');
    await form.getByLabel('Outcome').click();
    await page.getByRole('option', { name: 'Answered' }).click();
    await form.getByLabel('What happened').fill('TEST: asked Operations about the made-up booking');
    await form.getByLabel('Ticket reference (optional)').fill('TEST-1234');
    await page.getByRole('checkbox', { name: 'Share with my team' }).click();
    await page.locator('[data-activity-save]').click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText('Call logged for Operations')).toBeVisible();

    const rows = await sql<{ n: number; ticket: string | null; shared: boolean; person: boolean }>(
      `select count(*)::int as n, max(n.ticket_ref) as ticket, bool_or(n.shared_with_team) as shared,
              bool_and(n.entity_table = 'core.person' and n.entity_id = n.created_by) as person
         from core.note n where n.internal_counterpart_id is not null and n.created_by = $1`,
      [admin.id],
    );
    expect(rows[0]?.n, 'the activity is filed').toBe(1);
    expect(rows[0]?.ticket).toBe('TEST-1234');
    expect(rows[0]?.shared, 'shared with the author’s team').toBe(true);
    expect(rows[0]?.person, 'on the author’s own record, with no organisation').toBe(true);
  });
}
