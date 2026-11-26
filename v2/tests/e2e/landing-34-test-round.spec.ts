/**
 * Landing 34 in the browser: the fixes of the owner's test round of 19 Nov, one test per group, with volume.
 *  a. Today's three is on My day for every employee role — three groups, at most three each, where each group comes
 *     from, no task drawn twice — with the streak line, and stacked on a phone. Landing 34b: the database picks it
 *     from all the person's own open tasks — the exact titles in order, an overdue task under Maintenance and never
 *     Short, an undated one under Maintenance, "N more in Tasks", no cancelled or done task — and a second load
 *     gives the same lists. a2: the same on a second load, after coming back and after signing in again.
 *  b. Partners with forty organisations: the list loads on the first try, the search box filters, a name opens its
 *     record on the first click, the record does not wait for the Finance summary, Archived is a Status choice and
 *     Unarchive shows at once, a new partner is on the list on the way back, a saved note is on the record at once,
 *     every row has Actions and a long name is read whole.
 *  c. The top search opens a result by Enter and by a click; the menu's links move on the first click.
 *  d. Everyone sees Finance and everyone adds to it (the owner, 21 Nov — this overrules item 5 of the round, "members
 *     must not see Finance"): a member has it in the menu, the bar, Ctrl K, by address and on a partner, with New
 *     invoice, as a manager does; a viewer sees it and has no write control (a write of their own is refused); a
 *     person set to None in Settings › People & access › Access has no Finance anywhere.
 *  e. Finance loads every block on the first try; the Provisional amount is one amount in three places and counts
 *     the imported row; Income by company has its address; an old Payments date says so.
 *  f. The workspace reads "Direct Corporate"; the phone's top bar carries the brand; a record's sections are one row
 *     on a phone; words keep their spaces.
 *  g. A failed Add task says so in the form and keeps what was typed; /tasks/new opens its form.
 *  h. From one TEST user straight to another.
 * Every value is made up. Sabotage: tests/sabotage/landing-34-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  DESKTOP,
  PHONE,
  daysAgo,
  doorOf,
  hydrated,
  num,
  paymentsAsOf,
  quietMonth,
  searchFor,
  sectionsBar,
  seedFinanceMonth,
  seedOpenTasks,
  seedOrg,
  seedOrganisations,
  seedTestUsers,
  seedTwentyFive,
  sideways,
  signedInAdmin,
  signedInAs,
  staffAs,
  tag,
  threeOnScreen,
} from './support/landing-34';
import { callAs, signIn, sql } from './support/stack';

const drawerLabels = async (page: Page) =>
  (await page.locator('[data-drawer] a[href]:not([data-entity])').allInnerTexts()).map((l) => l.trim()).filter(Boolean);
const barLabels = async (page: Page) =>
  (await page.locator('[data-bottom-bar] a, [data-bottom-bar] button').allInnerTexts()).map((l) => l.trim());

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

// ------------------------------------------------------------------------------------------- a · Today's three

const SOURCES = [
  'Important — your starred tasks first, then your longest overdue',
  'Short — due today or within 2 days first, then your next due days',
  'Maintenance — the rest of your own open tasks',
];
const GROUPS = ['important', 'short', 'maintenance'] as const;

test("a · Today's three is on My day for every employee role, with its streak, and stacks on a phone", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  for (const role of ['admin', 'head', 'manager', 'member', 'viewer'] as const) {
    const person = await staffAs(role);
    const word = tag();
    // the member carries the volume (25 tasks and a streak); a Viewer has no tasks. The others: 4 starred, 4 due
    // today or tomorrow, and 5 others — 2 overdue since more than a year, 2 with no due day and 1 due later (the head:
    // 3 with no due day and none later, so one of them is drawn) — plus a cancelled and a done task, never current
    const full = role === 'member' ? await seedTwentyFive(person, word) : null;
    const open4 =
      role === 'viewer' || full
        ? null
        : await seedOpenTasks(
            person,
            word,
            role === 'head'
              ? { starred: 4, quick: 4, later: 0, overdue: 2, undated: 3, ghosts: true }
              : { starred: 4, quick: 4, later: 1, overdue: 2, undated: 2, ghosts: true },
          );
    const seeded = full?.open ?? open4;
    const { context, page } = await signedInAs(browser, person);
    try {
      await hydrated(page);
      const three = page.locator('[data-todays-three]');
      await expect(three, `${role}: Today's three is on My day`).toBeVisible();
      await expect(three.locator('[data-three-own]'), `${role}: it says whose tasks these are`).toHaveText(
        'From your own task lists',
      );
      const groups = three.locator('[data-three-group]');
      await expect(groups, `${role}: three groups`).toHaveCount(3);
      expect(
        await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-three-group'))),
        `${role}: Important, Short, Maintenance, in that order`,
      ).toEqual(['important', 'short', 'maintenance']);
      for (const g of GROUPS) {
        const rows = await three.locator(`[data-three-group="${g}"] [data-three-row]`).count();
        expect(rows, `${role}: ${g} holds at most three tasks`).toBeLessThanOrEqual(3);
      }
      await expect(
        three.locator('[data-three-sources] [data-three-source]'),
        `${role}: each group says where it comes from`,
      ).toHaveText(SOURCES);

      if (seeded) {
        await expect(
          three.locator('[data-three-group="important"] [data-three-row]'),
          `${role}: three of the starred tasks are Important`,
        ).toHaveCount(3);
        await expect(
          three.locator('[data-three-group="short"] [data-three-row]'),
          `${role}: three of the tasks due today or tomorrow are Short`,
        ).toHaveCount(3);
        await expect(
          three.locator('[data-three-group="maintenance"] [data-three-row]'),
          `${role}: three of the other own tasks are Maintenance`,
        ).toHaveCount(3);
        const first = await threeOnScreen(page);
        // the exact three of each group, in the database's one order: due day (no due day last), then number
        const titlesOf = (numbers: string[]) => numbers.map((n) => seeded.titles[n]);
        for (const g of GROUPS) {
          expect(first[g]!.titles, `${role}: ${g} draws exactly the expected titles, in order`).toEqual(
            titlesOf(seeded.three[g]),
          );
          expect(first[g]!.rows, `${role}: ${g} draws exactly the expected tasks, in order`).toEqual(seeded.three[g]);
          expect(first[g]!.count, `${role}: ${g} counts the three it draws`).toBe('3');
          expect(
            first[g]!.more,
            `${role}: ${g} says how many more it holds in Tasks (${seeded.totals[g]} in all)`,
          ).toBe(seeded.totals[g] - 3);
        }
        // named outright, so the rule is read here and not only worked out: starred due today first, then the later one
        expect(first.important!.titles, `${role}: Important is the starred tasks, the ones due today first`).toEqual([
          `Made-up task ${word} starred 1`,
          `Made-up task ${word} starred 3`,
          full ? `Made-up task ${word} starred 5` : `Made-up task ${word} starred 2`,
        ]);
        expect(first.short!.titles, `${role}: Short is the unstarred tasks due today, then tomorrow`).toEqual([
          `Made-up task ${word} quick 1`,
          `Made-up task ${word} quick 3`,
          full ? `Made-up task ${word} quick 5` : `Made-up task ${word} quick 2`,
        ]);
        expect(
          first.maintenance!.titles,
          `${role}: Maintenance starts with the tasks overdue since long ago, then the next by due day`,
        ).toEqual([
          `Made-up task ${word} overdue 1`,
          `Made-up task ${word} overdue 2`,
          role === 'head' ? `Made-up task ${word} undated 1` : `Made-up task ${word} later 1`,
        ]);
        for (const number of seeded.overdue) {
          await expect(
            three.locator(`[data-three-group="maintenance"] [data-three-row="${number}"]`),
            `${role}: a task overdue since long ago is under Maintenance (${seeded.titles[number]})`,
          ).toHaveCount(1);
          await expect(
            three.locator(`[data-three-group="short"] [data-three-row="${number}"]`),
            `${role}: an overdue task is never Short (${seeded.titles[number]})`,
          ).toHaveCount(0);
        }
        // a task with no due day is Maintenance: drawn there (the head) or counted in its "N more in Tasks" line
        const undatedDrawn = seeded.undated.filter((n) => first.maintenance!.rows.includes(n));
        expect(undatedDrawn.length, `${role}: the undated tasks drawn under Maintenance`).toBe(role === 'head' ? 1 : 0);
        expect(
          first.maintenance!.rows.length + first.maintenance!.more,
          `${role}: every other own task — overdue, later and undated — is counted under Maintenance`,
        ).toBe(seeded.later.length + seeded.overdue.length + seeded.undated.length);
        for (const number of seeded.undated) {
          for (const g of ['important', 'short'])
            await expect(
              three.locator(`[data-three-group="${g}"] [data-three-row="${number}"]`),
              `${role}: an undated task is neither Important nor Short`,
            ).toHaveCount(0);
        }
        const moreLine = three.locator('[data-three-group="important"] [data-three-more]');
        await expect(moreLine, `${role}: the more line says how many`).toHaveText(
          `${seeded.totals.important - 3} more in Tasks`,
        );
        await expect(moreLine.locator('a'), `${role}: the more line leads to Tasks`).toHaveAttribute('href', '/tasks');
        // a task whose status says cancelled (its closed stamp empty) and a done task are current nowhere on My day
        for (const number of seeded.ghosts)
          await expect(
            page.locator(`[data-today-task="${number}"]`),
            `${role}: a cancelled or a done task never shows as current (${seeded.titles[number]})`,
          ).toHaveCount(0);
        if (seeded.ghosts.length)
          await expect(
            page.locator('[data-todays-three], [data-today-block]').getByText(/cancelled|finished/),
            `${role}: no cancelled and no done task is named in Today's three or the Today block`,
          ).toHaveCount(0);

        const picked = GROUPS.flatMap((g) => first[g]!.rows);
        for (const number of picked) {
          await expect(
            page.locator(`[data-today-block] [data-today-task="${number}"]`),
            `${role}: a task picked into Today's three is not drawn again in the Today block (${number})`,
          ).toHaveCount(0);
          await expect(
            page.locator(`[data-today-task="${number}"]`),
            `${role}: a picked task is drawn once (${number})`,
          ).toHaveCount(1);
        }
        // the tasks not picked stay in the Today block below
        const left = seeded.quick.filter((n) => !picked.includes(n));
        await expect(
          page.locator(`[data-today-block] [data-today-task="${left[0]}"]`),
          `${role}: a task not picked stays in the Today block`,
        ).toHaveCount(1);

        // the owner's own check: My day loaded twice gives exactly the same three lists in the same order
        await page.reload();
        await hydrated(page);
        await expect(three.locator('[data-three-row]'), `${role}: the second load draws its nine rows`).toHaveCount(9);
        expect(
          await threeOnScreen(page),
          `${role}: a second load of My day gives exactly the same three lists in the same order`,
        ).toEqual(first);
      }

      if (full) {
        const streak = three.locator('[data-streak]');
        await expect(streak, 'member: the streak line reads the seeded streak').toHaveAttribute(
          'data-streak',
          String(full.streak.days),
        );
        await expect(streak, 'member: the streak line says the working days in a row').toContainText(
          `${full.streak.days}-day streak`,
        );
        // Landing 53: "N of 9 done today" counts the rows of the three that are ticked, out of the rows drawn
        const ticked = await three.locator('[data-three-row][data-row-done]').count();
        await expect(
          three.locator('[data-streak-today]'),
          'member: the streak line says how many of the rows drawn are done today',
        ).toHaveText(`${ticked} of 9 done today`);

        // on a phone the three groups stack and nothing scrolls sideways
        await page.setViewportSize(PHONE);
        await page.reload();
        await hydrated(page);
        await expect(three, "member, phone: Today's three is on My day").toBeVisible();
        const boxes = await groups.evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: Math.round(r.left), y: Math.round(r.top), bottom: Math.round(r.bottom) };
          }),
        );
        expect(new Set(boxes.map((b) => b.x)).size, 'member, phone: the three groups start at the same edge').toBe(1);
        expect(
          boxes[1]!.y >= boxes[0]!.bottom && boxes[2]!.y >= boxes[1]!.bottom,
          `member, phone: the three groups stack, one under the other (${JSON.stringify(boxes)})`,
        ).toBe(true);
        expect(await sideways(page), 'member, phone: My day does not scroll sideways').toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  }
});

test("a2 · Today's three is the same for the same person on a second load and after signing in again", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const person = await staffAs('member');
  const word = tag();
  // many tasks on the same days and several with no due day: only one fixed order keeps the lists still
  const seeded = await seedOpenTasks(person, word, { starred: 6, quick: 7, later: 2, overdue: 3, undated: 4 });
  const read = async (page: Page) => {
    await hydrated(page);
    await expect(page.locator('[data-todays-three] [data-three-row]'), 'nine rows are drawn').toHaveCount(9);
    return threeOnScreen(page);
  };
  const one = await signedInAs(browser, person);
  let first: Awaited<ReturnType<typeof threeOnScreen>>;
  try {
    first = await read(one.page);
    for (let load = 2; load <= 3; load += 1) {
      await one.page.reload();
      expect(
        await read(one.page),
        `Today's three is the same on load ${load} as on the first: the same tasks in the same order`,
      ).toEqual(first);
    }
    // away to another page and back: still the same
    await open(one.page, '/tasks');
    await open(one.page, '/my-day');
    expect(await read(one.page), "Today's three is the same after leaving My day and coming back").toEqual(first);
  } finally {
    await one.context.close();
  }
  // a new sign-in, in a browser that has never seen this person
  const two = await signedInAs(browser, person);
  try {
    expect(await read(two.page), "Today's three is the same after signing in again").toEqual(first);
  } finally {
    await two.context.close();
  }
  // and it is the rule's own order, not just a still one: due day (no due day last), then number
  for (const g of GROUPS) {
    expect(first[g]!.rows, `Today's three is the same as the rule's fixed order · ${g}`).toEqual(seeded.three[g]);
    expect(first[g]!.more, `Today's three · ${g} says how many more it holds`).toBe(seeded.totals[g] - 3);
  }
});

// ------------------------------------------------------------------------------------- b · Partners with volume

test('b · Partners with forty organisations: the list, its search, a name, the record, Archived, a new partner, a note, Actions and a long name', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const { call } = await signedInAdmin(page);
  const word = `zq${tag()}`;
  const orgs = await seedOrganisations(call, word, 40);
  const long = orgs[0]!;
  const seventh = orgs[6]!;
  const archived = orgs.filter((o) => o.archived);
  const shown = orgs.length - archived.length;

  // the list loads its rows on the first try
  await open(page, '/partners');
  const rows = page.locator('[data-partners-rows]');
  await expect(rows.locator('[data-partner-link]').first(), 'the list draws its rows on the first try').toBeVisible({
    timeout: 30_000,
  });
  await expect(rows.locator('[data-state="failed"]'), 'the list did not fail to load').toHaveCount(0);
  await expect(page.locator('[data-read-retry]'), 'the list offers no Try again').toHaveCount(0);
  await expect(page.locator('[data-partners-partial]'), 'owners and types loaded with the list').toHaveCount(0);

  // typing in the search box filters the rows to the match
  const search = page.locator('[data-partners-search]');
  await search.fill(word);
  await search.press('Enter');
  await expect(page, 'the search is written to the address').toHaveURL(new RegExp(`[?&]q=${word}(&|$)`));
  await expect(page.locator('[data-partners-total]'), 'the search finds the seeded organisations').toHaveText(
    `${shown} organisations`,
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-partners-pending]'), 'the list is not left saying Loading').toHaveCount(0);
  const drawn = await rows.locator('tbody tr:has([data-partner-link])').count();
  expect(drawn, 'the found organisations are drawn as rows').toBeGreaterThan(0);
  expect(
    await rows.locator('tbody tr:has([data-partner-link]):not(:has([data-partner-actions]))').count(),
    'every row has its Actions button',
  ).toBe(0);
  expect(
    await rows
      .locator('[data-partner-link]')
      .evaluateAll((els, w) => els.filter((e) => !(e.textContent ?? '').includes(w)).length, word),
    'every row drawn is a match of the search',
  ).toBe(0);

  await search.fill(seventh.token);
  await search.press('Enter');
  await expect(
    page.locator('[data-partners-total]'),
    'typing in the search box filters the rows to the match',
  ).toHaveText('1 organisation', { timeout: 30_000 });
  await expect(rows.locator('[data-partner-link]'), 'only the match is listed').toHaveCount(1);
  await expect(rows.locator(`[data-partner-link="${seventh.id}"]`), 'the match is the one searched for').toBeVisible();

  // a long name wraps and is read whole
  await search.fill(long.token);
  await search.press('Enter');
  const longLink = rows.locator(`[data-partner-link="${long.id}"]`);
  await expect(longLink, 'the long-named organisation is found').toBeVisible({ timeout: 30_000 });
  await expect(longLink, 'a long name is shown whole').toContainText(long.name);
  const fit = await longLink.evaluate((a) => {
    const cell = a.closest('[data-partner-name]') as HTMLElement;
    const cut = [a, ...a.querySelectorAll('*')].some((e) => getComputedStyle(e).textOverflow === 'ellipsis');
    return { cut, scroll: cell.scrollWidth, client: cell.clientWidth, lines: a.getBoundingClientRect().height };
  });
  expect(fit.cut, 'a long name is not cut with an ellipsis').toBe(false);
  expect(fit.scroll, 'a long name wraps inside its place').toBeLessThanOrEqual(fit.client);
  expect(fit.lines, 'a long name takes more than one line').toBeGreaterThan(24);

  // one click on the name opens the record; the record does not wait for the Finance summary
  let summaryReads = 0;
  page.on('request', (r) => {
    if (r.url().includes('/rpc/company_summary')) summaryReads += 1;
  });
  await page.route('**/rest/v1/rpc/company_summary*', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => undefined);
  });
  await longLink.click();
  await expect(page, 'one click on the name opens the record').toHaveURL(new RegExp(`/partners/${long.id}$`), {
    timeout: 30_000,
  });
  await hydrated(page);
  const header = page.locator('[data-record-header]');
  await expect(header, 'the record draws its card').toContainText(long.name);
  await expect(page.locator('[data-partner-details]'), 'the Overview is drawn').toBeVisible();
  expect(summaryReads, 'the record did not ask for the Finance summary to draw its card').toBe(0);
  await header.locator('[data-tabs] a[href*="tab=finance"]').click();
  await expect(
    page.locator('[data-summary-state="loading"]'),
    'the Finance tab says it is loading its summary',
  ).toBeVisible();
  await expect(page.locator('[data-summary-state]'), 'the Finance tab loads its summary').toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-partner-finance]'), 'the Finance tab is drawn').toBeVisible();
  expect(summaryReads, 'the summary was asked for once the tab was opened').toBeGreaterThan(0);
  await page.unroute('**/rest/v1/rpc/company_summary*');

  // a saved note is on the record at once
  await open(page, `/partners/${long.id}`);
  const note = `Made-up note ${tag()}`;
  await page.locator('[data-partner-edit]').click();
  await page.locator('[data-partner-edit-form]').getByLabel('Notes', { exact: true }).fill(note);
  await page.locator('[data-partner-edit-save]').click();
  await expect(page.locator('[data-partner-details]'), 'the saved note is on the record at once').toContainText(note);

  // the Status filter offers Archived; an archived row offers Unarchive
  await open(page, `/partners?q=${word}`);
  await page.locator('[data-chip="Status"] button').first().click();
  const archivedChoice = page.locator('[data-chip-picker] [data-chip-option="archived"]');
  await expect(archivedChoice, 'the Status filter offers Archived').toBeVisible();
  await archivedChoice.locator('#status-archived').click();
  await page.keyboard.press('Escape');
  await expect(page, 'Archived is written to the address').toHaveURL(/[?&]archived=1(&|$)/);
  await expect(page.locator('[data-archived-banner]'), 'the list says it shows the archived ones').toBeVisible();
  await expect(page.locator('[data-partners-total]'), 'the archived organisations are listed').toHaveText(
    `${archived.length} organisations`,
    { timeout: 30_000 },
  );
  const gone = archived[0]!;
  await page.locator(`[data-partner-actions="${gone.id}"]`).click();
  await expect(
    page.locator('[data-partner-row-unarchive]'),
    "an archived row's Actions offers Unarchive",
  ).toBeVisible();
  await expect(page.locator('[data-partner-row-archive]'), 'an archived row does not offer Archive').toHaveCount(0);
  await page.keyboard.press('Escape');

  // after Unarchive on the record the Archived chip and line go without a reload
  await open(page, `/partners/${gone.id}`);
  await expect(page.locator('[data-partner-archived-chip]'), 'an archived record says Archived').toBeVisible();
  await expect(
    page.locator('[data-partner-archived-note]'),
    'an archived record says why it takes no change',
  ).toBeVisible();
  await page.locator('[data-partner-unarchive-inline]').click();
  await expect(
    page.locator('[data-partner-archived-chip]'),
    'after Unarchive the Archived chip is gone without a reload',
  ).toHaveCount(0);
  await expect(
    page.locator('[data-partner-archived-note]'),
    'after Unarchive the archived line is gone without a reload',
  ).toHaveCount(0);

  // a partner added from the list is on the list on the way back, without a reload. The list is searched for the
  // new name's own token first (nothing yet), so the one row is on screen whatever else the list holds.
  const freshToken = `${word}new`;
  const fresh = `Made-up Org ${word} ${freshToken}`;
  await open(page, `/partners?q=${freshToken}`);
  await expect(page.locator('[data-partners-total]'), 'nothing carries the new name yet').toHaveText(
    '0 organisations',
    { timeout: 30_000 },
  );
  await page.locator('[data-partner-new]').click();
  const form = page.locator('[data-partner-form]');
  await form.getByLabel('Trade name', { exact: true }).fill(fresh);
  await form.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Corporate' }).click();
  await page.locator('[data-partner-save]').click();
  await expect(page, 'the new partner opens').toHaveURL(/\/partners\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.locator('[data-record-header]'), 'the new record is drawn').toContainText(fresh);
  await page.goBack();
  await expect(page, 'Back returns to the list').toHaveURL(new RegExp(`/partners\\?q=${freshToken}$`));
  await expect(
    page.locator('[data-partners-rows] [data-partner-link]').filter({ hasText: fresh }),
    'the partner just added is on the list on the way back, without a reload',
  ).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('[data-partners-total]'), 'the list counts the partner just added').toHaveText(
    '1 organisation',
  );
});

// ------------------------------------------------------------------------------- c · search and the menu's links

test('c · the top search opens a result by Enter and by a click; the menu moves on the first click', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize(DESKTOP);
  const { call } = await signedInAdmin(page);
  const org = await seedOrg(call, `Search ${tag()}`);
  const record = new RegExp(`/partners/${org.id}$`);

  let palette = await searchFor(page, org.name);
  let hit = palette.locator(`[data-palette-partner="${org.id}"]`);
  await expect(hit, 'the search finds the organisation by its name').toBeVisible({ timeout: 20_000 });
  await expect(hit, 'the result is the one Enter will open').toHaveAttribute('data-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page, 'Enter on a search result opens the record').toHaveURL(record, { timeout: 30_000 });
  await expect(palette, 'the search closes').toHaveCount(0);
  await hydrated(page);
  await expect(page.locator('[data-record-header]'), 'the record is drawn').toContainText(org.name);

  await open(page, '/my-day');
  palette = await searchFor(page, org.name);
  hit = palette.locator(`[data-palette-partner="${org.id}"]`);
  await expect(hit).toBeVisible({ timeout: 20_000 });
  await hit.click();
  await expect(page, 'a click on a search result opens the record').toHaveURL(record, { timeout: 30_000 });

  // from a partner record, each link of the menu moves on the FIRST click
  for (const [name, href] of [
    ['Finance', '/finance'],
    ['Tasks', '/tasks'],
    ['Partners', '/partners'],
  ] as const) {
    await open(page, `/partners/${org.id}`);
    await expect(page.locator('[data-record-header]')).toContainText(org.name);
    await page.locator(`[data-drawer] a[href="${href}"]`).click();
    await expect(page, `${name} in the menu opens on the first click`).toHaveURL(new RegExp(`${href}(\\?[^#]*)?$`), {
      timeout: 30_000,
    });
  }
});

// ------------------------------------------------------------------------------------------------- d · access

const invoiceOf = (ym: string, total: number) => ({
  p_table: 'invoice',
  p_fields: {
    ref: `TX-935${Math.floor(Math.random() * 900000 + 100000)}`,
    kind: 'transaction',
    status: 'Fully Paid',
    created_on: `${ym}-10`,
    paid_on: `${ym}-12`,
    total_sar: total,
    customer_name: 'Made-up Trading Org',
  },
  p_reason: 'made up',
});

test('d · a member sees Finance — the menu, the bar, Ctrl K, by address, on a partner — and can add; a viewer sees it and cannot add; a person set to None does not see it; a manager has it', async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const admin = await staffAs('admin');
  // one made-up import from Payments is logged, so the Finance page is past "Not imported yet" (as signedInAdmin does)
  await sql(
    `insert into finance.import_batch (id, file, file_name, export_time, started_by)
     values ('00000000-0000-4000-8000-0000000f1ce5', 'invoices', 'made-up-invoices.xlsx', now() - interval '1 day', $1)
     on conflict (id) do nothing`,
    [admin.id],
  );
  const a = await signedInAs(browser, admin);
  const adminDoor = doorOf(a.context);
  const org = await seedOrg(adminDoor, `Access ${tag()}`);
  // the person with no Finance: a member set to None on Finance and on a partner's Finance tab by a person change —
  // the same door Settings › People & access › Access calls for an admin
  const closed = await staffAs('member');
  for (const page of ['finance', 'partner_finance'])
    await adminDoor('access_set_person_level', {
      p_person: closed.id,
      p_page: page,
      p_level: 'none',
      p_reason: 'Made up: no Finance for this person',
    });
  await a.context.close();

  // a member, and a second member standing in for anyone of Commercial: Finance everywhere, and New invoice
  for (const who of ['a member', 'a second member of Commercial']) {
    const { context, page } = await signedInAs(browser, await staffAs('member'));
    try {
      await hydrated(page);
      expect(await drawerLabels(page), `${who}: Finance is in the menu`).toContain('Finance');

      const palette = await searchFor(page, 'Finance');
      await expect(
        palette.getByRole('option', { name: 'Finance', exact: true }),
        `${who}: Ctrl K offers Finance`,
      ).toHaveCount(1);
      await page.keyboard.press('Escape');

      // the member adds a paid invoice of their own in a far-past month, and Finance draws it for them
      const ym = await quietMonth();
      const added = await callAs(context, 'finance_row_add', invoiceOf(ym, 4320));
      expect(added.status, `${who}: their own write to Finance is taken: ${JSON.stringify(added.body)}`).toBe(200);
      await page.locator('[data-drawer] a[href="/finance"]').click();
      await expect(page, `${who}: Finance opens from the menu`).toHaveURL(/\/finance(\?|$)/, { timeout: 30_000 });
      await open(page, `/finance?period=custom&from=${ym}-01&to=${ym}-28`);
      await blocksSettled(page);
      await expect(page.locator('[data-state="no-access"]'), `${who}: /finance is not refused`).toHaveCount(0);
      await expect(
        page.locator('[data-finance-tile="revenue"]'),
        `${who}: the figures are drawn, their own invoice in them`,
      ).toContainText('4,320');
      const newInvoice = page.locator('[data-new-invoice-link]');
      await expect(newInvoice, `${who}: New invoice is offered`).toBeVisible();
      await newInvoice.click();
      await expect(page, `${who}: New invoice opens its form`).toHaveURL(/\/finance\/new$/, { timeout: 30_000 });
      await hydrated(page);
      await expect(page.locator('[data-new-invoice]'), `${who}: the New invoice form is drawn`).toBeVisible();

      // a partner's Finance tab: the tab is there, and the money is drawn
      await open(page, `/partners/${org.id}?tab=finance`);
      await expect(page.locator('[data-record-header]'), `${who}: the partner record opens`).toContainText(org.name);
      await expect(page.locator('[data-summary-state]'), `${who}: the Finance tab has answered`).toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(
        page.locator('[data-partner-finance]'),
        `${who}: the money of the partner is drawn on its Finance tab`,
      ).toBeVisible();
      await expect(
        page.locator('#main [data-state="no-access"]'),
        `${who}: a partner's Finance tab does not say no access`,
      ).toHaveCount(0);

      await page.setViewportSize(PHONE);
      await open(page, '/my-day');
      const bar = await barLabels(page);
      await page.locator('[data-bottom-more]').click();
      const sheet = page.locator('[data-more-sheet]');
      await expect(sheet).toBeVisible();
      const more = await sheet.locator('a[href="/finance"]').count();
      expect(
        bar.includes('Finance') || more > 0,
        `${who}: Finance is in the phone's bar or under More (bar: ${bar.join(', ')})`,
      ).toBe(true);
      await page.keyboard.press('Escape');
    } finally {
      await context.close();
    }
  }

  // a viewer — the view-only role: sees Finance and the figures, and has no write control; a write is refused
  {
    const { context, page } = await signedInAs(browser, await staffAs('viewer'));
    try {
      await hydrated(page);
      expect(await drawerLabels(page), 'a viewer: Finance is in the menu').toContain('Finance');
      await page.locator('[data-drawer] a[href="/finance"]').click();
      await expect(page, 'a viewer: Finance opens').toHaveURL(/\/finance(\?|$)/, { timeout: 30_000 });
      await hydrated(page);
      await blocksSettled(page);
      await expect(page.locator('[data-state="no-access"]'), 'a viewer: /finance is not refused').toHaveCount(0);
      await expect(page.locator('[data-finance-tiles]'), 'a viewer: the figures are drawn').toBeVisible();
      await expect(page.locator('[data-new-invoice-link]'), 'a viewer: no New invoice').toHaveCount(0);
      await expect(page.locator('[data-close-month]'), 'a viewer: no Close month').toHaveCount(0);
      await page.locator('[data-create]').click();
      await expect(page.locator('[data-create-item="invoice"]'), 'a viewer: Create offers no Invoice').toHaveCount(0);
      await page.keyboard.press('Escape');
      await open(page, '/finance/new');
      await expect(page.locator('[data-new-invoice]'), 'a viewer: the New invoice form is not drawn').toHaveCount(0);
      await expect(page.locator('[data-state="no-access"]'), 'a viewer: /finance/new says no access').toHaveCount(1);
      const refused = await callAs(context, 'finance_row_add', invoiceOf(await quietMonth(), 250));
      expect(refused.status, `a viewer: a write of their own is refused: ${JSON.stringify(refused.body)}`).toBe(403);
      expect((refused.body as { code?: string }).code, 'a viewer: refused for want of access').toBe('42501');

      await open(page, `/partners/${org.id}?tab=finance`);
      await expect(page.locator('[data-summary-state]'), 'a viewer: the Finance tab has answered').toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(
        page.locator('[data-partner-finance]'),
        'a viewer: the money of the partner is drawn on its Finance tab',
      ).toBeVisible();
    } finally {
      await context.close();
    }
  }

  // a person set to None: no Finance in the menu, the bar, More or Ctrl K, by address or on a partner
  {
    const who = 'a person set to None';
    const { context, page } = await signedInAs(browser, closed);
    try {
      await hydrated(page);
      expect(await drawerLabels(page), `${who}: no Finance link in the menu`).not.toContain('Finance');
      await expect(page.locator('[data-drawer] a[href="/finance"]'), `${who}: no Finance link in the menu`).toHaveCount(
        0,
      );

      const palette = await searchFor(page, 'Finance');
      await expect(
        palette.getByRole('option', { name: 'Finance', exact: true }),
        `${who}: Ctrl K does not offer Finance`,
      ).toHaveCount(0);
      await page.keyboard.press('Escape');

      await open(page, '/finance');
      await expect(page.locator('[data-state="no-access"]'), `${who}: /finance says no access`).toHaveCount(1);
      await expect(page.locator('[data-finance-overview]'), `${who}: no Finance figures`).toHaveCount(0);
      const refused = await callAs(context, 'finance_row_add', invoiceOf(await quietMonth(), 250));
      expect(refused.status, `${who}: a write of their own is refused`).toBe(403);

      // a partner's Finance tab: the tab is there, and says the money is not open to them
      await open(page, `/partners/${org.id}?tab=finance`);
      await expect(page.locator('[data-record-header]'), `${who}: the partner record opens`).toContainText(org.name);
      await expect(page.locator('[data-summary-state]'), `${who}: the Finance tab has answered`).toHaveCount(0, {
        timeout: 30_000,
      });
      await expect(
        page.locator('#main [data-state="no-access"]'),
        `${who}: a partner's Finance tab says no access`,
      ).toContainText('Money for this partner is not open to you');
      await expect(page.locator('[data-partner-finance]'), `${who}: no money of the partner is drawn`).toHaveCount(0);

      await page.setViewportSize(PHONE);
      await open(page, '/my-day');
      expect(await barLabels(page), `${who}: no Finance in the phone's bar`).not.toContain('Finance');
      await page.locator('[data-bottom-more]').click();
      const sheet = page.locator('[data-more-sheet]');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('a[href="/finance"]'), `${who}: no Finance under More`).toHaveCount(0);
      await page.keyboard.press('Escape');
    } finally {
      await context.close();
    }
  }

  const { context, page } = await signedInAs(browser, await staffAs('manager'));
  try {
    await hydrated(page);
    const menu = await drawerLabels(page);
    expect(menu, 'a manager has Finance in the menu').toContain('Finance');
    expect(menu, 'a manager has Activity in the menu').toContain('Activity');
    expect(menu, 'a manager has no Settings in the menu').not.toContain('Settings');
    await page.locator('[data-drawer] a[href="/finance"]').click();
    await expect(page, 'Finance opens for a manager').toHaveURL(/\/finance(\?|$)/, { timeout: 30_000 });
    await expect(page.locator('[data-finance-overview]'), 'Finance draws for a manager').toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-state="no-access"]'), 'a manager is not refused Finance').toHaveCount(0);
    await expect(page.locator('[data-new-invoice-link]'), 'a manager has New invoice, as a member does').toBeVisible();
  } finally {
    await context.close();
  }
});

// ------------------------------------------------------------------------------------------------ e · finance

test('e · Finance loads every block on the first try; one Provisional amount in three places, the imported row in it; Income by company; an honest Payments stamp', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const { call, admin } = await signedInAdmin(page);
  const month = await seedFinanceMonth(call, admin);

  const { context, page: desk } = await signedInAs(browser, await staffAs('manager'));
  try {
    // the Payments stamp: first a day five days back, then yesterday
    let asOf = daysAgo(5);
    await paymentsAsOf(desk, () => asOf);
    await open(desk, month.url);
    await blocksSettled(desk);
    const overview = desk.locator('[data-finance-overview]');
    await expect(overview.locator('[data-state="failed"]'), 'no Finance block failed on the first try').toHaveCount(0);
    await expect(overview.locator('[data-finance-tiles]'), 'the figures are drawn').toBeVisible();
    await expect(overview.locator('[data-finance-months]'), 'the months are drawn').toBeVisible();
    await expect(overview.locator('[data-finance-service]'), 'Income by service is drawn').toBeVisible();
    await expect(desk.locator('[data-finance-report]'), 'the ledger is drawn, not left on Loading').toBeVisible({
      timeout: 45_000,
    });
    await expect(desk.locator('[data-state="loading"]'), 'nothing on Finance is left on Loading').toHaveCount(0, {
      timeout: 45_000,
    });

    // one Provisional amount, the imported row in it: the card, the months' total and the month's row
    const amount = async (where: string, what: string) => {
      const el = desk.locator(where);
      await expect(el, `${what} is drawn`).toBeVisible();
      return num(await el.innerText());
    };
    expect(
      await amount(
        '[data-finance-tile="revenue"] [data-finance-provisional-amount]',
        'the Provisional amount of the card',
      ),
      'the card says the Provisional amount, the imported row in it',
    ).toBe(month.provisional);
    expect(
      await amount('[data-finance-total-provisional]', 'the Provisional amount of the months total'),
      'the Months total says the same Provisional amount',
    ).toBe(month.provisional);
    expect(
      await amount(`[data-finance-month="${month.row}"] > div > span >> nth=4`, 'the Provisional amount of the month'),
      "the month's row says the same Provisional amount",
    ).toBe(month.provisional);
    await expect(
      desk.locator(`[data-finance-month-provisional="${month.row}"]`),
      'the Provisional row under the month says the same amount',
    ).toContainText('1,500');
    await expect(
      desk.locator('[data-finance-tile="provisional"] [data-finance-exact]'),
      'the Provisional card says the same amount',
    ).toContainText('1,500');

    // the Cost card names the amount it leaves out — an amount, never a dash
    const left = desk.locator('[data-finance-tile="cost"] [data-finance-provisional]');
    await expect(left, 'the Cost card says it does not count the Provisional amount').toContainText(
      'not counting Provisional',
    );
    const leftAmount = (await left.locator('[data-finance-provisional-amount]').innerText()).trim();
    expect(leftAmount, 'the Cost card shows the Provisional amount, not a dash').not.toBe('—');
    expect(num(leftAmount), 'the Cost card shows the same Provisional amount').toBe(month.provisional);

    // Income by company: a section with its own address
    const byCompany = desk.locator('[data-finance-by-company]');
    await expect(byCompany, 'the section Income by company is on the page').toBeVisible();
    await expect(byCompany, 'the section is headed Income by company').toContainText('Income by company');
    expect(
      await byCompany.evaluate((e) => e.id === 'finance-company' || !!e.closest('#finance-company')),
      'Income by company has its address (#finance-company)',
    ).toBe(true);
    await expect(
      byCompany.locator(`a[href="/partners/${month.org.id}"]`),
      'Income by company lists the organisation of the imported rows',
    ).toHaveCount(1);
    await expect(
      overview.locator('[data-finance-company-link]'),
      'Income by service links to Income by company',
    ).toHaveAttribute('href', '#finance-company');

    // a Payments day older than two days is said as such; a fresh one reads "as of"
    const stamp = desk.locator('[data-finance-stamp]');
    await expect(stamp, 'an old Payments date is marked stale').toHaveAttribute('data-stale', '');
    await expect(stamp, 'an old Payments date reads "not refreshed since"').toContainText(
      'Payments · not refreshed since',
    );
    asOf = daysAgo(1);
    await desk.reload();
    await hydrated(desk);
    await blocksSettled(desk);
    await expect(stamp, 'a fresh Payments date reads "as of"').toContainText('Payments · as of');
    await expect(stamp, 'a fresh Payments date is not marked stale').not.toHaveAttribute('data-stale', '');
  } finally {
    await context.close();
  }
});

// ------------------------------------------------------------------------------------------ f · brand and shell

test('f · the workspace reads Direct Corporate; the phone top bar carries the brand; record sections are one row on a phone; words keep their spaces', async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const person = await staffAs('admin');
  const word = tag();
  // more tasks due today and tomorrow than Today's three takes, so the Today block keeps a "Quick or hand off"
  // group. Landing 35: a group short of three is topped up, so the three takes up to nine — ten are made, one is left.
  const tasks = await seedOpenTasks(person, word, { starred: 0, quick: 10, later: 0 });
  await page.setViewportSize(DESKTOP);
  await signIn(page, person.email, '/my-day');
  await hydrated(page);
  const org = await seedOrg(doorOf(page.context()), `Brand ${word}`);

  await expect(page, 'the tab title of My day').toHaveTitle('My day · Direct Corporate');

  // words keep their spaces: a group's name and its count; a record's two counts
  // Landing 53: the block opens by kind; the four boxes are one press away
  await page.locator('[data-today-block] [data-rest-view-option="priority"]').click();
  const heading = page.locator('[data-today-block] [data-today-group="quick"] h3');
  await expect(heading, 'the Today block keeps the tasks not picked').toBeVisible();
  expect(
    (await heading.evaluate((e) => e.textContent ?? '')).trim(),
    'the group heading keeps the space before its count',
  ).toMatch(/hand off \d/);
  await open(page, `/partners/${org.id}`);
  const counts = page.locator('[data-record-header] [data-record-counts]');
  await expect(counts, 'the record header carries its counts').toBeVisible();
  expect(
    (await counts.evaluate((e) => e.textContent ?? '')).trim(),
    'the record counts keep their spaces round the dot',
  ).toMatch(/^\d+ comments? · \d+ files?$/);

  // a phone: the brand in the top bar, nothing sideways, and one row of sections fully above the bottom bar
  await page.setViewportSize(PHONE);
  await open(page, '/my-day');
  const brand = page.locator('[data-topbar] [data-top-brand]');
  await expect(brand, 'the phone top bar shows the brand').toBeVisible();
  await expect(brand.locator('[data-brand-word]'), 'the brand says Corporate beside the wordmark').toHaveText(
    'Corporate',
  );
  expect(await sideways(page), 'My day does not scroll sideways on a phone').toBeLessThanOrEqual(0);

  for (const [what, path] of [
    ['the partner record', `/partners/${org.id}`],
    ['the task record', `/tasks/${tasks.quick[0]}`],
  ] as const) {
    await open(page, path);
    await expect(
      page.locator('[data-record-header][data-tabs-one-row] [data-tabs]'),
      `${what}: its sections bar is the one-row kind`,
    ).toBeVisible();
    const bar = (await sectionsBar(page))!;
    expect(bar.tabs, `${what}: the sections are drawn`).toBeGreaterThan(1);
    expect(bar.rows, `${what}: the sections are one row on a phone`).toBe(1);
    expect(bar.height, `${what}: the bar is one tab high`).toBeLessThan(bar.tallest * 2);
    expect(bar.bottom, `${what}: the sections sit fully above the bottom bar`).toBeLessThanOrEqual(bar.barTop);
    expect(await sideways(page), `${what}: nothing scrolls sideways on a phone`).toBeLessThanOrEqual(0);
  }

  // the door, signed out
  const out = await browser.newContext({ viewport: DESKTOP });
  try {
    const door = await out.newPage();
    await door.goto('/sign-in');
    await expect(door, 'the sign-in tab title').toHaveTitle('Sign in · Direct Corporate Workspace');
    await expect(
      door.getByText(`© ${new Date().getFullYear()} Direct Corporate`),
      'the sign-in footer says Direct Corporate',
    ).toBeVisible();
  } finally {
    await out.close();
  }
});

// ---------------------------------------------------------------------------------------------- g · Add task

test('g · a failed Add task says so in the form and keeps what was typed; /tasks/new opens its form', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const person = await staffAs('member');
  await page.setViewportSize(DESKTOP);
  await signIn(page, person.email, '/tasks/new');
  await hydrated(page);
  const form = page.locator('[data-quick-add]');
  await expect(form, '/tasks/new opens its form').toBeVisible({ timeout: 30_000 });
  await expect(form.locator('[data-quick-add-failed]'), 'no failure is said before a save').toHaveCount(0);

  const title = `Made-up task ${tag()} that will not save`;
  await form.getByLabel('Title', { exact: true }).fill(title);
  let asked = 0;
  await page.route('**/rest/v1/rpc/task_create*', (route) => {
    asked += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        code: '57014',
        message: 'canceling statement due to statement timeout',
        details: null,
        hint: null,
      }),
    });
  });
  await form.locator('[data-quick-add-save]').click();
  const failed = form.locator('[data-quick-add-failed]');
  await expect(failed, 'a failed Add task says so in the form').toBeVisible({ timeout: 45_000 });
  await expect(failed, 'the failure says nothing was saved').toContainText(
    'Nothing was saved. What you typed is still here.',
  );
  expect(
    (await failed.innerText()).replace('Nothing was saved. What you typed is still here.', '').trim().length,
    'the failure says why, in words',
  ).toBeGreaterThan(0);
  expect(asked, 'the save was really asked for').toBeGreaterThan(0);
  await expect(form.getByLabel('Title', { exact: true }), 'the typed title is kept').toHaveValue(title);
  await expect(form.locator('[data-quick-add-save]'), 'the button is free again').toBeEnabled();
});

// --------------------------------------------------------------------------------------------- h · test users

test('h · switched to a TEST user, the bar offers Switch test user and lands on the other one directly', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const { owner, first, second, done } = await seedTestUsers();
  try {
    await page.setViewportSize(DESKTOP);
    await signIn(page, owner.email, '/my-day');
    await hydrated(page);
    await expect(page.locator('[data-test-switch-bar]'), 'no bar on the own account').toHaveCount(0);
    const started = await callAs(context, 'test_switch_start', { p_person: first.id });
    expect(started.status, JSON.stringify(started.body)).toBe(200);

    await open(page, '/my-day');
    const line = page.locator('[data-test-switch-bar] [data-test-switch-line]');
    await expect(line, 'the bar names the TEST user the device is on').toContainText(first.name);
    const menu = page.locator('[data-test-switch-bar] [data-test-switch-menu]');
    await expect(menu, 'the bar offers Switch test user').toHaveText('Switch test user');
    await expect(page.locator('[data-test-switch-back]'), 'Back to my account stays').toBeVisible();
    await menu.click();
    const list = page.locator('[data-test-switch-list]');
    await expect(
      list.locator(`[data-test-switch-to="${second.id}"]`),
      'the other TEST user is listed by name',
    ).toHaveText(second.name);
    await expect(
      list.locator(`[data-test-switch-to="${first.id}"]`),
      'the TEST user the device is on is not offered',
    ).toHaveCount(0);
    await expect(list.locator(`[data-test-switch-to="${owner.id}"]`), 'a real person is never offered').toHaveCount(0);
    await list.locator(`[data-test-switch-to="${second.id}"]`).click();
    await expect(line, 'picking another TEST user lands on that user directly').toContainText(second.name, {
      timeout: 45_000,
    });
    await expect(line, 'the first TEST user is left').not.toContainText(first.name);
    await expect(line, 'the bar still names the real person').toContainText(owner.name);
  } finally {
    await callAs(context, 'test_switch_end', {}).catch(() => undefined);
    await done();
  }
});
