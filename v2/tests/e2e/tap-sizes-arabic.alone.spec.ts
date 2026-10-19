/**
 * The Architect's ruling V643 (19 Oct): the 44 px rule holds in Arabic too — wide AND high. Arabic is switched on for the
 * length of this walk (a spec that changes a company setting runs alone), the person's own profile says Arabic, and the
 * same walk as the English one is made at 375 px, right to left. Every value is made up.
 * Sabotages: tests/sabotage/tap-sizes.mjs.
 */
import { expect, test } from '@playwright/test';
import { sql } from './support/stack';
import { seed, walk } from './support/taps';

test('every tappable thing is at least 44 px wide and high on a phone, on every page and in the dialogs and menus — Arabic', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 800 });
  const { me, clientId, number } = await seed(page);
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: the Arabic tap walk', $1)`,
    [me.id],
  );
  try {
    await sql(`insert into core.person_profile (person_id, created_by, locale) values ($1, $1, 'ar')`, [me.id]);
    await page.context().addCookies([{ name: 'v2.locale', value: 'ar', url: new URL(page.url()).origin }]);
    await page.goto('/my-day');
    await expect(page.locator('html'), 'the Arabic walk is in Arabic, right to left').toHaveAttribute('dir', 'rtl');
    expect(await walk(page, me, clientId, number), 'every tappable thing is 44 px wide and high on a phone').toEqual(
      [],
    );
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});
