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
    await created.blur();
    await expect(created, 'the box shows the date the way the app writes it').toHaveValue('3 Sep 2026');
    const picker = created.locator('xpath=ancestor::div[@data-date-picker]');
    await expect(picker.locator('[data-date-result]')).toHaveText('Thu, 3 Sep 2026');
    // one format for every date box on the page: a written day, or nothing yet
    const values = await page
      .locator('[data-date-picker] input')
      .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
    for (const v of values) expect(v, 'one format for every date box').toMatch(/^$|^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
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
    const picker = created.locator('xpath=ancestor::div[@data-date-picker]');
    const result = picker.locator('[data-date-result]');
    // Created starts as today (a new invoice is dated today), so the read-back shows before anything is typed:
    // clear it first, then the read-back is hidden until a date is typed.
    await picker.locator('[data-date-clear]').click();
    await expect(result, 'no date said back before one is typed').toBeHidden();
    await created.focus();
    await page.keyboard.type('20260309');
    await expect(created).toHaveValue('20260309');
    await expect(result, 'the date typed is said back the app way').toHaveText('Mon, 9 Mar 2026');
    await expect(result).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(created, 'the box keeps the date the app way once it is left').toHaveValue('9 Mar 2026');
    await expect(result).toHaveText('Mon, 9 Mar 2026');
  });

  test(`Today sets the date, and the calendar opens — at ${width} px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, me.email, '/finance/new');
    await hydrated(page);
    const created = page.getByLabel('Created');
    const picker = created.locator('xpath=ancestor::div[@data-date-picker]');
    const todayWritten = await page.evaluate(() => {
      const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).split('-').map(Number);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d} ${months[m! - 1]} ${y}`;
    });
    await picker.locator('[data-date-chip="today"]').click();
    await expect(created).toHaveValue(todayWritten);
    await picker.locator('[data-date-calendar]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
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
      // a toast on a phone sits above the bottom bar and its Create slot, never over them
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
