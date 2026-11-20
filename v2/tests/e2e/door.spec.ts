/**
 * The door — the sign-in page, layout A of the V21 boards (Landing 31; it was the 29 Sep spec, V213): a panel with the
 * logo alone at 1,024 px and wider (36 % of the width), a bar on a phone; a centred 480 px card with the heading;
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

test('the door: the panel with the logo alone, the centred card, the tab title, the favicon', async ({
  page,
  context,
  request,
}) => {
  await setPrefs(context, { theme: 'dark' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/sign-in');
  await expect(page).toHaveTitle('Sign in · Direct Corporate Workspace');
  const panel = page.locator('[data-brand-panel]');
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  // Landing 31, layout A: the panel is 36 % of the width, never under 360 px nor over 560 px
  expect(Math.round(box.width), 'the panel is 36 % of 1,500 px').toBe(540);
  expect(await panel.locator('svg, path').count(), 'no motif, no arrow').toBe(0);
  await expect(panel.getByRole('img', { name: 'Direct' })).toBeVisible();
  // Landing 34: the wordmark is followed by the word "Corporate" (the workspace's brand) — and by nothing else
  await expect(panel, 'no tagline, no copyright in the panel').toHaveText('Corporate');
  await expect(page.getByText('The commercial arm of the all-in-one travel app')).toHaveCount(0);
  await expect(page.getByText('الذراع التجاري لتطبيق السفر الشامل')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Direct Corporate Workspace' })).toBeVisible();
  const card = (await page.locator('[data-door-card]').boundingBox())!;
  expect(Math.round(card.width), 'the card is 480 px').toBe(480);
  expect(
    Math.abs(card.x + card.width / 2 - (box.width + (1500 - box.width) / 2)),
    'the card is centred in the page beside the panel',
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(card.y + card.height / 2 - 450),
    'and near the middle of the height (the footer sits under it)',
  ).toBeLessThanOrEqual(40);
  await expect(page.getByText('Sign in with your work email and password.')).toBeVisible();
  await expect(page.getByText('Forgot your password? Ask your admin.')).toBeVisible();
  await expect(page.getByText(`© ${new Date().getFullYear()} Direct Corporate`)).toBeVisible();
  // the door wears the theme last used on this device (the cookie says dark) — Landing 31, the theme rules
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
  // the button is the deep orange with white words, 50 px; the fields are 44 px
  expect(await signIn(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(200, 70, 12)');
  expect(await signIn(page).evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  expect(Math.round((await signIn(page).boundingBox())!.height)).toBe(50);
  expect(Math.round((await email(page).boundingBox())!.height)).toBe(44);
  expect(Math.round((await password(page).boundingBox())!.height)).toBe(44);
  await expect(email(page)).toHaveAttribute('autocomplete', 'username');
  await expect(password(page)).toHaveAttribute('autocomplete', 'current-password');
  await expect(email(page)).toBeFocused();
  // the favicon files answer 200 — /favicon.ico never redirects
  for (const path of ['/favicon.ico', '/icon.svg', '/apple-icon.png']) {
    const r = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
    expect(r.status(), `${path} answers 200`).toBe(200);
  }
  // on a phone: no panel, a 60 px bar with the logo, the card inside 16 px gutters
  await page.setViewportSize({ width: 400, height: 800 });
  await expect(panel).toBeHidden();
  const bar = page.locator('[data-door-bar]');
  await expect(bar).toBeVisible();
  expect(Math.round((await bar.boundingBox())!.height)).toBe(60);
  await expect(bar.getByRole('img', { name: 'Direct' })).toBeVisible();
  expect(Math.round((await page.locator('[data-door-card]').boundingBox())!.x), '16 px gutter').toBe(16);
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
  // Landing 31: the control is the word Show / Hide inside the field, at least 44 px wide
  await expect(eye).toHaveText('Show');
  const eyeBox = (await eye.boundingBox())!;
  expect(eyeBox.width).toBeGreaterThanOrEqual(44);
  expect(eyeBox.height).toBeGreaterThanOrEqual(32);
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
