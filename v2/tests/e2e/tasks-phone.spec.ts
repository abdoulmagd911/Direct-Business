/**
 * V630 on the Tasks screen, on a phone: one add action (the floating +), two tabs and one More, one Filter button that
 * holds the search and the chips and shows how many are on, the layout switch as three icons, nothing wider than the
 * screen — at 375 and at 320 px. A wide screen keeps every control in its row. The My day capture card is checked at
 * 320 too. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "tasks-header-add-stays-on-a-phone", "tasks-all-tabs-stay-on-a-phone",
 * "tasks-member-gets-the-managers-tabs", "tasks-manager-gets-the-members-tabs", "tasks-filters-stay-in-the-row-on-a-phone",
 * "tasks-filter-button-forgets-its-count", "tasks-layout-switch-keeps-its-words-on-a-phone",
 * "tasks-more-shows-on-a-wide-screen", "tasks-filter-button-shows-on-a-wide-screen", "capture-card-overflows-at-320".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tphone', 'Test tphone team', 'فريق الهاتف', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_tphone') where id = $1`,
    [person.id],
  );
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, (select team_id from core.person where id = $3),
             (select department_id from core.person where id = $3),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [
      `TSK-1997-${Math.floor(Math.random() * 90000) + 10000}`,
      `Made-up phone pass task ${person.id.slice(0, 4)}`,
      person.id,
    ],
  );
  return person;
}

/** What a rect says about a control, or null when it is not drawn. */
const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  return b && b.width > 0 && b.height > 0 ? b : null;
};

const noSidewaysScroll = async (page: Page, width: number, what: string) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    `${what}: the page does not scroll sideways`,
  ).toBeLessThanOrEqual(width);

/** The tab links drawn on the row, in order, and what sits under More. */
async function tabsAndMore(page: Page) {
  const shown = await page
    .locator('[data-tabs] a')
    .evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.textContent ?? '').trim()),
    );
  await page.locator('[data-tabs-more]').click();
  const under = await page.locator('[data-tabs-more-item]').allTextContents();
  await page.keyboard.press('Escape');
  return { shown, under: under.map((x) => x.trim()) };
}

for (const width of [375, 320]) {
  test(`phone ${width}: Tasks has one add action, two tabs and More, one Filter button and icon-only layouts (V630)`, async ({
    page,
  }) => {
    const member = await memberWithTeam();
    await page.setViewportSize({ width, height: 812 });
    await signIn(page, member.email, '/tasks');
    await hydrated(page);

    // one way to add: the floating +
    expect(await box(page, '[data-add-task]'), 'the header has no Add task on a phone').toBeNull();
    expect(await box(page, '[data-create-floating]'), 'the + is the one add action').not.toBeNull();

    // two tabs and the one More
    const tabs = await tabsAndMore(page);
    expect(tabs.shown, 'a member sees My work and Owned').toEqual(['My work', 'Owned']);
    expect(tabs.under, 'Helping, Team and Past work sit under More').toEqual(['Helping', 'Team', 'Past work']);
    const row = await page.locator('[data-tabs]').boundingBox();
    expect(row!.width, 'the tab row fits the screen').toBeLessThanOrEqual(width);

    // the search and the chips are behind one Filter button
    const toggle = await box(page, '[data-filter-toggle]');
    expect(toggle, 'the Filter button is there').not.toBeNull();
    expect(toggle!.height, 'and 44 px tall').toBeGreaterThanOrEqual(43.5);
    expect(await box(page, 'input[type="search"]'), 'the search is folded behind Filter').toBeNull();
    expect(await box(page, '[data-task-chips] [aria-label^="Add filter"]'), 'so are the chips').toBeNull();
    await expect(page.locator('[data-filter-count]'), 'no filter on: no count').toHaveCount(0);
    await page.locator('[data-filter-toggle]').click();
    expect(await box(page, 'input[type="search"]'), 'Filter opens the search').not.toBeNull();
    await page.getByRole('button', { name: 'Add filter: Status' }).click();
    await page.getByRole('menuitem', { name: 'Open' }).click();
    await expect(page).toHaveURL(/status=open/);
    await expect(page.locator('[data-filter-count]'), 'Filter shows how many are on').toHaveText('1');

    // List / Board / Calendar: three icons, each a finger wide, each still named
    const links = page.locator('[data-layouts] a');
    await expect(links).toHaveCount(3);
    for (const name of ['List', 'Board', 'Calendar']) {
      const l = page.getByRole('link', { name, exact: true });
      const b = (await l.boundingBox())!;
      expect(b.width, `${name}: 44 px wide`).toBeGreaterThanOrEqual(43.5);
      expect(b.height, `${name}: 44 px tall`).toBeGreaterThanOrEqual(43.5);
      const word = await l.locator('span').boundingBox();
      expect(word!.width, `${name}: the layout switch is icons on a phone`).toBeLessThanOrEqual(1.5);
    }
    await noSidewaysScroll(page, width, 'Tasks');

    // a tab under More leads where it says, and More shows it is the one on
    await page.locator('[data-tabs-more]').click();
    await page.locator('[data-tabs-more-item="past"]').click();
    await expect(page).toHaveURL(/view=past/);
    await expect(page.locator('[data-tabs-more]'), 'More is lit while a tab under it is open').toHaveAttribute(
      'aria-current',
      'true',
    );
  });
}

test('phone 375: someone who gives work sees My work and Team, with Owned, Helping and Past work under More (V630)', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true }); // tasks.assign
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, admin.email, '/tasks');
  await hydrated(page);
  const tabs = await tabsAndMore(page);
  expect(tabs.shown, 'a manager sees My work and Team').toEqual(['My work', 'Team']);
  expect(tabs.under, 'Owned, Helping and Past work sit under More').toEqual(['Owned', 'Helping', 'Past work']);
});

test('desk 1440: Tasks keeps every control in its row — Add task, five tabs, the search and chips, worded layouts (V630)', async ({
  page,
}) => {
  const member = await memberWithTeam();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, member.email, '/tasks');
  await hydrated(page);
  expect(await box(page, '[data-add-task]'), 'Add task is in the header').not.toBeNull();
  const shown = await page
    .locator('[data-tabs] a')
    .evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.textContent ?? '').trim()),
    );
  expect(shown, 'all five tabs show').toEqual(['My work', 'Owned', 'Helping', 'Team', 'Past work']);
  expect(await box(page, '[data-tabs-more]'), 'no More on a wide screen').toBeNull();
  expect(await box(page, '[data-filter-toggle]'), 'no Filter button on a wide screen').toBeNull();
  expect(await box(page, 'input[type="search"]'), 'the search is in the row').not.toBeNull();
  expect(await box(page, '[data-task-chips] [aria-label^="Add filter"]'), 'and so are the chips').not.toBeNull();
  const word = await page.locator('[data-layouts] a span').first().boundingBox();
  expect(word!.width, 'the layout switch keeps its words').toBeGreaterThan(10);
});

test('phone 320: the My day capture button and its sheet sit inside the screen, every control a finger high (V630)', async ({
  page,
}) => {
  const member = await memberWithTeam();
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const button = (await page.locator('[data-capture-open]').boundingBox())!;
  expect(button.x + button.width, 'the capture button ends inside a 320 px screen').toBeLessThanOrEqual(320);
  expect(button.height, 'the capture button is 44 px tall').toBeGreaterThanOrEqual(43.5);
  await page.locator('[data-capture-open]').click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
  for (const selector of [
    '[data-quick-capture]',
    '[data-quick-kind="note"]',
    '[data-quick-kind="reminder"]',
    '[data-quick-visibility="workspace"]',
    '[data-quick-text]',
    '[data-quick-save]',
  ]) {
    const b = (await page.locator(selector).boundingBox())!;
    expect(b.x + b.width, `${selector} ends inside a 320 px screen`).toBeLessThanOrEqual(320);
    expect(b.x, `${selector} starts inside it`).toBeGreaterThanOrEqual(0);
    if (selector !== '[data-quick-capture]' && selector !== '[data-quick-text]')
      expect(b.height, `${selector} is 44 px tall`).toBeGreaterThanOrEqual(43.5);
  }
  await page.keyboard.press('Escape');
  await noSidewaysScroll(page, 320, 'My day');
});
