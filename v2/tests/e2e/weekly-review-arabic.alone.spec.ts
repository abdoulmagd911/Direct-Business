/**
 * The weekly review (V632 Stage 3) in Arabic at 375 px: right to left, the catalog's own words, no sideways scroll.
 * Arabic is a setting that reaches every screen, which is why this file runs alone. Every value is made up.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { setPrefs } from './helpers';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
type Words = { pages: { weeklyReview: { title: string; notes: { title: string }; done: { empty: string } } } };
const ar = JSON.parse(readFileSync(join(process.cwd(), 'messages', 'ar.json'), 'utf8')) as Words;

test('in Arabic at 375 px: the weekly review reads right to left in the catalog’s words', async ({ page, context }) => {
  const admin = await makePerson({ admin: true });
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: weekly review spec', $1)`,
    [admin.id],
  );
  try {
    const me = await makePerson();
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const note = await callAs(context, 'note_capture', { p_kind: 'sticky', p_values: { title: 'ملاحظة تجريبية' } });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
    await setPrefs(context, { locale: 'ar' });
    await page.goto('/my-day/week');
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const w = ar.pages.weeklyReview;
    await expect(page.locator('h1')).toHaveText(w.title);
    await expect(page.locator('[data-review-section="notes"] h2')).toContainText(w.notes.title);
    await expect(page.locator('[data-review-section="done"]')).toContainText(w.done.empty);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      'no sideways scroll',
    ).toBe(true);
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});
