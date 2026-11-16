/**
 * Landing 31 · the look bar in English: the six key screens × the five themes, at 1,440 px and at 375 px — the page
 * wears the theme, nothing scrolls sideways and no word is under 12 px. The Arabic walk is
 * landing-31-look-arabic.alone.spec.ts (Arabic is a switch of the whole app, so it runs alone).
 * Sabotages: tests/sabotage/landing-31-themes.mjs. Every value is made up.
 */
import { test } from '@playwright/test';
import { walkLook } from './support/look';
import { makePerson, signIn } from './support/stack';

for (const width of [1440, 375]) {
  test(`the six key screens in the five themes — English, ${width} px`, async ({ page }) => {
    test.setTimeout(300_000);
    const admin = await makePerson({ admin: true });
    await signIn(page, admin.email, '/my-day');
    await walkLook(page, admin.id, width, 'ltr');
  });
}
