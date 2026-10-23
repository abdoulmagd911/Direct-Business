/**
 * The employee view (V217; the Design lead's brief `docs/v2/briefs/employee-view.md`, section F): the menu follows the
 * work/manage rule per role, the phone bar is the menu's first four and More, Suppliers is the second tab of Clients,
 * Create offers only built screens at the right level, the chip holds My profile and Sign out, My profile has five
 * cards, a person's Access is one line, the words are the new ones, and a phone at 390 px never scrolls sideways.
 * Each test runs at 390 × 844 and 1440 × 900 where the brief asks for both. The access is the one the oversight sets
 * after merge (brief E), made by tests/e2e/support/employee-view-access.ts before the specs. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "access-list-closed-for-admins"; tests/sabotage/nav-access.mjs "menu-shows-work-pages-only-on-screen".
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

type Persona = 'member' | 'bd_member' | 'manager' | 'head' | 'admin' | 'viewer';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A made-up person in the persona's role; a BD member is a member with Pipeline Own by a person change (brief E). */
async function personAs(persona: Persona): Promise<TestPerson> {
  const person = await makePerson({ admin: persona === 'admin' });
  if (persona === 'manager' || persona === 'head' || persona === 'viewer')
    await sql(`update core.person set role_id = (select id from core.role where key = $2) where id = $1`, [
      person.id,
      persona,
    ]);
  if (persona === 'bd_member')
    await sql(
      `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
       values ($1, 'pipeline', 'own', 'Made up: BD/BS team, ruling 30 Sep', $1)`,
      [person.id],
    );
  return person;
}

async function openAs(page: Page, persona: Persona, path = '/my-day', size = DESKTOP) {
  const person = await personAs(persona);
  await page.setViewportSize(size);
  await signIn(page, person.email, path);
  await hydrated(page);
  return person;
}

const drawerLabels = async (page: Page) =>
  (await page.locator('[data-drawer] a[href]:not([data-entity])').allInnerTexts()).map((l) => l.trim()).filter(Boolean);

const barLabels = async (page: Page) =>
  (await page.locator('[data-bottom-bar] a, [data-bottom-bar] button').allInnerTexts()).map((l) => l.trim());

/** The pages More lists (Sign out aside; My profile is only in the avatar menu, daily use 10). */
const morePages = async (page: Page) => {
  await page.locator('[data-bottom-more]').click();
  const sheet = page.locator('[data-more-sheet]');
  await expect(sheet).toBeVisible();
  const pages = (await sheet.locator('a[href]').allInnerTexts()).map((l) => l.trim());
  await expect(sheet.locator('a[href="/profile"]'), 'More does not repeat My profile').toHaveCount(0);
  await expect(sheet.locator('[data-more-sign-out]'), 'More signs out').toHaveText('Sign out');
  await page.keyboard.press('Escape');
  return pages;
};

async function organisation(context: BrowserContext, name: string, sides: string[], phone?: string) {
  const r = await callAs(context, 'partner_create', {
    p_partner: {
      trade_name_en: name,
      sides: sides.map((side) => ({ side, type: side === 'client' ? 'corporate' : 'supplier' })),
    },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  const id = (r.body as { id: string }).id;
  if (phone) {
    const c = await callAs(context, 'contact_save', {
      p_partner: id,
      p_id: null,
      p_values: { name_en: `Test Contact ${name}`, phone, is_primary: true, sides: ['client'] },
    });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
  }
  return id;
}

const tag = () => Math.random().toString(36).slice(2, 8);

// ── Menu and bar ─────────────────────────────────────────────────────────────────────────────────────────────────

// QA3-002: a page whose screen is not built (Overview, Pipeline, Projects, Reports, Appraisal) is in no menu, no bar,
// no More and not in Ctrl K, for any role; its address still answers. Sabotage: nav-access.mjs "menu-shows-unbuilt-pages-on-screen".
const UNBUILT = ['Overview', 'Pipeline', 'Projects', 'Reports', 'Appraisal'];

test('1 · a member: the drawer is every built page their access opens (V238, QA3-002); the phone bar is the first four and More', async ({
  page,
}) => {
  await openAs(page, 'member');
  expect(await drawerLabels(page), 'the member menu').toEqual([
    'My day',
    'Tasks',
    'Clients',
    'Finance',
    'Achievements',
  ]);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Finance', 'More', 'Create']);
  expect(await morePages(page), 'More holds the rest of the same list').toEqual(['Achievements']);
});

test('2 · a Business Development member (Pipeline Own by a person change) gets no Pipeline entry while Pipeline is not built', async ({
  page,
}) => {
  await openAs(page, 'bd_member');
  expect(await drawerLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Finance', 'Achievements']);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Finance', 'More', 'Create']);
  expect(await morePages(page)).toEqual(['Achievements']);
});

test('3 · a manager: every built page their access opens, in order (Activity at View); the bar is the first four and More', async ({
  page,
}) => {
  await openAs(page, 'manager');
  expect(await drawerLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Finance', 'Achievements', 'Activity']);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Finance', 'More', 'Create']);
  expect(await morePages(page)).toEqual(['Achievements', 'Activity']);
});

test('4 · a head has Activity; an admin adds Settings at the foot and in More', async ({ page, browser }) => {
  await openAs(page, 'head');
  const head = ['My day', 'Tasks', 'Clients', 'Finance', 'Achievements', 'Activity'];
  expect(await drawerLabels(page)).toEqual(head);
  await expect(page.locator('[data-drawer]').getByRole('link', { name: 'Settings' })).toHaveCount(0);

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await openAs(admin, 'admin');
  expect(await drawerLabels(admin)).toEqual([...head, 'Settings']);
  const settings = admin.locator('[data-drawer]').getByRole('link', { name: 'Settings' });
  const last = admin.locator('[data-drawer] a[href]:not([data-entity])').last();
  await expect(last, 'Settings sits at the foot').toHaveText('Settings');
  expect((await settings.boundingBox())!.y).toBeGreaterThan(
    (await admin.locator('[data-drawer]').getByRole('link', { name: 'Activity' }).boundingBox())!.y + 40,
  );
  await admin.setViewportSize(PHONE);
  expect(await morePages(admin)).toEqual(['Achievements', 'Activity', 'Settings']);
  await ctx.close();
});

test('5 · a viewer: the built pages their access opens fill the bar, with no More; Create offers Capture and nothing else (V242)', async ({
  page,
}) => {
  await openAs(page, 'viewer');
  expect(await drawerLabels(page)).toEqual(['My day', 'Clients', 'Finance', 'Achievements']);
  // Capture is for anyone who can open My day, view-only included; Create's other items stay hidden
  await expect(page.locator('[data-create]')).toHaveAttribute('data-create-direct', 'capture');
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Clients', 'Finance', 'Achievements', 'Create']);
  await expect(page.locator('[data-bottom-more]'), 'four fill the bar: no More').toHaveCount(0);
  await expect(page.locator('[data-create-bar]')).toHaveAttribute('data-create-direct', 'capture');
});

test('6 · a member opens KPIs and Finance from the menu; Reports answers by address but is in no menu and not in Ctrl K', async ({
  page,
}) => {
  await openAs(page, 'member');
  for (const [route, heading, title] of [
    ['/kpis', 'Achievements', 'Achievements'], // the menu says Achievements (daily use 8); /kpis opens the list
    ['/finance', 'Finance', 'Finance'],
  ] as const) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]'), `${route} opens at the member's level`).toHaveCount(0);
    await expect(
      page.locator('[data-drawer]').getByRole('link', { name: title }),
      `${title} is in the menu: the member's access opens it`,
    ).toHaveCount(1);
  }
  // a page not built yet: its address still answers (for QA), and it is in no menu
  await page.goto('/reports');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
  for (const name of UNBUILT)
    await expect(page.locator('[data-drawer]').getByRole('link', { name }), `${name} is not built`).toHaveCount(0);
  await page.goto('/my-day');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await palette.getByPlaceholder('Go to a page or search…').fill('Reports');
  await expect(
    palette.getByRole('option', { name: 'Reports', exact: true }),
    'Ctrl K offers no unbuilt page',
  ).toHaveCount(0);
  await palette.getByPlaceholder('Go to a page or search…').fill('Achievements');
  await palette.getByRole('option', { name: 'Achievements', exact: true }).click();
  await expect(page).toHaveURL(/\/kpis(\/achievements)?$/);
});

test('7 · an admin sees no unbuilt page in the drawer, the phone bar, More or Ctrl K (QA3-002)', async ({ page }) => {
  await openAs(page, 'admin');
  const wide = await drawerLabels(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  const offered: string[] = [];
  for (const name of UNBUILT) {
    await palette.getByPlaceholder('Go to a page or search…').fill(name);
    offered.push(...(await palette.getByRole('option', { name, exact: true }).allInnerTexts()));
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize(PHONE);
  const phone = [...(await barLabels(page)), ...(await morePages(page))];
  expect([...wide, ...phone, ...offered].filter((l) => UNBUILT.includes(l))).toEqual([]);
});

// ── Suppliers tab ────────────────────────────────────────────────────────────────────────────────────────────────

test('8 · Clients carries the tab row Clients · Suppliers with counts; the old address lands on Suppliers; no tab row without Suppliers', async ({
  page,
  browser,
}) => {
  const admin = await openAs(page, 'admin', '/my-day');
  void admin;
  const t = tag();
  await organisation(page.context(), `Test Supplier ${t}`, ['supplier_partner']);
  for (const size of [DESKTOP, PHONE]) {
    await page.setViewportSize(size);
    await page.goto('/clients');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
    const tabs = page.locator('[data-side-tabs] a');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText(/^Clients\s*\d+$/);
    await expect(tabs.nth(1)).toHaveText(/^Suppliers\s*\d+$/);
    await expect(tabs.nth(0)).toHaveAttribute('aria-current', 'page');
    if (size === PHONE) {
      // two equal tabs across the width, 44 px tall
      const [a, b] = [(await tabs.nth(0).boundingBox())!, (await tabs.nth(1).boundingBox())!];
      expect(a.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(a.width - b.width)).toBeLessThan(2);
    }
  }
  await page.setViewportSize(DESKTOP);
  await page.goto('/partners?view=suppliers');
  await hydrated(page);
  await expect(page).toHaveURL(/\/suppliers$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Suppliers' }),
    'the title is the page on screen',
  ).toBeVisible();
  await expect(page.locator('[data-side-tab="supplier_partner"]')).toHaveAttribute('aria-current', 'page');
  await page.goto(`/suppliers?q=${encodeURIComponent(`Test Supplier ${t}`)}`);
  await hydrated(page);
  await expect(page.getByText(`Test Supplier ${t}`).first(), 'Suppliers lists the supplier side').toBeVisible();

  // a person with Suppliers at none sees Clients alone, with no tab row
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  const member = await personAs('member');
  await sql(
    `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
     values ($1, 'suppliers_partners', 'none', 'Made up: no suppliers', $1)`,
    [member.id],
  );
  await other.setViewportSize(DESKTOP);
  await signIn(other, member.email, '/clients');
  await hydrated(other);
  await expect(other.getByRole('heading', { level: 1, name: 'Clients' })).toBeVisible();
  await expect(other.locator('[data-side-tabs]')).toHaveCount(0);
  await ctx.close();
});

// ── Create ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('9 · Create offers only built screens at Full, and a member with read-only lists gets Capture and Task, never Partner', async ({
  page,
  browser,
}) => {
  // a manager: Task, Client, Supplier, Invoice and Achievement (Tasks, Finance and KPIs are built, QA-556) are at Full
  await openAs(page, 'manager');
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem')).toHaveText([
    'Capture',
    'Task',
    'Log activity',
    'Client',
    'Supplier',
    'Invoice',
    'Achievement',
  ]);
  await expect(page.getByRole('menu')).not.toContainText('Partner');
  await page.keyboard.press('Escape');

  // one item left (a member whose Clients, Suppliers, KPIs and My day are View): Create and the + open it directly, no menu
  const ctx = await browser.newContext();
  const one = await ctx.newPage();
  const member = await personAs('member');
  // in a team: someone in no team without tasks.assign is not offered Task in the + (QA-245)
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_create', 'Test create team', 'فريق تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [member.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_create') where id = $1`,
    [member.id],
  );
  await sql(
    `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
     values ($1, 'clients', 'view', 'Made up: clients read only', $1),
            ($1, 'suppliers_partners', 'view', 'Made up: suppliers read only', $1),
            ($1, 'kpis', 'view', 'Made up: achievements read only (a member at Own may log one, V605)', $1)`,
    [member.id],
  );
  await one.setViewportSize(DESKTOP);
  await signIn(one, member.email, '/my-day');
  await hydrated(one);
  // Clients, Suppliers and KPIs are read only, so Create keeps Capture (open to anyone who can open My day) and Task
  await one.locator('[data-create]').click();
  await expect(one.getByRole('menuitem')).toHaveText(['Capture', 'Task']);
  await one.locator('[data-create-item="task"]').click();
  await expect(one, 'the Tasks page draws itself with quick add, no redirect (V286)').toHaveURL(/\/tasks\/new$/);
  await expect(one.locator('[data-quick-add]'), 'quick add is open on arrival').toBeVisible();
  await one.keyboard.press('Escape');
  await one.setViewportSize(PHONE);
  await one.goto('/my-day');
  await hydrated(one);
  await one.locator('[data-create-bar]').click();
  await expect(one.getByRole('menuitem')).toHaveText(['Capture', 'Task']);
  await ctx.close();
});

// ── Header, profile, record ──────────────────────────────────────────────────────────────────────────────────────

test('10 · the search says "Search" on a phone and names what it finds from 640 px; Ctrl K shows from 1024 px', async ({
  page,
}) => {
  await openAs(page, 'member', '/my-day', PHONE);
  const search = page.locator('[data-search]');
  // what is drawn, not the words kept for the other width
  expect(await search.innerText()).toBe('Search');
  await expect(search.locator('kbd')).toBeHidden();
  await page.setViewportSize(DESKTOP);
  await expect.poll(() => search.innerText()).toMatch(/^Search clients, tasks, invoices\s*Ctrl K$/);
  await expect(search.locator('kbd')).toBeVisible();
  await expect(search.locator('kbd')).toHaveText('Ctrl K');
});

test('11 · the avatar menu holds exactly My profile and Sign out', async ({ page }) => {
  await openAs(page, 'admin');
  await page.locator('[data-profile-chip]').click();
  await expect(page.getByRole('menuitem')).toHaveText(['My profile', 'Sign out']);
});

test("12 · a member's My profile: five cards, seven notification switches, none of the cut fields; a manager's twenty-two", async ({
  page,
  browser,
}) => {
  await openAs(page, 'member', '/profile');
  await expect(page.locator('[data-profile-card]')).toHaveCount(5);
  const cards = await page
    .locator('[data-profile-card]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-profile-card')));
  expect(cards).toEqual(['profile', 'preferences', 'notifications', 'password', 'devices']);
  await expect(page.locator('[data-profile-card="notifications"] [role="switch"]')).toHaveCount(7);
  for (const gone of ['Nickname', 'Badge', 'Start page', 'Drawer', 'Full name', 'Colour'])
    await expect(page.getByLabel(gone, { exact: true }), `${gone} is not on My profile`).toHaveCount(0);
  // the owner's ruling of 14 Oct (V636): a member picks a theme of their own, so the Theme box is there
  await expect(page.getByLabel('Theme', { exact: true }), 'Theme is on My profile').toHaveCount(1);

  const ctx = await browser.newContext();
  const manager = await ctx.newPage();
  await openAs(manager, 'manager', '/profile');
  // V217's eighteen, P5-1's escalated, alert_project_no_update and alert_due_tomorrow (V199), and P4-2's alert_quiet_client (V401)
  await expect(manager.locator('[data-profile-card="notifications"] [role="switch"]')).toHaveCount(22);
  await ctx.close();
});

test("13 · a person's Access is never the full list for a manager, and open with Show less for an admin", async ({
  page,
  browser,
}) => {
  const someone = await personAs('member');
  const manager = await personAs('manager');
  await page.setViewportSize(DESKTOP);
  await signIn(page, manager.email, `/people/${someone.id}`);
  await hydrated(page);
  // never the full list for a manager. The database serves a person's role and levels to People & access alone
  // (api.people, core.access_of_person), so a manager's rail has no Access line yet — it names the role with Show all
  // once builder A opens those reads to managers (NEED in V217)
  await expect(page.locator('[data-access-group]')).toHaveCount(0);
  await expect(page.locator('[data-record-rail]')).toContainText('Details');

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await openAs(admin, 'admin', `/people/${someone.id}`);
  await expect(admin.locator('[data-access-line]')).toHaveText('Member (standard)');
  await expect(admin.locator('[data-access-group="pages"]'), 'open for an admin').toBeVisible();
  await expect(admin.locator('[data-access-all]')).toHaveText('Show less');
  await ctx.close();
});

// ── Words and layout ─────────────────────────────────────────────────────────────────────────────────────────────

test('14 · no title, tab, crumb or menu item says Organization, Suppliers & partners, Plan & performance, Head of department or Team member', async ({
  page,
}) => {
  await openAs(page, 'admin');
  const banned =
    /Organization|Suppliers & partners|Supplier & partner|Plan & performance|Head of department|Team member/;
  for (const route of [
    '/my-day',
    '/clients',
    '/suppliers',
    '/pipeline',
    '/overview',
    '/kpis',
    '/activity',
    '/profile',
    '/settings',
    '/settings/org',
    '/settings/org?tab=teams',
    '/settings/org?tab=access',
    '/settings/partners',
    '/settings/performance',
  ]) {
    await page.goto(route);
    await hydrated(page);
    const words = await page
      .locator('h1, h2, h3, nav, [role="tab"], [role="tablist"], [aria-label="Breadcrumb"], [data-crumbs]')
      .allInnerTexts();
    const hit = words.find((w) => banned.test(w));
    expect(hit, `${route} says: ${hit}`).toBeUndefined();
  }
  // the three tabs of People & access, and the two sections the old tabs moved into
  await page.goto('/settings/org');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('People & access');
  await expect(page.locator('main [data-tabs] a')).toHaveText([/^People/, /^Teams/, /^Access/]);
  await page.goto('/settings/org?tab=roles');
  await hydrated(page);
  await expect(page.locator('[data-access-section="roles"]')).toBeVisible();
  await expect(page.locator('[data-access-section="sign-in"]')).toBeVisible();
});

test('15 · at 390 px every page of the member menu fits: no sideways scroll, 44 px targets, the + clear of the last row', async ({
  page,
}) => {
  const member = await openAs(page, 'member', '/my-day', PHONE);
  void member;
  const id = await organisation(page.context(), `Test Phone Org ${tag()}`, ['client'], '+966 50 000 0000');
  for (const route of ['/my-day', '/tasks', '/clients', `/clients/${id}`, '/profile']) {
    await page.goto(route);
    await hydrated(page);
    const fit = await page.evaluate(() => {
      const main = document.querySelector('#main [class*="overflow-y-auto"]') as HTMLElement | null;
      return {
        page: document.documentElement.scrollWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
        padding: main ? parseFloat(getComputedStyle(main).paddingBottom) : 0,
      };
    });
    expect(fit.page, `${route}: no sideways scroll`).toBeLessThanOrEqual(390);
    expect(fit.main, `${route}: nothing wider than the screen`).toBeLessThanOrEqual(0);
    expect(fit.padding, `${route}: room under the last row for the +`).toBeGreaterThanOrEqual(88);
    const small = await page
      .locator(
        '[data-bottom-bar] a, [data-bottom-bar] button, [data-topbar] button, [data-topbar] a, [data-create-bar], [data-side-tabs] a, [data-contact-phone]',
      )
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent !== null)
          .map((e) => ({
            what: e.getAttribute('aria-label') || (e as HTMLElement).innerText,
            h: e.getBoundingClientRect().height,
          }))
          .filter((x) => x.h < 44),
      );
    expect(small, `${route}: every tap target is 44 px or more`).toEqual([]);
  }
});

test('16 · the three phone jobs from My day (a smoke — the people test is the gate)', async ({ page }) => {
  await openAs(page, 'member', '/my-day', PHONE);
  const name = `Test Job Org ${tag()}`;
  const id = await organisation(page.context(), name, ['client'], '+966 50 000 0001');
  let taps = 0;
  const tap = async (locator: ReturnType<Page['locator']>) => {
    taps += 1;
    await locator.click();
  };

  // Job 1 — log what happened with a client today, with the next step: ≤ 4 taps to the client, ≤ 60 s to save
  const started = Date.now();
  await tap(page.locator('[data-bottom-bar]').getByRole('link', { name: 'Clients' }));
  await hydrated(page);
  await tap(page.locator('[data-filter-toggle]')); // the search sits behind the one Filter button on a phone (V630)
  await page.getByPlaceholder('Search by name or number').fill(name);
  await page.keyboard.press('Enter');
  await tap(page.locator(`[data-partner-link="${id}"]`).first());
  await expect(page).toHaveURL(new RegExp(`/clients/${id}`));
  expect(taps, 'taps to the client').toBeLessThanOrEqual(4);
  await hydrated(page);
  await tap(page.locator('[data-activity-log]').first());
  const form = page.locator('[data-activity-form]');
  await form.getByLabel('Type').click();
  await page.getByRole('option', { name: 'Call' }).click();
  await form.getByLabel('Outcome').click();
  await page.getByRole('option', { name: 'Answered' }).click();
  await form.getByLabel('What happened').fill('Made-up call');
  await form.getByLabel('Next step', { exact: true }).fill('Send the made-up offer');
  await form.getByLabel('Next step on').fill('2030-01-15');
  await tap(page.locator('[data-activity-save]'));
  await expect(page.locator('[data-sonner-toast]', { hasText: 'Call logged' })).toBeVisible();
  expect(Date.now() - started, 'saved within 60 s').toBeLessThan(60_000);

  // Job 2 — what is due today, one ticked off: Tasks is built (P5-2, #147) and opens from the bottom bar; the
  // tick-off itself is tests/e2e/tasks.spec.ts "phone: see what is due today and tick one off (V509)"
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-bottom-bar]').getByRole('link', { name: 'Tasks' }).click();
  await expect(page.locator('[data-tasks-list]')).toBeVisible();

  // Job 3 — find a client and call their contact: search → client → the phone link, ≤ 30 s
  await page.goto('/my-day');
  await hydrated(page);
  const third = Date.now();
  await page.locator('[data-search]').click();
  await page.locator('[data-command-palette]').getByPlaceholder('Go to a page or search…').fill(name);
  await page.locator(`[data-palette-partner="${id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${id}`));
  const phone = page.locator('[data-contact-phone]').first();
  await expect(phone).toHaveAttribute('href', 'tel:+966500000001');
  expect(Date.now() - third, 'the phone link within 30 s').toBeLessThan(30_000);
});
