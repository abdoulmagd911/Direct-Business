/**
 * The styled sign-in page (canvas 1 and 1b, V59, V74, V75, V204) on the real door (P3-2): one step at a time; an
 * unlisted address is told in words; the emailed code verifies and lands on the asked-for page; no second door and
 * no "keep me signed in" tick. Sabotage: tests/sabotage/screens.mjs "sign-in-grows-a-google-door".
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { THEMES, fitToPage, open, setPrefs, shot } from './helpers';
import { codeFor, makePerson, sendCode, unlistedEmail } from './support/stack';

// The emailed-code door stays in the code behind SIGN_IN_METHOD=code (owner, 29 Sep 13:50: the door is email + password);
// its promises run when that door is on. password.spec.ts holds the same promises for the password door.
test.skip(process.env.SIGN_IN_METHOD !== 'code', 'the code door is off');

test('email step → code step → signed in on the deep link', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/sign-in?next=%2Ftasks');
  await expect(page.getByRole('heading', { name: 'Commercial Workspace' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Google|Zoom/ }),
    'the only door is the emailed code (V59)',
  ).toHaveCount(0);
  await expect(page.locator('[data-step="code"]')).toHaveCount(0);

  await sendCode(page, unlistedEmail());
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This email is not on the list — ask an admin');
  await expect(page.locator('[data-step="code"]')).toHaveCount(0);

  const person = await makePerson();
  const since = await sendCode(page, person.email);
  await expect(page.locator('[data-step="code"]')).toBeVisible();
  await expect(page.locator('[data-step="email"]')).toHaveCount(0);
  await expect(page.getByLabel('Digit 1 of 6')).toBeFocused();
  await expect(
    page.getByLabel('Keep me signed in on this device'),
    'devices stay signed in (V74) — no tick',
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Resend code \(\d:\d\d\)$/ })).toBeDisabled();

  await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
  for (let i = 1; i <= 6; i++) await page.getByLabel(`Digit ${i} of 6`).fill('1');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'That code is not right — check it or send a new one',
  );

  await page.getByLabel('Digit 1 of 6').fill(await codeFor(person.email, since));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId('address')).toHaveText('/tasks');
});

test('axe · sign-in', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await open(page, '/sign-in');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual(
    [],
  );
});

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · sign-in · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      await open(page, '/sign-in');
      await expect(page.getByLabel('Work email')).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`sign-in-${theme}-${width}`) });
    });
  }
}
