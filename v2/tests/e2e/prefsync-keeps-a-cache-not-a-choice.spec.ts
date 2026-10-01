/**
 * QA-210: what PrefsSync copies into the browser's cookies is a cache of the person's profile (or the admin's default),
 * never a choice made in this browser — so when the profile changes elsewhere, the next page shows the new theme. A theme
 * chosen in this browser is its own choice and still wins until it is saved. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "prefsync-copies-the-default-as-a-choice".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('a theme PrefsSync copied from the profile gives way when the profile changes elsewhere (QA-210)', async ({
  page,
}) => {
  const member = await makePerson();
  await sql(`insert into core.person_profile (person_id, created_by, theme) values ($1, $1, 'dark')`, [member.id]);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // changed on another device
  await sql(`update core.person_profile set theme = 'light' where person_id = $1`, [member.id]);
  await page.reload();
  await hydrated(page);
  await expect(page.locator('html'), 'the profile still wins over what was copied').toHaveAttribute(
    'data-theme',
    'light',
  );
});
