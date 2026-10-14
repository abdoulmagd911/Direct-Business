/**
 * One theme everywhere (oversight's live walk, 14 Oct): a signed-in person's theme has ONE source — their saved profile,
 * then the admin's default — so every tab and every browser shows the same, right from the first byte the server sends.
 * A cookie in this browser is only a cache and never a rival choice. Before: opening My profile wrote the profile's theme
 * into this browser as its "own choice", which then outranked the profile for ever (light here, dark there).
 * Sabotages: tests/sabotage/one-theme.mjs. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function themed(value: string) {
  const member = await makePerson();
  await sql(`insert into core.person_profile (person_id, created_by, theme) values ($1, $1, $2)`, [member.id, value]);
  return member;
}

test('a second browser holding an older value of its own still gets the profile theme, in the first bytes the server sends', async ({
  page,
  browser,
  baseURL,
}) => {
  const member = await themed('dark');
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  expect(await theme(page)).toBe('dark');

  // another browser of the same person that once held its own, different value
  const other = await browser.newContext({ baseURL });
  const page2 = await other.newPage();
  await signIn(page2, member.email, '/my-day');
  // (the page above marked its cookie a cache; clearing that mark makes the value a choice of this browser, as it once was)
  await other.addCookies([
    { name: 'v2.synced', value: '', url: baseURL! },
    { name: 'v2.theme', value: 'light', url: baseURL! },
  ]);
  const res = await page2.goto('/my-day');
  expect(await res!.text(), 'the server renders the profile theme, whatever this browser holds').toMatch(
    /<html[^>]*data-theme="dark"/,
  );
  await hydrated(page2);
  expect(await theme(page2), 'and it stays so once the page is alive').toBe('dark');
  await other.close();
});

test('opening My profile does not turn the theme into a choice of this browser: a change made elsewhere arrives in every tab', async ({
  page,
  context,
}) => {
  const member = await themed('dark');
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  expect(await theme(page)).toBe('dark');
  const tab2 = await context.newPage();
  await tab2.goto('/my-day');
  await hydrated(tab2);
  expect(await theme(tab2), 'two tabs, the same theme').toBe('dark');

  // changed on another device, or by the admin
  await sql(`update core.person_profile set theme = 'light' where person_id = $1`, [member.id]);
  await page.reload();
  await hydrated(page);
  await tab2.reload();
  await hydrated(tab2);
  expect(await theme(page), 'the profile page follows the profile').toBe('light');
  expect(await theme(tab2), 'so does the other tab').toBe('light');
});

test('with no profile theme the admin default stands, the same in two tabs', async ({ page, context }) => {
  const member = await makePerson();
  await signIn(page, member.email, '/profile');
  await hydrated(page);
  const first = await theme(page);
  const tab2 = await context.newPage();
  await tab2.goto('/my-day');
  await hydrated(tab2);
  expect(await theme(tab2)).toBe(first);
  expect(first, 'the registry default is the Direct theme').toBe('direct');
});
