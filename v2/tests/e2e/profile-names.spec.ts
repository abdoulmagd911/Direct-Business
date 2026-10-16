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

// An empty name box shows, in grey, the name the header shows (the Architect's ruling, 16 Oct); it is never saved.
for (const width of [375, 1440]) {
  test(`an empty name box shows the header's name in grey and saves nothing — at ${width} px`, async ({ page }) => {
    const member = await makePerson();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, member.email, '/profile');
    await hydrated(page);
    const en = page.getByLabel('Display name', { exact: true });
    const ar = page.getByLabel('Display name (Arabic)', { exact: true });
    await expect(en).toHaveValue('');
    await expect(ar).toHaveValue('');
    await expect(en, 'the English box shows the name as grey words').toHaveAttribute('placeholder', member.name);
    await expect(ar, 'and so does the Arabic box').toHaveAttribute('placeholder', member.name);
    if (width > 700)
      await expect(page.locator('[data-topbar] [data-profile-chip]'), 'the name the header shows').toContainText(
        member.name,
      );
    const fits = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder]'))
        .filter((e) => e.placeholder.startsWith('Test Person'))
        .map((e) => e.scrollWidth <= e.clientWidth),
    );
    expect(fits, 'the words fit their boxes').toEqual([true, true]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);

    for (const box of [en, ar]) {
      await box.focus();
      await box.blur();
    }
    await page.waitForTimeout(800);
    const [saved] = await sql<{ n: string }>(
      `select count(*)::text as n from core.person_profile
        where person_id = $1 and (display_name_en is not null or display_name_ar is not null)`,
      [member.id],
    );
    expect(saved?.n, 'looking at the grey words saved no name').toBe('0');
    await expect(en).toHaveValue('');
    await expect(ar).toHaveValue('');
  });
}

test('once there is a display name the header shows it, and the empty Arabic box shows it too — at 375 px', async ({
  page,
}) => {
  const member = await makePerson();
  await sql(
    `insert into core.person_profile (person_id, created_by, display_name_en) values ($1, $1, 'Test Display')`,
    [member.id],
  );
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Test Display');
  await expect(
    page.getByLabel('Display name (Arabic)', { exact: true }),
    'the empty Arabic box shows the name the header shows',
  ).toHaveAttribute('placeholder', 'Test Display');
});
