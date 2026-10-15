/**
 * QA-567 (the Architect's order of 14 Oct, after #259): the database keeps a display name that is the person's own
 * e-mail empty (PROF-02). The box must say so at once: after the save it shows what was kept — empty — not the
 * e-mail typed, with no reload. A real name next to it is kept and shown as typed. The page's own refresh after a
 * save is held back here, so only the save's answer can put the stored value in the box. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "profile-name-box-shows-the-email-it-did-not-keep".
 */
import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

for (const size of [
  { name: 'desk 1440', width: 1440, height: 900 },
  { name: 'phone 375', width: 375, height: 812 },
]) {
  test(`${size.name}: typing my own e-mail as a name leaves the box empty, as stored`, async ({ page }) => {
    const me = await makePerson();
    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page, me.email, '/profile');
    await hydrated(page);
    // hold back every background refresh of the page (the router's RSC requests) until the checks are done
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/*', async (route) => {
      if (route.request().headers()['rsc'] === '1') await held;
      await route.fallback();
    });

    const ar = page.getByLabel('Display name (Arabic)', { exact: true });
    await ar.fill(` ${me.email.toUpperCase()} `);
    await ar.press('Enter');
    await expect(page.getByText('Profile saved').first()).toBeVisible();
    await expect(ar, 'the box shows what was kept: nothing').toHaveValue('');
    // once more, leaving the box with Tab as a person does: the stored name is already empty, so nothing changes
    await ar.fill(me.email);
    await ar.press('Tab');
    await expect(page.getByText('Profile saved').first()).toBeVisible();
    await expect(ar, 'a second try is not kept either').toHaveValue('');

    const en = page.getByLabel('Display name', { exact: true });
    await en.fill('Made Up Name');
    await en.press('Enter');
    await expect(en, 'a real name is kept as typed').toHaveValue('Made Up Name');
    await expect(ar, 'and the Arabic box stays empty').toHaveValue('');

    // the database holds the same (the English save may still be on its way when the box shows it)
    await expect
      .poll(async () => {
        const [row] = await sql<{ en: string | null; ar: string | null }>(
          `select display_name_en as en, display_name_ar as ar from core.person_profile where person_id = $1`,
          [me.id],
        );
        return row;
      })
      .toEqual({ en: 'Made Up Name', ar: null });
    release();
  });
}
