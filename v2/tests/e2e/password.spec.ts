/**
 * The password door (owner, 29 Sep 13:50): sign-in is work email + password, no e-mail is sent. An unlisted address is
 * refused in words and logged; a wrong password is refused in words; there is no second door and no "keep me signed
 * in"; the deep link is kept. An admin generates a temporary password for a person with a reason (V441: shown once,
 * with Copy, never typed); that person's next sign-in asks them to choose their own (at least ten characters) before
 * anything else; My profile changes the password. Sabotages: e2e-codes-for-anyone, password-too-short-accepted,
 * must-change-not-enforced, sign-in-grows-a-google-door.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { THEMES, fitToPage, setPrefs, shot } from './helpers';
import { TEST_PASSWORD, logOf, makePerson, signIn, signOut, unlistedEmail } from './support/stack';

test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();
const refusal = (page: Page) => page.getByRole('main').getByRole('alert');

async function tryPassword(page: Page, email: string, password: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('email and password sign in on the deep link; an unlisted email and a wrong password are refused in words', async ({
  page,
}) => {
  await page.goto('/sign-in?next=%2Ftasks');
  await expect(page.getByRole('heading', { name: 'Commercial Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Google|Zoom/ }), 'the only door is email and password').toHaveCount(0);
  await expect(
    page.getByLabel('Keep me signed in on this device'),
    'devices stay signed in (V74) — no tick',
  ).toHaveCount(0);
  await expect(page.locator('[data-step="code"]'), 'no code step').toHaveCount(0);
  await expect(page.getByText('Forgot your password? Ask your admin.')).toBeVisible();

  const stranger = unlistedEmail();
  await tryPassword(page, stranger, TEST_PASSWORD);
  await expect(refusal(page)).toHaveText('This email is not on the list — ask an admin');
  expect(await logOf(stranger)).toEqual(['not_listed']);

  const person = await makePerson();
  await tryPassword(page, person.email, 'not-the-password');
  await expect(refusal(page)).toHaveText('Wrong email or password');
  await expect(page).toHaveURL(/\/sign-in/);

  await tryPassword(page, person.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/tasks$/, { timeout: 15_000 });
  expect((await logOf(person.email)).at(-1)).toBe('ok');
});

test('an admin generates a temporary password with a reason; the person signs in with it and must choose their own', async ({
  page,
  browser,
}) => {
  test.slow();
  const admin = await makePerson({ admin: true });
  const person = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, `/people/${person.id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('Made-up reason: forgot it');
  await dialog.locator('[data-reason-save]').click();
  await expect(toast(page, 'Temporary password generated')).toBeVisible();
  const temporary = (await page.locator('[data-temporary-password]').textContent())?.trim() ?? '';
  expect(temporary.length, 'a temporary password of at least fourteen characters (V441)').toBeGreaterThanOrEqual(14);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('[data-password-copy]').click();
  await expect(page.locator('[data-password-copy]')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText()), 'Copy puts it on the clipboard').toBe(temporary);

  // the old password no longer works; the temporary one does, and lands on "set your own password"
  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fmy-day');
  await tryPassword(their, person.email, TEST_PASSWORD);
  await expect(refusal(their)).toHaveText('Wrong email or password');
  await tryPassword(their, person.email, temporary);
  await expect(their).toHaveURL(/\/set-password\?next=%2Fmy-day/, { timeout: 15_000 });
  // any other address inside the app comes back here until the password is set
  await their.goto('/tasks');
  await expect(their).toHaveURL(/\/set-password/);
  await expect(their.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(their.getByText('At least 10 characters.')).toBeVisible();
  const own = `Own-${Date.now().toString(36)}-pass`;
  await their.getByLabel('New password', { exact: true }).fill('short');
  await their.getByLabel('New password again').fill('short');
  await expect(their.locator('[data-set-password-save]')).toBeDisabled();
  // the rule holds on the server too, not only in the form
  await their.locator('[data-set-password-save]').evaluate((b) => b.removeAttribute('disabled'));
  await their.locator('[data-set-password-save]').click();
  await expect(their.getByRole('main').getByRole('alert'), 'the server refuses a short password').toHaveText(
    'At least 10 characters',
  );
  await their.getByLabel('New password', { exact: true }).fill(own);
  await their.getByLabel('New password again').fill(`${own}x`);
  await their.locator('[data-set-password-save]').click();
  await expect(their.getByRole('main').getByRole('alert')).toHaveText('The two passwords are not the same');
  await their.getByLabel('New password again').fill(own);
  await their.locator('[data-set-password-save]').click();
  await expect(their).toHaveURL(/\/tasks$/, { timeout: 15_000 });
  await hydrated(their);
  // the new password is the door from now on
  await signOut(their);
  await their.goto('/sign-in');
  await tryPassword(their, person.email, own);
  await expect(their).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });
  await ctx.close();
});

test('a generated password opens "Choose a new password"; My profile changes it afterwards', async ({
  page,
  browser,
}) => {
  test.slow();
  const admin = await makePerson({ admin: true });
  const person = await makePerson();
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, `/people/${person.id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Made-up reason: onboarding');
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, 'Temporary password generated')).toBeVisible();
  const temporary = (await page.locator('[data-temporary-password]').textContent())?.trim() ?? '';

  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.setViewportSize({ width: 1500, height: 1000 });
  await their.goto('/sign-in');
  await tryPassword(their, person.email, temporary);
  await expect(their).toHaveURL(/\/set-password/, { timeout: 15_000 });
  const own = `Mine-${Date.now().toString(36)}-pass`;
  await their.getByLabel('New password', { exact: true }).fill(own);
  await their.getByLabel('New password again').fill(own);
  await their.locator('[data-set-password-save]').click();
  await expect(their).not.toHaveURL(/set-password|sign-in/, { timeout: 15_000 });
  // My profile → Change password
  await their.goto('/profile');
  await hydrated(their);
  const changed = `Changed-${Date.now().toString(36)}-pass`;
  await their.locator('[data-password-new]').fill(changed);
  await their.locator('[data-password-again]').fill(changed);
  await expect(their.locator('[data-password-save]'), 'the current password is asked for').toBeDisabled();
  await their.locator('[data-password-current]').fill(`${own}-not`);
  await their.locator('[data-password-save]').click();
  await expect(their.getByRole('main').getByRole('alert'), 'the current password is checked').toHaveText(
    'The current password is wrong',
  );
  await their.locator('[data-password-current]').fill(own);
  await their.locator('[data-password-save]').click();
  await expect(toast(their, 'Password changed')).toBeVisible();
  await signOut(their);
  await their.goto('/sign-in');
  await tryPassword(their, person.email, own);
  await expect(refusal(their)).toHaveText('Wrong email or password');
  await tryPassword(their, person.email, changed);
  await expect(their).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });
  await ctx.close();
});

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · password door · ${theme} · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sign-in');
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`sign-in-password-${theme}-${width}`) });
    });
  }
}

test('axe · the password door and set your own password', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/sign-in');
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  const serious = (r: Awaited<ReturnType<AxeBuilder['analyze']>>) =>
    r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
  expect(serious(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())).toEqual([]);
  // set-password: reached by a person whose admin reset it
  const admin = await makePerson({ admin: true });
  const person = await makePerson();
  await signIn(page, admin.email, `/people/${person.id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Made-up reason');
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  const temporary = (await page.locator('[data-temporary-password]').textContent())?.trim() ?? '';
  await signOut(page);
  await page.goto('/sign-in');
  await tryPassword(page, person.email, temporary);
  await expect(page).toHaveURL(/\/set-password/, { timeout: 15_000 });
  await fitToPage(page, 1500);
  await page.screenshot({ path: shot('set-password-direct-1500') });
  expect(serious(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())).toEqual([]);
});
