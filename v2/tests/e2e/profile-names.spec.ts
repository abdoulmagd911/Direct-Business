/**
 * My profile's two name boxes (oversight's live walk, 14 Oct: the Arabic box held an email address and the English box
 * was empty). Each box shows its own stored name and saves into its own column — so a wrong value on screen is a wrong
 * value in the data, never a form that mixes the two. At 375 and 1,440 px. Sabotages: tests/sabotage/profile-names.mjs.
 * Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const width of [375, 1440]) {
  test(`each name box shows and saves its own name — at ${width} px`, async ({ page }) => {
    const member = await makePerson();
    await sql(
      `insert into core.person_profile (person_id, created_by, display_name_en, display_name_ar) values ($1, $1, 'Test Display', 'اسم تجريبي')`,
      [member.id],
    );
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, member.email, '/profile');
    await hydrated(page);
    const en = page.getByLabel('Display name', { exact: true });
    const ar = page.getByLabel('Display name (Arabic)', { exact: true });
    await expect(en, 'the English box holds the English name').toHaveValue('Test Display');
    await expect(ar, 'the Arabic box holds the Arabic name').toHaveValue('اسم تجريبي');

    await ar.fill('اسم آخر');
    await ar.blur();
    await expect
      .poll(async () => {
        const [row] = await sql<{ en: string | null; ar: string | null }>(
          `select display_name_en as en, display_name_ar as ar from core.person_profile where person_id = $1`,
          [member.id],
        );
        return `${row?.en}|${row?.ar}`;
      })
      .toBe('Test Display|اسم آخر');

    await en.fill('Other Display');
    await en.blur();
    await expect
      .poll(async () => {
        const [row] = await sql<{ en: string | null; ar: string | null }>(
          `select display_name_en as en, display_name_ar as ar from core.person_profile where person_id = $1`,
          [member.id],
        );
        return `${row?.en}|${row?.ar}`;
      })
      .toBe('Other Display|اسم آخر');
  });
}
