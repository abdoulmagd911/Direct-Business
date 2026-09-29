/**
 * The door — the sign-in page to the visual spec of 29 Sep (V213): a flat 400 px slate panel with the logo alone at
 * 1,024 px and wider, a slate bar on a phone; the heading in a 400 px column at the inline start, at max(96 px, 22 vh);
 * the four refusals in words (wrong pair, not on the team list, locked, the server not reached — never as a
 * credentials error); show/hide password; Caps Lock said; an empty field refused in place with the focus on it; the
 * tab title; the favicon answers 200. Sabotages: tests/sabotage/screens.mjs "door-offline-reads-as-wrong-password",
 * "door-eye-shows-nothing", "door-panel-grows-a-tagline".
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, setPrefs } from './helpers';
import { TEST_PASSWORD, makePerson, unlistedEmail } from './support/stack';

test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const WRONG_PAIR = "That email and password don't match. Try again or ask your admin to reset it.";
const NOT_LISTED = "This email isn't on the team list. Ask your admin to add you.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";
const alert = (page: Page) => page.getByRole('main').getByRole('alert');
const email = (page: Page) => page.getByLabel('Work email');
const password = (page: Page) => page.getByLabel('Password', { exact: true });
const signIn = (page: Page) => page.getByRole('button', { name: /^Sign(ing)? in/ });

test('the door: slate panel with the logo alone, the column at the inline start, the tab title, the favicon', async ({
  page,
  context,
  request,
}) => {
  await setPrefs(context, { theme: 'dark' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/sign-in');
  await expect(page).toHaveTitle('Sign in · Commercial Workspace');
  const panel = page.locator('[data-brand-panel]');
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(Math.round(box.width), 'the panel is 400 px').toBe(400);
  expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor), 'flat slate').toBe('rgb(50, 62, 72)');
  expect(await panel.locator('svg, path').count(), 'no motif, no arrow').toBe(0);
  await expect(panel.getByRole('img', { name: 'Direct' })).toBeVisible();
  await expect(panel, 'no tagline, no copyright in the panel').toHaveText('');
  await expect(page.getByText('The commercial arm of the all-in-one travel app')).toHaveCount(0);
  await expect(page.getByText('الذراع التجاري لتطبيق السفر الشامل')).toHaveCount(0);
  const h1 = page.getByRole('heading', { level: 1, name: 'Commercial Workspace' });
  const hb = (await h1.boundingBox())!;
  expect(hb.y, 'the heading starts at max(96 px, 22 vh) — not centred').toBeGreaterThanOrEqual(
    Math.max(96, 0.22 * 900) - 1,
  );
  expect(hb.y).toBeLessThan(0.22 * 900 + 24);
  expect(Math.round(hb.x), 'the column is at the inline start, after the panel and the 48 px gutter').toBe(448);
  await expect(page.getByText('Sign in with your work email and password.')).toBeVisible();
  await expect(page.getByText('Forgot your password? Ask your admin.')).toBeVisible();
  await expect(page.getByText(`© ${new Date().getFullYear()} Direct`)).toBeVisible();
  // the door is light whatever the theme (the cookie says dark)
  expect(await page.locator('[data-sign-in]').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(245, 246, 248)',
  );
  expect(await page.locator('[data-sign-in]').evaluate((el) => getComputedStyle(el).colorScheme)).toBe('light');
  // the button is slate, never orange; the fields are 48 px
  expect(await signIn(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(50, 62, 72)');
  expect(Math.round((await email(page).boundingBox())!.height)).toBe(48);
  expect(Math.round((await password(page).boundingBox())!.height)).toBe(48);
  await expect(email(page)).toHaveAttribute('autocomplete', 'username');
  await expect(password(page)).toHaveAttribute('autocomplete', 'current-password');
  await expect(email(page)).toBeFocused();
  // the favicon files answer 200 — /favicon.ico never redirects
  for (const path of ['/favicon.ico', '/icon.svg', '/apple-icon.png']) {
    const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
    expect(r.status(), `${path} answers 200`).toBe(200);
  }
  // on a phone: no panel, a 56 px slate bar with the logo, 16 px gutters
  await page.setViewportSize({ width: 400, height: 800 });
  await expect(panel).toBeHidden();
  const bar = page.locator('[data-door-bar]');
  await expect(bar).toBeVisible();
  expect(Math.round((await bar.boundingBox())!.height)).toBe(56);
  await expect(bar.getByRole('img', { name: 'Direct' })).toBeVisible();
  expect(Math.round((await email(page).boundingBox())!.x), '16 px gutter').toBe(16);
});

test('the four refusals are said in words; the server not reached is never a credentials error', async ({ page }) => {
  await page.goto('/sign-in');
  // an empty form: each field refused in place, the first one focused
  await signIn(page).click();
  await expect(page.getByText('Enter your work email.')).toBeVisible();
  await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(email(page)).toBeFocused();
  await email(page).fill(unlistedEmail());
  await signIn(page).click();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await expect(password(page)).toBeFocused();
  // not on the team list
  await password(page).fill(TEST_PASSWORD);
  await signIn(page).click();
  await expect(alert(page)).toHaveText(NOT_LISTED);
  // wrong pair
  const person = await makePerson();
  await email(page).fill(person.email);
  await password(page).fill('not-the-password');
  await signIn(page).click();
  await expect(alert(page)).toHaveText(WRONG_PAIR);
  // the server not reached: the sign-in request is cut — said as that, never as a wrong password
  await page.route('**/sign-in*', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()));
  await password(page).fill(TEST_PASSWORD);
  await signIn(page).click();
  await expect(alert(page), 'offline is said as offline').toHaveText(OFFLINE);
  await page.unroute('**/sign-in*');
  // and then the right pair opens the app
  await signIn(page).click();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });
});

test('show/hide password, Caps Lock, and "Signing in…" with the fields read-only', async ({ page }) => {
  await page.goto('/sign-in');
  const eye = page.locator('[data-password-eye]');
  await expect(eye).toHaveAttribute('aria-label', 'Show password');
  await expect(eye).toHaveAttribute('aria-pressed', 'false');
  const eyeBox = (await eye.boundingBox())!;
  expect(Math.round(eyeBox.width)).toBe(40);
  expect(Math.round(eyeBox.height)).toBe(40);
  await password(page).fill('Visible-1234');
  await expect(password(page)).toHaveAttribute('type', 'password');
  await eye.click();
  await expect(password(page), 'the eye shows the password').toHaveAttribute('type', 'text');
  await expect(eye).toHaveAttribute('aria-label', 'Hide password');
  await expect(eye).toHaveAttribute('aria-pressed', 'true');
  await eye.click();
  await expect(password(page)).toHaveAttribute('type', 'password');
  // Caps Lock: the key state is read from the keyboard event
  await password(page).focus();
  await password(page).dispatchEvent('keydown', { key: 'a', modifierCapsLock: true });
  await expect(page.locator('[data-caps-lock]')).toHaveText('Caps Lock is on');
  await password(page).dispatchEvent('keyup', { key: 'a', modifierCapsLock: false });
  await expect(page.locator('[data-caps-lock]')).toHaveCount(0);
  // while the server answers: "Signing in…", the fields read-only
  const person = await makePerson();
  await email(page).fill(person.email);
  await password(page).fill(TEST_PASSWORD);
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/sign-in*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await held;
    return route.continue();
  });
  await signIn(page).click();
  await expect(page.getByRole('button', { name: 'Signing in…' })).toBeVisible();
  await expect(email(page)).toHaveAttribute('readonly', '');
  await expect(password(page)).toHaveAttribute('readonly', '');
  release();
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 15_000 });
});
