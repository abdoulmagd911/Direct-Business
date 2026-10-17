/**
 * V641 (owner's live test, 17 Oct): My profile's name boxes (Arabic and English) have their own Save button — off until
 * the text changes — and a half-typed name never saves by itself; the one-pick settings (theme, density) save at once.
 * Every save answers with "Profile saved" and an Undo, and each test follows the control to the place its result shows:
 * the top bar's name, the page's theme and density, the stored row. Density says in one line what its choices do.
 * At 375 and 1,440 px. Sabotages: tests/sabotage/profile-save.mjs. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });
const stored = async (id: string) =>
  (
    await sql<{ en: string | null; ar: string | null; theme: string | null; density: string | null }>(
      `select display_name_en as en, display_name_ar as ar, theme, density from core.person_profile where person_id = $1`,
      [id],
    )
  )[0];

for (const width of [375, 1440]) {
  test(`a name saves only when Save is pressed, then says Saved with an Undo — at ${width} px`, async ({ page }) => {
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
    const saveEn = en.locator('xpath=..').getByRole('button', { name: 'Save' });
    const saveAr = ar.locator('xpath=..').getByRole('button', { name: 'Save' });

    // nothing to save yet: both buttons are off, and each is a full-size target on a phone
    await expect(saveEn, 'Save is off until the text changes').toBeDisabled();
    await expect(saveAr, 'Save is off until the text changes').toBeDisabled();
    const box = await saveEn.boundingBox();
    expect(box!.height, 'Save is a full-size target').toBeGreaterThanOrEqual(width < 700 ? 44 : 32);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // a half-typed name saves nothing, however the box is left
    await en.fill('Half typ');
    await expect(saveEn, 'Save wakes when the text changes').toBeEnabled();
    await en.blur();
    await page.getByRole('heading', { level: 1, name: 'My profile' }).click();
    await page.waitForTimeout(1000);
    expect((await stored(member.id))!.en, 'a half-typed name is not saved by itself').toBe('Test Display');

    // typing it back to what is stored turns Save off again
    await en.fill('Test Display');
    await expect(saveEn).toBeDisabled();

    // Save writes it: Saved with Undo, the top bar shows it, the row holds it
    await en.fill('Other Display');
    await saveEn.click();
    await expect(toast(page, 'Profile saved')).toBeVisible();
    await expect(toast(page, 'Profile saved').getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect.poll(async () => (await stored(member.id))!.en).toBe('Other Display');
    await expect(saveEn, 'Save is off again once it is stored').toBeDisabled();
    if (width > 700) await expect(page.locator('[data-topbar] [data-profile-chip]')).toContainText('Other Display');

    // Undo puts the old name back in the box and in the row
    await toast(page, 'Profile saved').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(async () => (await stored(member.id))!.en).toBe('Test Display');
    await expect(en).toHaveValue('Test Display');

    // the Arabic box works the same way and writes its own column
    await ar.fill('اسم آخر');
    await ar.blur();
    await page.waitForTimeout(800);
    expect((await stored(member.id))!.ar, 'the Arabic box does not save by itself either').toBe('اسم تجريبي');
    await saveAr.click();
    await expect.poll(async () => (await stored(member.id))!.ar).toBe('اسم آخر');
    expect((await stored(member.id))!.en, 'the English column is untouched').toBe('Test Display');
  });
}

test('Enter in a name box saves it, like pressing Save', async ({ page }) => {
  const member = await makePerson();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  await page.getByLabel('Display name', { exact: true }).fill('Entered Name');
  await page.getByLabel('Display name', { exact: true }).press('Enter');
  await expect.poll(async () => (await stored(member.id))?.en).toBe('Entered Name');
});

for (const width of [375, 1440]) {
  test(`theme and density save at once, show where they act, and Undo — at ${width} px`, async ({ page }) => {
    const member = await makePerson();
    // a first-ever profile row cannot be undone away yet (builder A's), so the Undos start from a row that exists
    await sql(`insert into core.person_profile (person_id, created_by) values ($1, $1)`, [member.id]);
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, member.email, '/profile');
    await hydrated(page);

    // the density line: what each choice does, under the box
    const hint = page.locator('[data-density-hint]');
    await expect(hint, 'the density line').toHaveText(
      'Comfortable gives more room; Compact fits more rows on the screen.',
    );
    const hintBox = await hint.boundingBox();
    const selectBox = await page.getByLabel('Density').boundingBox();
    expect(hintBox!.y, 'the line sits under the box').toBeGreaterThan(selectBox!.y + selectBox!.height - 1);
    expect(hintBox!.x + hintBox!.width, 'the line fits the screen').toBeLessThanOrEqual(width);

    // Theme: one pick saves, the page changes, Saved with Undo, the row holds it
    await page.getByLabel('Theme', { exact: true }).click();
    await page.getByRole('option', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      toast(page, 'Profile saved').getByRole('button', { name: 'Undo' }),
      'one pick of the theme saves at once',
    ).toBeVisible();
    await expect.poll(async () => (await stored(member.id))?.theme).toBe('dark');
    await toast(page, 'Profile saved').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('html'), 'Undo puts the old theme back on the page').not.toHaveAttribute(
      'data-theme',
      'dark',
    );

    // Density: the same, and the page's rows follow
    await page.getByLabel('Density').click();
    await page.getByRole('option', { name: 'Compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expect(toast(page, 'Profile saved').getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect.poll(async () => (await stored(member.id))?.density).toBe('compact');
    await toast(page, 'Profile saved').getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-density', 'compact');
  });
}
