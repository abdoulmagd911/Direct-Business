/**
 * The pilot fixes from the 7 Oct test rounds (QA lists on #87; GC-1 the employee view, GC-3 the phone): every browser
 * tab is titled with its page (QA-219); at 390 px a long title in a record header wraps to two lines, the way back, the
 * My day tabs and Past work's header switch are 24 px or more, Past work's preview fits the width with the Title
 * keeping the spare, and Past work has no List / Board / Calendar switch. (QA-245, the + without Task for someone in
 * no team, is the unit test beside it.) Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "tab-title-is-lost", "record-title-is-cut-short", "breadcrumb-link-is-short",
 * "header-breadcrumb-link-is-short", "tab-is-narrow", "past-work-header-switch-is-small",
 * "past-work-keeps-empty-columns-on-a-phone", "past-work-has-the-layout-switch".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const PHONE = { width: 390, height: 844 };

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A made-up member in a team (a task's team is its owner's, V194): Tasks, Past work and Add task all open for them. */
async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_pilot', 'Test pilot team', 'فريق تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_pilot') where id = $1`,
    [person.id],
  );
  return person;
}

test('every page names its tab: "Tasks · Commercial" (QA-219)', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/tasks');
  await hydrated(page);
  for (const [path, title] of [
    ['/tasks', 'Tasks · Commercial'],
    ['/clients', 'Clients · Commercial'],
    ['/my-day', 'My day · Commercial'],
    ['/kpis/achievements', 'Achievements · Commercial'],
    ['/activity', 'Activity · Commercial'],
    ['/settings/org', 'People & access · Commercial'],
  ] as const) {
    await page.goto(path);
    await hydrated(page);
    expect(await page.title(), `${path} is titled with its page`).toBe(title);
  }
});

test('phone: a long title wraps to two lines, and the way back is 24 px or more (QA 7 Oct, items 1 and 2)', async ({
  page,
}) => {
  const member = await memberWithTeam();
  await page.setViewportSize(PHONE);
  await signIn(page, member.email, '/clients');
  await hydrated(page);
  const name = `Test Org Phone Wrap ${Math.random().toString(36).slice(2, 6)}`;
  const created = await callAs(page.context(), 'partner_create', {
    p_partner: {
      trade_name_en: name,
      sides: [{ side: 'client', type: 'corporate' }],
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  await page.goto(`/clients/${(created.body as { id: string }).id}`);
  await hydrated(page);
  const title = await page.locator('[data-record-title]').evaluate((h) => {
    const cs = getComputedStyle(h);
    return { h: h.clientHeight, scroll: h.scrollHeight, line: parseFloat(cs.lineHeight), text: h.textContent };
  });
  expect(title.text).toBe(name);
  expect(title.scroll, 'nothing of the title is cut off').toBeLessThanOrEqual(title.h + 1);
  expect(title.h, 'the title wraps to a second line').toBeGreaterThanOrEqual(title.line * 1.5);
  expect(title.h, 'and to no more than two').toBeLessThanOrEqual(title.line * 2.2);
  const crumbs = await page
    .locator('[data-record-header] nav[aria-label="Breadcrumb"] a')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(crumbs.length, 'the record has its way back').toBeGreaterThan(0);
  for (const h of crumbs) expect(h, 'a breadcrumb link is 24 px or taller').toBeGreaterThanOrEqual(24);
  // the KPI pages' header breadcrumb is the same rule
  await page.goto('/kpis/achievements/new');
  await hydrated(page);
  const kpiCrumbs = await page
    .locator('nav[aria-label="Breadcrumb"] a')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(kpiCrumbs.length, 'the KPI page has its way back').toBeGreaterThan(0);
  for (const h of kpiCrumbs) expect(h, 'a header breadcrumb link is 24 px or taller').toBeGreaterThanOrEqual(24);
});

test('phone: My day\'s "Me" tab is 24 px wide or more (QA 7 Oct, item 3)', async ({ page }) => {
  const member = await memberWithTeam();
  await page.setViewportSize(PHONE);
  await signIn(page, member.email, '/my-day');
  await hydrated(page);
  const me = await page.locator('[data-tabs] a').first().boundingBox();
  expect(me, 'the first tab is "Me"').not.toBeNull();
  expect(me!.width, 'the Me tab is 24 px wide or more').toBeGreaterThanOrEqual(24);
  expect(me!.height).toBeGreaterThanOrEqual(24);
});

test('phone: Past work has no layout switch, a 24 px header switch and a Title column with the spare width', async ({
  page,
}) => {
  const member = await memberWithTeam();
  await page.setViewportSize(PHONE);
  await signIn(page, member.email, '/tasks');
  await hydrated(page);
  await expect(page.locator('[data-layouts]'), 'the List view has its layout switch').toHaveCount(1);
  await page.goto('/tasks?view=past');
  await hydrated(page);
  await expect(page.locator('[data-layouts]'), 'Past work has no List / Board / Calendar switch').toHaveCount(0);
  const grid = page.locator('[data-past-work-grid="tasks"]');
  await grid.getByLabel('Source report').click();
  await page.getByRole('option', { name: 'Commercial quarterly' }).click();
  await grid.getByLabel('Which report').click();
  await page.getByRole('option', { name: 'Q3 2026' }).click();
  const rows = Array.from({ length: 5 }, (_, i) =>
    [`Made-up past title number ${i + 1} for a phone`, `1${3 + i}/07/2026`, 'Done'].join('\t'),
  );
  await grid.locator('[data-past-work-paste]').fill(['Title\tDate\tStatus', ...rows].join('\n'));
  await expect(grid.locator('[data-past-work-summary]')).toContainText('5 rows ready');
  const box = await grid.getByRole('checkbox', { name: 'The first row holds the headers' }).boundingBox();
  expect(box!.width, 'the header switch is 24 px wide or more').toBeGreaterThanOrEqual(24);
  expect(box!.height, 'and 24 px tall or more').toBeGreaterThanOrEqual(24);
  const columns = await grid
    .locator('table[data-past-work-preview] thead th')
    .evaluateAll((els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ name: (e as HTMLElement).innerText || '·', width: e.getBoundingClientRect().width })),
    );
  const widths = columns.map((c) => c.width);
  const shown = columns.map((c) => `${c.name} ${Math.round(c.width)}`).join(', ');
  const titleWidth = (await grid.locator('th[data-column="title"]').boundingBox())!.width;
  expect(titleWidth, `the Title column gets the spare width (columns: ${shown})`).toBeGreaterThanOrEqual(
    Math.max(...widths),
  );
  expect(titleWidth, 'and not less than 100 px').toBeGreaterThanOrEqual(100);
  const fit = await grid
    .locator('table[data-past-work-preview]')
    .evaluate((t) => ({ box: t.parentElement!.clientWidth, table: t.scrollWidth }));
  expect(
    fit.table,
    `the pasted rows fit the width: the preview does not scroll sideways (columns: ${shown})`,
  ).toBeLessThanOrEqual(fit.box + 1);
  const cell = await grid.locator('table[data-past-work-preview] tbody tr').first().locator('td').nth(1).boundingBox();
  expect(cell!.height, 'a pasted title wraps to a few lines, not one word each').toBeLessThanOrEqual(90);
});
