/**
 * Landing 53 — My day as the boards of the design session draw it, through the screen, on a PC (1440 px) and on a
 * phone (390 px). Every value is made up.
 *  a. The banner's day in full; Today's three as three cards side by side on a PC and stacked on a phone, each group
 *     with its sub-line; a typed task's row says its kind. "The rest of today (N)" right under it, grouped by kind
 *     in the board's order, in two columns on a PC and one on a phone; on a phone every task row is at least 56 px
 *     tall and nothing scrolls sideways.
 *  b. Ticking a task of the three: it KEEPS ITS PLACE, ticked, the other rows do not move, the line counts it
 *     ("1 of 9 done today") — and it is still so after a reload.
 *  c. One switch turns the rest of today to the four boxes (Do now · Plan it · Quick or hand off · Later) and back, and
 *     the choice survives a reload.
 * Sabotage: tests/sabotage/landing-53-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { DESKTOP, sideways, staffAs, tag } from './support/landing-34';
import { PHONE_390, madeUpType, seedDay, shot, smallWords } from './support/landing-53';
import { signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const GROUPS = ['important', 'short', 'maintenance'] as const;
const rowsOf = (page: Page, g: string) =>
  page
    .locator(`[data-todays-three] [data-three-group="${g}"] [data-three-row]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-three-row') ?? ''));

test('a · the three cards, the kind tags and the rest of today by kind — on a PC and on a phone', async ({ page }) => {
  test.setTimeout(180_000);
  const me = await staffAs('member');
  const word = tag();
  const key = `made_up_${word}`;
  await madeUpType(me.id, key, `Zed kind ${word}`, `نوع ${word}`);
  const day = await seedDay(me, word, key);
  await page.setViewportSize(DESKTOP);
  await signIn(page, me.email, '/my-day');
  await hydrated(page);

  // the banner: the day in full — "Friday, 13 November 2026"
  await expect(page.locator('[data-day-heading]'), 'the day is written in full').toHaveText(
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
  );

  const three = page.locator('[data-todays-three]');
  await expect(three.locator('h2')).toHaveText("Today's Three");
  await expect(three.locator('[data-three-sub]'), 'each group says what it is in plain words').toHaveText([
    'Highest priority',
    'Under 15 minutes',
    'Routine tasks',
  ]);
  for (const g of GROUPS) expect(await rowsOf(page, g), `${g}: its three`).toEqual(day[g]);
  await expect(three.locator('[data-streak-today]'), 'nothing ticked yet').toHaveText('0 of 9 done today');
  await expect(
    three.locator(`[data-three-row="${day.important[0]}"] [data-row-kind]`),
    "a typed task's row says its kind",
  ).toHaveText('Meeting');
  await expect(
    three.locator(`[data-three-row="${day.important[1]}"] [data-row-kind]`),
    'a task with no type has no tag',
  ).toHaveCount(0);
  // three cards side by side on a PC
  const cards = await three
    .locator('[data-three-group]')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(new Set(cards.map((c) => Math.round(c.top))).size, 'PC: the three cards share one row').toBe(1);
  expect(cards[0]!.left, 'PC: left to right').toBeLessThan(cards[1]!.left);

  // the rest of today, right under the three, by kind
  const rest = page.locator('[data-today-block]');
  await expect(rest.locator('h2')).toHaveText('The rest of today (6)');
  await expect(rest, 'it opens grouped by kind').toHaveAttribute('data-rest-view', 'kind');
  await expect(
    rest.locator('[data-rest-kind] h3'),
    "the board's kinds first, another type next, Other last",
  ).toHaveText(['Meetings 2', 'Follow-ups 1', `Zed kind ${word} 1`, 'Other 2']);
  expect(
    await rest
      .locator('[data-rest-kind="meeting"] [data-today-task]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-today-task'))),
    'inside a kind, the nearest due day first',
  ).toEqual(day.rest.meetings);
  expect((await three.boundingBox())!.y, 'the three sit above the rest').toBeLessThan((await rest.boundingBox())!.y);
  const kinds = await rest.locator('[data-rest-kind]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(new Set(kinds.map((k) => Math.round(k.left))).size, 'PC: the kinds sit in two columns').toBe(2);
  expect(await sideways(page), 'PC: nothing scrolls sideways').toBeLessThanOrEqual(0);
  expect(await smallWords(three), 'PC: no word under 12 px in the three').toBe(0);
  expect(await smallWords(rest), 'PC: no word under 12 px in the rest').toBe(0);
  await shot(page, 'en-1440');

  // a phone: the same content in one column
  await page.setViewportSize(PHONE_390);
  await page.reload();
  await hydrated(page);
  await expect(three).toBeVisible();
  const stacked = await three
    .locator('[data-three-group]')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(new Set(stacked.map((c) => Math.round(c.left))).size, 'phone: the three stack in one column').toBe(1);
  expect(stacked[0]!.bottom, 'phone: one under the other').toBeLessThanOrEqual(stacked[1]!.top + 1);
  const oneColumn = await rest
    .locator('[data-rest-kind]')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(new Set(oneColumn.map((k) => Math.round(k.left))).size, 'phone: the kinds are one column').toBe(1);
  const rows = await page
    .locator('[data-todays-three] [data-today-task], [data-today-block] [data-today-task]')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(rows.length, 'phone: every task row is there').toBe(15);
  expect(Math.min(...rows), 'phone: every task row is at least 56 px tall').toBeGreaterThanOrEqual(56);
  await expect(page.locator('[data-capture-open]'), 'phone: only Wrap up is on the banner').toBeHidden();
  await expect(page.locator('[data-wrap-open]')).toBeVisible();
  expect(await sideways(page), 'phone: nothing scrolls sideways').toBeLessThanOrEqual(0);
  expect(await smallWords(three), 'phone: no word under 12 px').toBe(0);
  await shot(page, 'en-390');
});

test('b · a task ticked done keeps its place in the three, ticked, and the line counts it — after a reload too', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const me = await staffAs('member');
  const word = tag();
  const key = `made_up_${word}`;
  await madeUpType(me.id, key, `Zed kind ${word}`, `نوع ${word}`);
  const day = await seedDay(me, word, key);
  await page.setViewportSize(DESKTOP);
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const three = page.locator('[data-todays-three]');
  const target = day.short[1]!;
  await three.locator(`[data-three-row="${target}"] [data-done-tick]`).click();
  await page.locator('[data-confirm-action]').click(); // the Mark done? box (V641)
  const row = three.locator(`[data-three-row="${target}"]`);
  await expect(row, 'the ticked task keeps its row').toHaveCount(1);
  await expect(row, 'and is drawn ticked').toHaveAttribute('data-row-done', '');
  await expect(row.locator('[data-done-tick]'), 'a done row has no done button').toHaveCount(0);
  for (const g of GROUPS) expect(await rowsOf(page, g), `${g}: nobody moved`).toEqual(day[g]);
  await expect(three.locator('[data-streak-today]'), 'the line counts it').toHaveText('1 of 9 done today');
  await expect(page.locator('[data-today-block] h2'), 'the rest of today is as it was').toHaveText(
    'The rest of today (6)',
  );
  await page.reload();
  await hydrated(page);
  await expect(three.locator(`[data-three-row="${target}"]`), 'after a reload: still there, ticked').toHaveAttribute(
    'data-row-done',
    '',
  );
  for (const g of GROUPS) expect(await rowsOf(page, g), `${g}: the same after a reload`).toEqual(day[g]);
  await expect(three.locator('[data-streak-today]')).toHaveText('1 of 9 done today');
  await shot(three, 'en-ticked');
});

test('c · one switch turns the rest of today to the four boxes and back; the choice survives a reload', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const me = await staffAs('member');
  const word = tag();
  const key = `made_up_${word}`;
  await madeUpType(me.id, key, `Zed kind ${word}`, `نوع ${word}`);
  await seedDay(me, word, key);
  await page.setViewportSize(DESKTOP);
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const rest = page.locator('[data-today-block]');
  await expect(rest.locator('[data-rest-view-option]')).toHaveText(['By kind', 'By priority']);
  await rest.locator('[data-rest-view-option="priority"]').click();
  await expect(rest).toHaveAttribute('data-rest-view', 'priority');
  await expect(
    rest.locator('[data-today-group] h3'),
    'the four boxes: here six unstarred tasks due within two days',
  ).toHaveText(['Quick or hand off 6']);
  await expect(rest.locator('[data-today-chip]'), 'with their chips').toHaveText([
    /^Reminders/,
    /^Do now/,
    /^Plan it/,
    /^Quick or hand off/,
    /^Later/,
    /^Helping/,
  ]);
  await expect(rest.locator('[data-rest-kind]')).toHaveCount(0);
  await expect(rest.locator('h2'), 'the heading keeps its count').toHaveText('The rest of today (6)');
  await shot(rest, 'en-priority');
  await page.reload();
  await hydrated(page);
  await expect(rest, 'the choice is kept in this browser').toHaveAttribute('data-rest-view', 'priority');
  await rest.locator('[data-rest-view-option="kind"]').click();
  await expect(rest.locator('[data-rest-kind]').first()).toBeVisible();
  await expect(rest.locator('[data-today-chip]')).toHaveCount(0);
});
