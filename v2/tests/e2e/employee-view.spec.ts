/**
 * The employee view (V217; the Design lead's brief `docs/v2/briefs/employee-view.md`, section F): the menu follows the
 * work/manage rule per role, the phone bar is the menu's first four and More, Suppliers is the second tab of Clients,
 * Create offers only built screens at the right level, the chip holds My profile and Sign out, My profile has five
 * cards, a person's Access is one line, the words are the new ones, and a phone at 390 px never scrolls sideways.
 * Each test runs at 390 × 844 and 1440 × 900 where the brief asks for both. The access is the one the oversight sets
 * after merge (brief E), made by tests/e2e/support/employee-view-access.ts before the specs. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "menu-shows-own-manage-page", "create-offers-an-unbuilt-screen",
 * "access-list-closed-for-admins".
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

/** The pages More lists (its profile link and Sign out aside). */
const morePages = async (page: Page) => {
  await page.locator('[data-bottom-more]').click();
  const sheet = page.locator('[data-more-sheet]');
  await expect(sheet).toBeVisible();
  const pages = (await sheet.locator('a[href]:not([data-entity])').allInnerTexts()).map((l) => l.trim());
  await expect(sheet.locator('a[data-entity="person"]'), 'More leads to My profile').toBeVisible();
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

test('1 · a member: the drawer is My day, Tasks, Clients; the phone bar adds More, which holds My profile and Sign out only', async ({
  page,
}) => {
  await openAs(page, 'member');
  expect(await drawerLabels(page), 'the member menu').toEqual(['My day', 'Tasks', 'Clients']);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'More']);
  expect(await morePages(page), 'More holds no page for a member').toEqual([]);
});

test('2 · a Business Development member (Pipeline Own by a person change) gains Pipeline; More is unchanged', async ({
  page,
}) => {
  await openAs(page, 'bd_member');
  expect(await drawerLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Pipeline']);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Pipeline', 'More']);
  expect(await morePages(page)).toEqual([]);
});

test('3 · a manager: the nine of the brief in order; the bar is the first four and More', async ({ page }) => {
  await openAs(page, 'manager');
  expect(await drawerLabels(page)).toEqual([
    'My day',
    'Tasks',
    'Clients',
    'Pipeline',
    'Projects',
    'Finance',
    'KPIs',
    'Reports',
    'Appraisal',
  ]);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Tasks', 'Clients', 'Pipeline', 'More']);
  expect(await morePages(page)).toEqual(['Projects', 'Finance', 'KPIs', 'Reports', 'Appraisal']);
});

test('4 · a head adds Overview and Activity; an admin adds Settings at the foot and in More', async ({
  page,
  browser,
}) => {
  await openAs(page, 'head');
  const head = ['My day', 'Tasks', 'Clients', 'Pipeline', 'Overview', 'Projects', 'Finance', 'KPIs', 'Reports'];
  expect(await drawerLabels(page)).toEqual([...head, 'Appraisal', 'Activity']);
  await expect(page.locator('[data-drawer]').getByRole('link', { name: 'Settings' })).toHaveCount(0);

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await openAs(admin, 'admin');
  expect(await drawerLabels(admin)).toEqual([...head, 'Appraisal', 'Activity', 'Settings']);
  const settings = admin.locator('[data-drawer]').getByRole('link', { name: 'Settings' });
  const last = admin.locator('[data-drawer] a[href]:not([data-entity])').last();
  await expect(last, 'Settings sits at the foot').toHaveText('Settings');
  expect((await settings.boundingBox())!.y).toBeGreaterThan(
    (await admin.locator('[data-drawer]').getByRole('link', { name: 'Activity' }).boundingBox())!.y + 40,
  );
  await admin.setViewportSize(PHONE);
  expect(await morePages(admin)).toEqual([
    'Overview',
    'Projects',
    'Finance',
    'KPIs',
    'Reports',
    'Appraisal',
    'Activity',
    'Settings',
  ]);
  await ctx.close();
});

test('5 · a viewer: My day, Clients, KPIs, Reports; no Create or + anywhere; no More', async ({ page }) => {
  await openAs(page, 'viewer');
  expect(await drawerLabels(page)).toEqual(['My day', 'Clients', 'KPIs', 'Reports']);
  await expect(page.locator('[data-create]')).toHaveCount(0);
  await page.setViewportSize(PHONE);
  expect(await barLabels(page)).toEqual(['My day', 'Clients', 'KPIs', 'Reports']);
  await expect(page.locator('[data-bottom-more]')).toHaveCount(0);
  await expect(page.locator('[data-create-floating]')).toHaveCount(0);
});

test('6 · out of the menu is not locked: a member opens KPIs, Finance and Reports by address and finds KPIs with Ctrl K', async ({
  page,
}) => {
  await openAs(page, 'member');
  for (const [route, title] of [
    ['/kpis', 'KPIs'],
    ['/finance', 'Finance'],
    ['/reports', 'Reports'],
  ] as const) {
    await page.goto(route);
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('[data-state="no-access"]'), `${route} opens at the member's level`).toHaveCount(0);
    await expect(page.locator('[data-drawer]').getByRole('link', { name: title }), 'yet not in the menu').toHaveCount(
      0,
    );
  }
  await page.goto('/my-day');
  await hydrated(page);
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  await palette.getByPlaceholder('Go to a page or search…').fill('KPIs');
  await palette.getByRole('option', { name: 'KPIs' }).click();
  await expect(page).toHaveURL(/\/kpis$/);
  // An invoice by "INV" and a client's Finance tab come with Finance's own screens (P4); nothing to find yet.
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
  await expect(page.getByRole('heading', { level: 1, name: 'Clients' }), 'one page, two tabs').toBeVisible();
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

test('9 · Create offers only built screens at Full, opens a lone item directly, and never says Partner', async ({
  page,
  browser,
}) => {
  // a manager: Client and Supplier are built and at Full; Task, Invoice and Achievement are not built — absent
  await openAs(page, 'manager');
  await page.locator('[data-create]').click();
  await expect(page.getByRole('menuitem')).toHaveText(['Client', 'Supplier']);
  await expect(page.getByRole('menu')).not.toContainText('Partner');
  await page.keyboard.press('Escape');

  // one item left (a member whose Suppliers is View): Create and the + open it directly, no menu
  const ctx = await browser.newContext();
  const one = await ctx.newPage();
  const member = await personAs('member');
  await sql(
    `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
     values ($1, 'suppliers_partners', 'view', 'Made up: suppliers read only', $1)`,
    [member.id],
  );
  await one.setViewportSize(DESKTOP);
  await signIn(one, member.email, '/my-day');
  await hydrated(one);
  const create = one.locator('[data-create]');
  await expect(create).toHaveText('New client');
  await expect(create).toHaveAttribute('data-create-direct', 'client');
  await create.click();
  await expect(one).toHaveURL(/\/clients\?new=1$/);
  await expect(one.locator('[data-partner-form]'), 'the New dialog is open on arrival').toBeVisible();
  await one.keyboard.press('Escape');
  await one.setViewportSize(PHONE);
  await one.goto('/my-day');
  await hydrated(one);
  const plus = one.locator('[data-create-floating]');
  await expect(plus).toHaveAttribute('data-create-direct', 'client');
  await expect(plus).toHaveAttribute('href', '/clients?new=1');
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

test("12 · a member's My profile: five cards, five notification switches, none of the cut fields; a manager's sixteen", async ({
  page,
  browser,
}) => {
  await openAs(page, 'member', '/profile');
  await expect(page.locator('[data-profile-card]')).toHaveCount(5);
  const cards = await page
    .locator('[data-profile-card]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-profile-card')));
  expect(cards).toEqual(['profile', 'preferences', 'notifications', 'password', 'devices']);
  await expect(page.locator('[data-profile-card="notifications"] [role="switch"]')).toHaveCount(5);
  for (const gone of ['Nickname', 'Badge', 'Start page', 'Drawer', 'Theme', 'Full name'])
    await expect(page.getByLabel(gone, { exact: true }), `${gone} is not on My profile`).toHaveCount(0);

  const ctx = await browser.newContext();
  const manager = await ctx.newPage();
  await openAs(manager, 'manager', '/profile');
  await expect(manager.locator('[data-profile-card="notifications"] [role="switch"]')).toHaveCount(16);
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
        '[data-bottom-bar] a, [data-bottom-bar] button, [data-topbar] button, [data-topbar] a, [data-create-floating], [data-side-tabs] a, [data-contact-phone]',
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

  // Job 2 — what is due today, one ticked off: Tasks is being built, so the job waits for it (P5)
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-bottom-bar]').getByRole('link', { name: 'Tasks' }).click();
  await expect(page.locator('[data-state="empty"]')).toContainText('Being built.');

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
