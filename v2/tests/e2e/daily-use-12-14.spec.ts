/**
 * Daily use, items 13 and 14 (V638), at 375 px and at 1,440 px: a date box shows the date as `3 Sep 2026` — a three-letter
 * month, never "Sept" and never the browser's own layout — while the form still reads `2026-09-03`; and a reminder for a
 * later day on My day says Done (not Remove), wraps a long title instead of cutting it off, and ends the reminder.
 * (The fade on a scrolling tab row and the formatter itself are held by unit tests: tests/unit/ui, tests/unit/format.)
 * Every value is made up. Sabotages: tests/sabotage/daily-use.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const tag = () => Math.random().toString(36).slice(2, 8);
const WIDTHS = [375, 1440] as const;

for (const width of WIDTHS) {
  test(`a date box shows 3 Sep 2026 and keeps 2026-09-03 — at ${width} px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/finance/new');
    await hydrated(page);
    const created = page.getByLabel('Created');
    await created.fill('2026-09-03');
    await expect(created).toHaveValue('2026-09-03');
    const shown = created.locator('xpath=..').locator('[data-date-text]');
    await expect(shown).toHaveText('3 Sep 2026');
    const text = await page.locator('[data-date-text]').allTextContents();
    for (const t of text) expect(t, 'one format for every date box').toMatch(/^(—|\d{1,2} [A-Z][a-z]{2} \d{4})$/);
    const box = await created.boundingBox();
    expect(box!.height, 'a 44 px target').toBeGreaterThanOrEqual(40);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  });

  test(`a date typed by keyboard is seen as it goes in — at ${width} px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/finance/new');
    await hydrated(page);
    const created = page.getByLabel('Created');
    const shown = created.locator('xpath=..').locator('[data-date-text]');
    await expect(created, 'the real field stays out of sight until it is reached').toHaveCSS('opacity', '0');
    await created.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(created, 'the real date field shows while it has keyboard focus').toHaveCSS('opacity', '1');
    await expect(shown, 'the written date steps aside while it has keyboard focus').toHaveCSS('visibility', 'hidden');
    await page.keyboard.type('03092026');
    await expect(created).toHaveValue('2026-03-09');
    await page.keyboard.press('Tab');
    await expect(created).toHaveCSS('opacity', '0');
    await expect(shown).toHaveText('9 Mar 2026');
  });

  test(`a reminder for a later day says Done and wraps its title — at ${width} px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    const t = tag();
    const title = `Ask the made-up Dune Foods buyer ${t} about the renewal terms and the new delivery schedule`;
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const made = await callAs(page.context(), 'note_capture', {
      p_kind: 'reminder',
      p_values: { title, remind_at: new Date(Date.now() + 5 * 86_400_000).toISOString() },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await page.reload();
    await hydrated(page);
    const row = page.locator('[data-reminder]', { hasText: `Dune Foods buyer ${t}` });
    await expect(row).toBeVisible();
    const done = row.locator('[data-reminder-done-later]');
    await expect(done).toHaveText('Done');
    await expect(row.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    const words = row.locator('span').first();
    const fits = await words.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fits, 'the words are not cut off').toBe(true);
    if (width === 375) {
      const { h, line } = await words.evaluate((el) => ({
        h: el.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(el).lineHeight) || 20,
      }));
      expect(h, 'the title wraps to a second line on a phone').toBeGreaterThanOrEqual(line * 1.5);
    }
    expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(32);
    await done.click();
    if (width === 375) {
      // a toast on a phone sits above the bottom bar and the + button, never over them
      const toast = page.locator('[data-sonner-toast][data-front="true"]');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText('Reminder done');
      await page.waitForTimeout(600); // the toast has finished sliding in
      const t = (await toast.boundingBox())!;
      const bar = (await page.locator('[data-bottom-bar]').boundingBox())!;
      const plus = (await page.locator('[data-create-bar]').boundingBox())!;
      expect(t.y + t.height, 'the toast ends above the bottom bar').toBeLessThanOrEqual(bar.y);
      expect(t.y + t.height, 'and above the + button').toBeLessThanOrEqual(plus.y);
    }
    await expect(row).toHaveCount(0);
    const [gone] = await sql<{ n: number }>(
      `select count(*)::int as n from core.reminder r join my.note n on n.id = r.note_id
        where n.person_id = $1 and n.title = $2 and r.deleted_at is null`,
      [me.id, title],
    );
    expect(gone!.n, 'Done ended the reminder').toBe(0);
  });
}
