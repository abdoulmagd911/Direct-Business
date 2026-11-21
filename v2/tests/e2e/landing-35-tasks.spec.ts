/**
 * Landing 35 in the browser · Tasks (the owner's live sweep of 21 Nov), measured, not read from the code:
 *  a. `?layout=board` is a real board. At 1280 px the status columns stand SIDE BY SIDE — one top, x growing from the
 *     left (in Arabic from the right) — the page does not scroll sideways, a long column scrolls inside itself under a
 *     header that stays, a card says the task's number, title and star, and the board is still there after a refresh
 *     and after Back. On a phone (390 px) a column is nearly the screen wide, the next one stands beside it, and the
 *     row comes to rest on a column.
 *  b. The search filters as it is typed in — no Enter — and `?q=` follows; typing on never loses a letter or the
 *     focus; nothing is added to Back; emptying the box brings every task back; the board is searched the same way
 *     and stays the board; Enter still asks at once.
 * Every value is made up. Sabotage: tests/sabotage/landing-35-tasks.mjs.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { shot } from './helpers';
import { withArabicOn } from './support/arabic';
import { hydrated, seedTask, sideways, staffAs, tag, type Staff } from './support/landing-34';
import { signIn, sql } from './support/stack';

test.describe.configure({ timeout: 180_000 });

/** A browser of its own for one person, at one size (sharp enough for the pictures the report keeps). */
async function openAs(browser: Browser, person: Staff, size: { width: number; height: number }, from: string) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await signIn(page, person.email, from);
  await hydrated(page);
  return { context, page };
}

/** Where every board column stands on the screen, in the order the page holds them. */
const columnBoxes = (page: Page) =>
  page.locator('[data-task-board] [data-board-column]').evaluateAll((cols) =>
    cols.map((c) => {
      const r = c.getBoundingClientRect();
      return { key: c.getAttribute('data-board-column'), x: r.x, top: r.top, width: r.width, bottom: r.bottom };
    }),
  );

/** A board for one person: a long Not started column (one task starred), one In progress, one Done. */
async function seedBoard(owner: Staff, word: string) {
  const starred = await seedTask(owner, `Made-up ${word} starred`, { offset: 2, starred: true });
  for (let i = 0; i < 13; i++) await seedTask(owner, `Made-up ${word} waiting ${i}`, { offset: null });
  const moving = await seedTask(owner, `Made-up ${word} moving`, { offset: 1 });
  await sql(
    `update work.task set status_id = (select id from work.task_status
                                        where meaning = 'in_progress' and deleted_at is null limit 1)
      where number = $1`,
    [moving],
  );
  await seedTask(owner, `Made-up ${word} finished`, { offset: null, doneOn: '2020-01-05' });
  return { starred };
}

test('a. ?layout=board draws the status columns side by side, on a desktop and on a phone', async ({ browser }) => {
  const person = await staffAs('member');
  const word = tag();
  const { starred } = await seedBoard(person, word);
  const { context, page } = await openAs(
    browser,
    person,
    { width: 1280, height: 800 },
    '/tasks?view=owned&layout=board',
  );

  const board = page.locator('[data-task-board]');
  await expect(board, 'the address ?layout=board draws the board').toBeVisible();
  await expect(page.locator('[data-task-group]'), 'and not the list’s groups').toHaveCount(0);
  await expect(board.locator('[data-board-column="not_started"]')).toHaveAttribute('data-count', '14');

  // ---- side by side: one top, x growing
  const cols = await columnBoxes(page);
  expect(cols.length, 'a column per status').toBeGreaterThanOrEqual(3);
  const tops = new Set(cols.map((c) => Math.round(c.top)));
  expect([...tops], `the columns share one top (${JSON.stringify(cols.map((c) => [c.key, c.top]))})`).toHaveLength(1);
  for (let i = 1; i < cols.length; i++)
    expect(cols[i]!.x, `${cols[i]!.key} stands after ${cols[i - 1]!.key}, not under it`).toBeGreaterThanOrEqual(
      cols[i - 1]!.x + cols[i - 1]!.width,
    );
  expect(
    cols.filter((c) => c.x >= 0 && c.x + c.width <= 1280).length,
    'three or more are on screen',
  ).toBeGreaterThanOrEqual(3);
  expect(await sideways(page), 'the page does not scroll sideways at 1280').toBeLessThanOrEqual(0);

  // ---- a long column scrolls inside itself; its header stays; the column ends on the screen
  const long = board.locator('[data-board-column="not_started"]');
  const inner = await long.locator('[data-board-cards]').evaluate((ul) => {
    ul.scrollTop = 400;
    return { scrolled: ul.scrollTop, taller: ul.scrollHeight > ul.clientHeight };
  });
  expect(inner.taller, 'fourteen cards are taller than the column').toBe(true);
  expect(inner.scrolled, 'the cards scroll inside the column').toBeGreaterThan(0);
  await expect(long.locator('[data-board-column-head]'), 'the header stays while the cards scroll').toBeInViewport();
  await expect(long.locator('[data-board-column-head]')).toContainText('14');
  const col = (await columnBoxes(page)).find((c) => c.key === 'not_started')!;
  expect(col.bottom - col.top, 'the long column is no taller than the screen').toBeLessThanOrEqual(800);
  await long.locator('[data-board-cards]').evaluate((ul) => (ul.scrollTop = 0));

  // ---- a card says the task in short
  const card = board.locator(`[data-board-card="${starred}"]`);
  await expect(card.locator('[data-board-card-number]')).toHaveText(starred);
  await expect(card).toContainText(`Made-up ${word} starred`);
  await expect(card.locator('[data-star="mark"]'), 'the starred task wears its star').toBeVisible();
  await expect(card.locator('[data-task-due]')).toBeVisible();
  await expect(card.locator('[data-task-responsible]')).toBeVisible();
  await expect(board.locator('[data-star="mark"]'), 'and no other card does').toHaveCount(1);
  await page.screenshot({ path: shot('landing-35-board-1280-en') });

  // ---- the address keeps the board: refresh, the switch, Back
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-task-board]'), 'a refresh keeps the board').toBeVisible();
  await expect(page.locator('[data-layouts] [data-layout="board"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('[data-layouts] [data-layout="list"]').click();
  await expect(page.locator('[data-task-rows]')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/layout=board/);
  await expect(page.locator('[data-task-board]'), 'Back returns to the board').toBeVisible();
  for (const view of ['my_work', 'team', 'helping']) {
    await page.goto(`/tasks?view=${view}&layout=board`);
    await hydrated(page);
    await expect(page.locator('[data-tasks-list]'), `${view} opens the board`).toHaveAttribute(
      'data-layout-open',
      'board',
    );
    await expect(page.locator('[data-layouts] [data-layout="board"]'), view).toHaveAttribute('aria-current', 'page');
  }
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/tasks?view=owned&layout=board');
    await hydrated(page);
    await expect(page.locator('[data-task-board]')).toBeVisible();
    const at = await columnBoxes(page);
    expect(new Set(at.map((c) => Math.round(c.top))).size, `one row of columns at ${width}`).toBe(1);
    expect(await sideways(page), `the page does not scroll sideways at ${width}`).toBeLessThanOrEqual(0);
  }
  await context.close();

  // ---- a phone: one column at a time, the next beside it
  const phone = await openAs(browser, person, { width: 390, height: 844 }, '/tasks?view=owned&layout=board');
  await expect(phone.page.locator('[data-task-board]')).toBeVisible();
  const small = await columnBoxes(phone.page);
  expect(new Set(small.map((c) => Math.round(c.top))).size, 'on a phone the columns are still one row').toBe(1);
  expect(small[0]!.width, 'a column is nearly the screen wide').toBeGreaterThan(390 * 0.7);
  expect(small[1]!.x, 'the next column stands beside the first').toBeGreaterThanOrEqual(small[0]!.x + small[0]!.width);
  expect(small[1]!.x, 'and shows its edge').toBeLessThan(390);
  expect(await sideways(phone.page), 'the page does not scroll sideways at 390').toBeLessThanOrEqual(0);
  // a swipe that stops between two columns comes to rest on one
  const rests = await phone.page.locator('[data-task-board]').evaluate(async (el) => {
    el.scrollTo({ left: 230 });
    await new Promise((r) => setTimeout(r, 900));
    const frame = el.getBoundingClientRect();
    const edge = [...el.querySelectorAll('[data-board-column]')].map((c) =>
      Math.abs(c.getBoundingClientRect().left - frame.left),
    );
    return { left: el.scrollLeft, nearest: Math.min(...edge) };
  });
  expect(rests.left, 'the row moved to the next column').toBeGreaterThan(230);
  expect(rests.nearest, 'and rests with a column at its edge').toBeLessThanOrEqual(2);
  await phone.page.locator('[data-task-board]').evaluate((el) => el.scrollTo({ left: 0 }));
  await phone.page.waitForTimeout(400);
  await phone.page.screenshot({ path: shot('landing-35-board-390') });
  for (const width of [360, 430]) {
    await phone.page.setViewportSize({ width, height: 844 });
    expect(await sideways(phone.page), `the page does not scroll sideways at ${width}`).toBeLessThanOrEqual(0);
  }
  await phone.context.close();
});

test('a. in Arabic the columns run from the right', async ({ browser }) => {
  const person = await staffAs('member', { locale: 'ar' });
  await seedBoard(person, tag());
  await withArabicOn(person.id, 'Made-up reason: the Landing 35 board in Arabic', async () => {
    const { context, page } = await openAs(
      browser,
      person,
      { width: 1280, height: 800 },
      '/tasks?view=owned&layout=board',
    );
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-task-board]')).toBeVisible();
    const cols = await columnBoxes(page);
    expect(cols.map((c) => c.key).slice(0, 2), 'the same order in the page').toEqual(['not_started', 'in_progress']);
    expect(new Set(cols.map((c) => Math.round(c.top))).size, 'the columns share one top').toBe(1);
    for (let i = 1; i < cols.length; i++)
      expect(
        cols[i]!.x + cols[i]!.width,
        `${cols[i]!.key} stands to the LEFT of ${cols[i - 1]!.key}`,
      ).toBeLessThanOrEqual(cols[i - 1]!.x);
    expect(cols[0]!.x + cols[0]!.width, 'the first column starts at the right').toBeGreaterThan(1280 / 2);
    expect(Math.abs(await sideways(page)), 'the page does not scroll sideways in Arabic').toBeLessThanOrEqual(0);
    await page.screenshot({ path: shot('landing-35-board-1280-ar') });
    await context.close();
  });
});

test('b. the search filters as it is typed in, and ?q= follows', async ({ browser }) => {
  const person = await staffAs('member');
  const word = tag();
  const zebra = await seedTask(person, `Made-up zebra ${word}`, { offset: null });
  const falcon = await seedTask(person, `Made-up falcon ${word}`, { offset: null });
  const { context, page } = await openAs(browser, person, { width: 1280, height: 800 }, '/tasks?view=owned');
  const rows = page.locator('li[data-task-row]');
  await expect(rows).toHaveCount(2);
  const box = page.locator('[data-task-search] input[type="search"]');
  const entries = await page.evaluate(() => window.history.length);

  // ---- typing alone filters; the address follows; the box keeps its focus and every letter
  await box.click();
  await box.pressSequentially('zeb', { delay: 40 });
  await expect(rows, 'typing alone filters the list — no Enter').toHaveCount(1);
  await expect(page.locator(`li[data-task-row="${zebra}"]`)).toBeVisible();
  await expect(page, '?q= follows the box').toHaveURL(/[?&]q=zeb(&|$)/);
  await expect(box, 'the box keeps the focus').toBeFocused();
  await page.keyboard.type('ra', { delay: 40 });
  await expect(page).toHaveURL(/[?&]q=zebra(&|$)/);
  await expect(box, 'typing on loses no letter').toHaveValue('zebra');
  await expect(box).toBeFocused();
  expect(await box.evaluate((el: HTMLInputElement) => el.selectionStart), 'the caret is at the end').toBe(5);
  await expect(page, 'the tab is kept').toHaveURL(/view=owned/);
  expect(await page.evaluate(() => window.history.length), 'typing adds nothing to Back').toBe(entries);

  // ---- a search with no match, then emptying the box
  await box.fill(`zebra-nothing-${word}`);
  await expect(rows).toHaveCount(0);
  await box.fill('');
  await expect(rows, 'emptying the box brings every task back').toHaveCount(2);
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(box).toBeFocused();

  // ---- Enter still asks, at once
  await box.fill('falcon');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/[?&]q=falcon(&|$)/);
  await expect(rows).toHaveCount(1);
  await expect(page.locator(`li[data-task-row="${falcon}"]`)).toBeVisible();
  expect(await page.evaluate(() => window.history.length), 'Enter adds nothing to Back either').toBe(entries);
  // a refresh keeps the search and shows it in the box
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-task-search] input[type="search"]')).toHaveValue('falcon');
  await expect(rows).toHaveCount(1);

  // ---- the board is searched the same way, and stays the board; the calendar too
  await page.goto('/tasks?view=owned&layout=board');
  await hydrated(page);
  const cards = page.locator('[data-board-card]');
  await expect(cards).toHaveCount(2);
  await box.click();
  await box.pressSequentially('zebra', { delay: 40 });
  await expect(cards, 'typing filters the board').toHaveCount(1);
  await expect(page.locator(`[data-board-card="${zebra}"]`)).toBeVisible();
  await expect(page).toHaveURL(/layout=board/);
  await expect(page).toHaveURL(/[?&]q=zebra(&|$)/);
  await expect(page.locator('[data-task-board]')).toBeVisible();
  await box.fill('');
  await expect(cards).toHaveCount(2);
  await page.goto('/tasks?view=owned&layout=calendar');
  await hydrated(page);
  await box.click();
  await box.pressSequentially('zebra', { delay: 40 });
  await expect(page, 'the calendar is searched as it is typed in, and stays the calendar').toHaveURL(
    /layout=calendar.*[?&]q=zebra(&|$)/,
  );

  // ---- the other tabs that have the box
  for (const view of ['my_work', 'team', 'past']) {
    await page.goto(`/tasks?view=${view}`);
    await hydrated(page);
    await box.click();
    await box.pressSequentially('zebra', { delay: 40 });
    await expect(page, `${view}: ?q= follows the box`).toHaveURL(/[?&]q=zebra(&|$)/);
    await expect(box, view).toBeFocused();
  }
  await context.close();
});
