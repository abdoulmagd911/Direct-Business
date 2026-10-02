/**
 * Every screen, as every role (V97, V125, V209, V210): each (person, address) is classified — renders, no access (in
 * words), not found, back to the door, or crashed (an error page, an uncaught error, a console error, a failed call) —
 * and compared with what the person's levels say. Pages that are still placeholders have no level gate yet: at level
 * none they are NOT BUILT, not PASS. The drawer, the phone bar's More, Ctrl K and the profile links are checked too.
 */
import { expect, test, type Page } from '@playwright/test';
import { apiAs, fx, hydrated, info, notBuilt, shot, signIn, user, verdict } from './lib';

const AREA = 'routes';
type Level = 'none' | 'view' | 'own' | 'full';
const PAGES = [
  'activity',
  'appraisal',
  'clients',
  'finance',
  'kpis',
  'my_day',
  'overview',
  'pipeline',
  'projects',
  'reports',
  'suppliers_partners',
  'tasks',
] as const;
const SETTINGS = [
  'settings.app',
  'settings.finance',
  'settings.org',
  'settings.partners',
  'settings.performance',
  'settings.work',
];

// The registry's starting levels (supabase/migrations/*_core_registry_sync.sql) and the fixtures' overrides.
const ROLE_LEVELS: Record<string, Partial<Record<string, Level>>> = {
  admin: Object.fromEntries([...PAGES, ...SETTINGS].map((p) => [p, 'full'])),
  head: {
    activity: 'view',
    appraisal: 'own',
    clients: 'full',
    finance: 'full',
    kpis: 'full',
    my_day: 'full',
    overview: 'full',
    pipeline: 'full',
    projects: 'full',
    reports: 'full',
    suppliers_partners: 'full',
    tasks: 'full',
  },
  manager: {
    activity: 'view',
    appraisal: 'own',
    clients: 'full',
    finance: 'full',
    kpis: 'full',
    my_day: 'full',
    overview: 'view',
    pipeline: 'full',
    projects: 'full',
    reports: 'view',
    suppliers_partners: 'full',
    tasks: 'full',
  },
  member: {
    activity: 'none',
    appraisal: 'own',
    clients: 'full',
    finance: 'own',
    kpis: 'own',
    my_day: 'own',
    overview: 'none',
    pipeline: 'own',
    projects: 'own',
    reports: 'view',
    suppliers_partners: 'full',
    tasks: 'own',
  },
  viewer: {
    activity: 'none',
    appraisal: 'none',
    clients: 'view',
    finance: 'view',
    kpis: 'view',
    my_day: 'view',
    overview: 'view',
    pipeline: 'view',
    projects: 'view',
    reports: 'view',
    suppliers_partners: 'view',
    tasks: 'view',
  },
};
const PEOPLE: Record<string, { role: string | null; overrides?: Partial<Record<string, Level>> }> = {
  admin: { role: 'admin' },
  head: { role: 'head' },
  manager: { role: 'manager' },
  member: { role: 'member' },
  viewer: { role: 'viewer' },
  noclients: { role: 'member', overrides: { clients: 'none' } },
  nolevels: { role: null },
};
function levelOf(key: string, page: string): Level {
  const p = PEOPLE[key]!;
  return p.overrides?.[page] ?? (p.role ? (ROLE_LEVELS[p.role]?.[page] ?? 'none') : 'none');
}
const isAdmin = (key: string) => PEOPLE[key]?.role === 'admin';

type Got = 'renders' | 'no-access' | 'not-found' | 'sign-in' | 'set-password' | 'crash';
type Route = {
  path: string;
  /** What should happen, from the person's levels. */
  expect: (key: string) => Got;
  /** A placeholder page: at level none it renders anyway (no gate yet) — NOT BUILT, not PASS. */
  placeholderPage?: string;
  /** Where the address should land (a redirect), when not on itself. */
  lands?: RegExp;
  note?: string;
  /** A record: one the reader may not see may read as Not found instead of no access (it does not say it exists). */
  hidden?: boolean;
};

const NAV: { path: string; page: string; label: string }[] = [
  { path: '/my-day', page: 'my_day', label: 'My day' },
  { path: '/overview', page: 'overview', label: 'Overview' },
  { path: '/partners?view=clients', page: 'clients', label: 'Clients' },
  { path: '/partners?view=suppliers', page: 'suppliers_partners', label: 'Suppliers' },
  { path: '/pipeline', page: 'pipeline', label: 'Pipeline' },
  { path: '/projects', page: 'projects', label: 'Projects' },
  { path: '/tasks', page: 'tasks', label: 'Tasks' },
  { path: '/finance', page: 'finance', label: 'Finance' },
  { path: '/kpis', page: 'kpis', label: 'KPIs' },
  { path: '/reports', page: 'reports', label: 'Reports' },
  { path: '/appraisal', page: 'appraisal', label: 'Appraisal' },
];

/**
 * V217's menu rule (`navFor` in ui/shell/nav.ts): the work pages (My day, Tasks, Clients, Pipeline) at any level above
 * none; the manage pages for Manager, Head and Admin, a Viewer getting KPIs and Reports, Overview and Activity kept to
 * Head and Admin; Suppliers is Clients' tab, in the menu itself only when Clients is none (QA-504); Settings for admins.
 */
const WORK_TIER = ['my_day', 'tasks', 'clients', 'pipeline'];
function menuFor(key: string): string[] {
  const role = PEOPLE[key]?.role ?? null;
  const above = (page: string) => levelOf(key, page) !== 'none';
  const managing = role === 'manager' || role === 'head' || role === 'admin';
  const out: string[] = [];
  for (const n of NAV) {
    if (!above(n.page)) continue;
    if (n.page === 'suppliers_partners') {
      if (!above('clients')) out.push(n.label);
    } else if (WORK_TIER.includes(n.page)) out.push(n.label);
    else if (n.page === 'overview') {
      if (role === 'head' || role === 'admin') out.push(n.label);
    } else if (managing || (role === 'viewer' && (n.page === 'kpis' || n.page === 'reports'))) out.push(n.label);
  }
  if (above('activity') && (role === 'head' || role === 'admin')) out.push('Activity');
  if (isAdmin(key)) out.push('Settings');
  return out;
}

/** Ctrl K reaches every page the person may open (`reachableFor`), in the menu or not (V217: out of the menu is never locked). */
function reachableFor(key: string): string[] {
  const out = NAV.filter((n) => levelOf(key, n.page) !== 'none').map((n) => n.label);
  if (levelOf(key, 'activity') !== 'none') out.push('Activity');
  if (isAdmin(key)) out.push('Settings');
  return out;
}

function routes(): Route[] {
  const f = fx();
  const lvl = (page: string) => (key: string) => (levelOf(key, page) === 'none' ? 'no-access' : 'renders') as Got;
  const adminOnly = (key: string) => (isAdmin(key) ? 'renders' : 'no-access') as Got;
  return [
    { path: '/', expect: lvl('my_day'), placeholderPage: 'my_day', lands: /\/my-day$/ },
    ...NAV.map((n) => ({ path: n.path, expect: lvl(n.page), placeholderPage: n.page })),
    {
      path: '/partners',
      expect: (k) =>
        levelOf(k, 'clients') === 'none' && levelOf(k, 'suppliers_partners') === 'none' ? 'no-access' : 'renders',
      placeholderPage: 'clients',
      note: 'QA-237: the old address lands on the list the person may see',
    },
    { path: '/activity', expect: lvl('activity') },
    { path: '/activity?tab=settings', expect: lvl('activity') },
    { path: '/activity?tab=signIns', expect: lvl('activity') },
    {
      path: `/activity?tab=signIns&person=${f.users.member2!.id}`,
      expect: (k) => (levelOf(k, 'activity') === 'none' ? 'no-access' : isAdmin(k) ? 'renders' : 'no-access'),
      note: "another person's sign-ins are for admins (api.sign_in_log needs Organization & access)",
    },
    { path: '/profile', expect: () => 'renders' },
    {
      path: '/settings/profile',
      expect: () => 'not-found',
      note: 'nothing links here since #99 moved My profile to /profile (QA-48); an unknown address is Not found (W28)',
    },
    { path: `/people/${f.users.member2!.id}`, expect: () => 'renders' },
    { path: '/people/00000000-0000-4000-8000-00000000abcd', expect: () => 'not-found' },
    { path: '/people/not-a-uuid', expect: () => 'not-found' },
    { path: '/settings', expect: adminOnly, lands: /\/settings\/org$/ },
    ...[
      'org',
      'org?tab=teams',
      'org?tab=roles',
      'org?tab=access',
      'org?tab=settings',
      'app',
      'finance',
      'partners',
      'performance',
      'work',
    ].map((g) => ({ path: `/settings/${g}`, expect: adminOnly })),
    { path: '/settings/no-such-group', expect: () => 'not-found' },
    { path: '/kit', expect: () => 'not-found', note: 'the kit gallery is not served by a production build (V202)' },
    {
      path: `/partners/${f.orgs.alpha.id}`,
      expect: lvl('clients'),
      placeholderPage: 'clients',
      hidden: true,
      note: 'the organisation page is P3-9',
    },
    {
      path: `/partners/${f.orgs.beta.id}`,
      expect: lvl('suppliers_partners'),
      placeholderPage: 'suppliers_partners',
      hidden: true,
    },
    {
      path: '/no/such/address',
      expect: () => 'not-found',
      note: 'an address that does not exist is the Not found page, with status 404 (QA-216, #145)',
    },
    { path: '/sign-in', expect: () => 'renders', lands: /\/my-day$/, note: 'a signed-in person is sent on' },
    { path: '/set-password', expect: () => 'renders', lands: /\/my-day$/, note: 'nothing to change: sent on' },
  ];
}

/** Watches a page for crashes: uncaught errors, console errors, failed calls (5xx or a dropped request). */
function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|WebSocket|hmr/i.test(t)) return;
    errors.push(`console: ${t.slice(0, 200)}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
  });
  page.on('requestfailed', (r) => {
    const why = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(why))
      errors.push(`failed ${why} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
  });
  return errors;
}

async function classify(page: Page, status: number | null): Promise<Got> {
  const url = new URL(page.url());
  if (url.pathname === '/sign-in' || url.pathname.startsWith('/auth/sign-out')) return 'sign-in';
  if (url.pathname === '/set-password') return 'set-password';
  // what a person sees (innerText): the page's inline flight data also carries the not-found template's words
  const body = await page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '');
  if (
    (status ?? 200) >= 500 ||
    /Application error|server-side exception|Internal Server Error|This page couldn.t load/i.test(body)
  )
    return 'crash';
  if (status === 404 || /This page could not be found/.test(body)) return 'not-found';
  if (await page.locator('[data-state="no-access"]').count()) return 'no-access';
  return 'renders';
}

async function sweep(page: Page, key: string) {
  const errors = watch(page);
  await signIn(page, key, '/my-day');
  await hydrated(page);

  // api.me() says the same levels as the registry and the fixtures' overrides
  const me = await (await apiAs(key))('me');
  const levels = ((me.data as { levels?: Record<string, Level> } | null)?.levels ?? {}) as Record<string, Level>;
  const differs = [...PAGES, ...SETTINGS].filter((p) => (levels[p] ?? 'none') !== levelOf(key, p));
  verdict(
    {
      area: AREA,
      user: key,
      screen: '(api.me)',
      check: "api.me()'s levels are the role's starting levels and overrides",
      detail: differs.map((p) => `${p}: ${levels[p]} ≠ ${levelOf(key, p)}`).join('; ') || 'all equal',
    },
    differs.length === 0,
  );

  // the drawer: V217's menu rule; Settings for admins only (V209)
  const drawer = page.locator('[data-drawer]');
  const expected = menuFor(key);
  const shown: string[] = [];
  for (const label of [...NAV.map((n) => n.label), 'Activity', 'Settings'])
    // nav entries only: the logo (aria-label "My day") and the person at the foot carry an aria-label; entries do not
    if (
      await drawer
        .locator('a:not([aria-label])')
        .filter({ hasText: new RegExp(`^${label}$`) })
        .count()
    )
      shown.push(label);
  verdict(
    {
      area: AREA,
      user: key,
      screen: '(drawer)',
      check: "the drawer shows exactly V217's menu for the person (+ Settings for admins)",
      detail: `shown: ${shown.join(', ')} · expected: ${expected.join(', ')}`,
    },
    shown.sort().join('|') === [...expected].sort().join('|'),
  );

  // Ctrl K lists every page the person may open (V217)
  await page.keyboard.press('Control+k');
  const palette = page.locator('[data-command-palette]');
  if (await palette.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const items = (await palette.locator('[cmdk-group]').first().locator('[cmdk-item]').allTextContents()).map((s) =>
      s.trim(),
    );
    verdict(
      {
        area: AREA,
        user: key,
        screen: '(Ctrl K)',
        check: 'Ctrl K offers exactly the pages the person may open (V217)',
        detail: `offered: ${items.join(', ')} · expected: ${reachableFor(key).join(', ')}`,
      },
      items.sort().join('|') === reachableFor(key).sort().join('|'),
    );
    const clients = (await palette.getByText(/Clients|client/i).count()) > 0;
    if (levelOf(key, 'clients') === 'none')
      verdict(
        {
          area: AREA,
          user: key,
          screen: '(Ctrl K)',
          check: 'Ctrl K offers nothing of Clients to a person shut out of Clients',
        },
        !clients,
      );
    await page.keyboard.press('Escape');
  } else {
    verdict({ area: AREA, user: key, screen: '(Ctrl K)', check: 'Ctrl K opens' }, false);
  }

  // the profile links (profile menu on the chip, the drawer foot) open My profile
  const foot = drawer.locator('a[data-entity="person"]').first();
  const footHref = await foot.getAttribute('href').catch(() => null);
  await Promise.all([
    page.waitForURL((u) => u.pathname !== '/my-day', { timeout: 15_000 }).catch(() => undefined),
    foot.click(),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const footLanding = await classify(page, null);
  verdict(
    {
      area: AREA,
      user: key,
      screen: '(drawer foot)',
      check: "the drawer's own name opens My profile",
      detail: `link ${footHref} → ${new URL(page.url()).pathname} (${footLanding})`,
      shot: footLanding !== 'renders' ? await shot(page, `drawer-foot-${key}`) : undefined,
    },
    footLanding === 'renders' && new URL(page.url()).pathname === '/profile',
  );

  // the top bar's profile chip → My profile
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-topbar] [data-profile-chip]').click();
  const item = page.getByRole('menuitem', { name: /My profile/ }).first();
  const itemHref = await item
    .locator('xpath=descendant-or-self::a')
    .first()
    .getAttribute('href')
    .catch(() => null);
  await Promise.all([
    page.waitForURL((u) => u.pathname !== '/my-day', { timeout: 15_000 }).catch(() => undefined),
    item.click().catch(() => undefined),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const chipLanding = await classify(page, null);
  verdict(
    {
      area: AREA,
      user: key,
      screen: '(profile menu)',
      check: "the profile chip's My profile opens My profile",
      detail: `link ${itemHref} → ${new URL(page.url()).pathname} (${chipLanding})`,
      shot: chipLanding !== 'renders' ? await shot(page, `profile-menu-${key}`) : undefined,
    },
    chipLanding === 'renders' && new URL(page.url()).pathname === '/profile',
  );

  for (const r of routes()) {
    errors.length = 0;
    const res = await page.goto(r.path).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await hydrated(page, 8_000);
    const got = await classify(page, res?.status() ?? null);
    const want = r.expect(key);
    const landed = new URL(page.url());
    const landOk = !r.lands || r.lands.test(landed.pathname);
    const hiddenOk = !!r.hidden && want === 'no-access' && got === 'not-found';
    const expectedNotFound = want === 'not-found' || hiddenOk;
    const errs = errors.filter((e) => !(expectedNotFound && /status of 404|HTTP 404/.test(e)));
    const detail = `expected ${want}${r.lands ? ` at ${r.lands.source}` : ''}, got ${got} at ${landed.pathname}${landed.search}${errs.length ? ` · ${errs.slice(0, 3).join(' | ')}` : ''}${r.note ? ` · ${r.note}` : ''}`;
    const base = {
      area: AREA,
      user: key,
      screen: r.path
        .replace(fx().orgs.alpha.id, '[alpha]')
        .replace(fx().orgs.beta.id, '[beta]')
        .replace(user('member2').id, '[member2]'),
    };
    if (got === 'crash') {
      verdict({ ...base, check: 'no raw error page', detail, shot: await shot(page, `crash-${key}-${r.path}`) }, false);
      continue;
    }
    if (r.placeholderPage && want === 'no-access' && got === 'renders') {
      notBuilt({
        ...base,
        check: 'refused by address at level none',
        detail: `${detail} · a placeholder page with no level gate yet (the drawer hides it)`,
      });
      continue;
    }
    if (hiddenOk)
      info({ ...base, check: 'a record the reader may not see reads as Not found, not as no access', detail });
    const ok = (got === want || hiddenOk) && landOk && errs.length === 0;
    verdict(
      {
        ...base,
        check: 'renders as the levels say',
        detail,
        shot: ok ? undefined : await shot(page, `route-${key}-${r.path}`),
      },
      ok,
    );
  }

  // Settings content never reaches a non-admin by address (V97), and the settings log stays the admin's
  if (!isAdmin(key) && levelOf(key, 'activity') !== 'none') {
    await page.goto('/activity?tab=settings');
    await hydrated(page);
    const leaked = await page.getByText(fx().settingReason).count();
    verdict(
      {
        area: AREA,
        user: key,
        screen: '/activity?tab=settings',
        check: "an admin's settings change is not shown to a non-admin",
        detail: `${leaked} rows with the seed setting's reason`,
      },
      leaked === 0,
    );
  }
}

for (const key of Object.keys(PEOPLE)) {
  test(`every screen as ${key}`, async ({ page }) => {
    test.slow();
    await sweep(page, key);
  });
}

test('the phone bar: More lists the same pages; Clients is not offered to a person shut out of Clients', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 860 });
  for (const key of ['member', 'noclients']) {
    await page.context().clearCookies();
    await signIn(page, key, '/my-day');
    await hydrated(page);
    const bar = page.locator('[data-bottom-bar]');
    const hasBar = await bar.isVisible().catch(() => false);
    if (!hasBar) {
      verdict({ area: AREA, user: key, screen: '(phone bar)', check: 'the phone bar shows at 400 px' }, false);
      continue;
    }
    const barClients = await bar.getByRole('link', { name: 'Clients', exact: true }).count();
    await page
      .locator('[data-bottom-more]')
      .click()
      .catch(() => undefined);
    const sheet = page.locator('[data-more-sheet]');
    const sheetClients = (await sheet.isVisible().catch(() => false))
      ? await sheet.getByRole('link', { name: 'Clients', exact: true }).count()
      : 0;
    const shouldShow = levelOf(key, 'clients') !== 'none';
    verdict(
      {
        area: AREA,
        user: key,
        screen: '(phone bar)',
        check: shouldShow ? 'Clients is on the phone bar' : 'Clients is on neither the phone bar nor More',
        detail: `bar ${barClients}, More ${sheetClients}`,
      },
      shouldShow ? barClients + sheetClients > 0 : barClients + sheetClients === 0,
    );
    await page.keyboard.press('Escape');
  }
});

test('Arabic (app.arabic_enabled is off): the screens with the ar cookie, for the record', async ({
  page,
  context,
}) => {
  test.slow();
  await signIn(page, 'admin', '/my-day');
  await context.addCookies([{ name: 'v2.locale', value: 'ar', url: page.url() }]);
  const errors = watch(page);
  const bad: string[] = [];
  for (const path of [
    '/my-day',
    '/activity',
    '/profile',
    '/settings/org',
    '/settings/work',
    `/people/${user('member').id}`,
  ]) {
    errors.length = 0;
    const res = await page.goto(path);
    await hydrated(page, 8_000);
    const got = await classify(page, res?.status() ?? null);
    const dir = await page.locator('html').getAttribute('dir');
    if (got !== 'renders' || errors.length)
      bad.push(`${path}: ${got}, dir=${dir}, ${errors.length} errors (${errors[0] ?? ''})`);
  }
  info({
    area: AREA,
    user: 'admin',
    screen: '(Arabic)',
    check: 'Arabic is switched off (V122); screens with the ar cookie',
    detail: bad.length ? bad.join(' | ') : 'all render without errors',
  });
  await expect(page.locator('html')).toBeVisible();
});
