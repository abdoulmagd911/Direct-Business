/**
 * Three themes (V636, the owner's ruling of 14 Oct): My profile offers Light, Dark and Direct; Colorful is gone, and a
 * person whose saved theme is colorful reads Light. The profile colour (the swatches, the ring around the initials) is
 * gone from My profile and the avatar. At 375 and 1,440 px. Sabotages: tests/sabotage/three-themes.mjs. Every value is
 * made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

for (const width of [375, 1440]) {
  test(`My profile offers Light, Dark and Direct and no colour to pick — at ${width} px`, async ({ page }) => {
    const member = await makePerson();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, member.email, '/profile');
    await hydrated(page);

    await expect(page.locator('[data-colour]'), 'no colour swatches on My profile').toHaveCount(0);
    await expect(page.getByLabel('Colour', { exact: true }), 'and no Colour control').toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);

    await page.getByLabel('Theme', { exact: true }).click();
    await expect(page.getByRole('option'), 'three themes, no Colorful').toHaveText(['Light', 'Dark', 'Direct']);
    await page.getByRole('option', { name: 'Direct' }).click();
    await expect.poll(() => theme(page)).toBe('direct');
    await expect
      .poll(async () => {
        const [row] = await sql<{ theme: string | null }>(
          `select theme from core.person_profile where person_id = $1`,
          [member.id],
        );
        return row?.theme;
      }, 'the profile holds the choice')
      .toBe('direct');
  });
}

test('a person whose saved theme is colorful reads Light, in every tab', async ({ page, context }) => {
  const member = await makePerson();
  await sql(`insert into core.person_profile (person_id, created_by, theme) values ($1, $1, 'colorful')`, [member.id]);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  expect(await theme(page), 'colorful reads as Light').toBe('light');
  const tab2 = await context.newPage();
  await tab2.goto('/profile');
  await hydrated(tab2);
  expect(await theme(tab2), 'the other tab too').toBe('light');
  await expect(tab2.getByLabel('Theme', { exact: true }), 'and the Theme box says Light').toHaveText('Light');
  expect(
    (await sql<{ theme: string | null }>(`select theme from core.person_profile where person_id = $1`, [member.id]))[0]
      ?.theme,
    'nothing was rewritten in the data',
  ).toBe('colorful');
});
