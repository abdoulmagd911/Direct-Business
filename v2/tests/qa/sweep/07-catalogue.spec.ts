/**
 * The oversight's scenario catalogue (scenarios.csv, V452–V461; the old app's lessons in scenarios-old.csv): one test per
 * row the QA lane was asked to prove, named with its catalogue ID. Every check writes a line — area 'catalogue', check
 * "<ID> · <expected result>" — PASS, FAIL (a real defect: the test fails too, softly, so the other checks still run),
 * NOT BUILT (only where the feature does not exist at all) or INFO (what was seen where a part cannot be exercised here).
 * Each test has its own made-up people (seed.mjs, CATALOGUE_PEOPLE), so the tests run side by side without sharing a
 * password, a role, a profile or a log. Made-up data only (rule 7).
 */
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  apiAs,
  fx,
  hydrated,
  info,
  inWords,
  notBuilt,
  said,
  shot,
  signIn,
  sql,
  submitAndSettle,
  toast,
  tryDoor,
  user,
  verdict,
  words,
} from './lib';
import { BASE_URL } from './paths.mjs';

const AREA = 'catalogue';
const API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

// ---------------------------------------------------------------- result lines
type Where = { screen?: string; user?: string; detail?: string; shot?: string };
const check = (id: string, expected: string, w: Where, ok: boolean) =>
  verdict({ area: AREA, ...w, check: `${id} · ${expected}` }, ok);
const note = (id: string, expected: string, w: Where) => info({ area: AREA, ...w, check: `${id} · ${expected}` });
const missing = (id: string, expected: string, w: Where) =>
  notBuilt({ area: AREA, ...w, check: `${id} · ${expected}` });
const snap = (page: Page, id: string, what: string) => shot(page, `catalogue-${id}-${what}`);

// ---------------------------------------------------------------- small readers
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const say = (key: string) => words(key) ?? key;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UNAVAILABLE = say('errors.kind.Unavailable');
const ACCESS_WORDS = [
  'errors.access.needs_level',
  'errors.access.admins_only',
  'errors.access.denied',
  'errors.kind.PermissionDenied',
].map(say);

async function textOf(l: Locator): Promise<string> {
  return norm(
    await l
      .first()
      .textContent({ timeout: 2_000 })
      .catch(() => ''),
  );
}
const pathOf = (page: Page) => new URL(page.url()).pathname;
const doorLine = (page: Page) => textOf(page.locator('[data-door-alert]'));

/** The drawer's page entries (not the logo or the person at its foot, which carry an aria-label). */
async function drawerEntries(page: Page): Promise<string[]> {
  const drawer = page.locator('[data-drawer]');
  await drawer.waitFor({ timeout: 10_000 }).catch(() => undefined);
  return (
    await drawer
      .locator('a:not([aria-label])')
      .allInnerTexts()
      .catch(() => [] as string[])
  )
    .map((s) => s.trim())
    .filter(Boolean);
}

/** What a page drew: the no-access state, the placeholder's empty state, and its main text. */
async function pageState(page: Page) {
  return {
    noAccess: (await page.locator('[data-state="no-access"]').count()) > 0,
    empty: (await page.locator('[data-state="empty"]').count()) > 0,
    main: norm(
      await page
        .locator('main')
        .first()
        .innerText({ timeout: 5_000 })
        .catch(() => ''),
    ),
  };
}

/** The first toast that was not on screen before `act`, in words ('' when none came). */
async function nextToast(page: Page, act: () => Promise<unknown>, timeout = 15_000): Promise<string> {
  const toasts = page.locator('[data-sonner-toast]');
  const before = new Set((await toasts.allInnerTexts().catch(() => [] as string[])).map(norm));
  await act();
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const t of (await toasts.allInnerTexts().catch(() => [] as string[])).map(norm))
      if (t && !before.has(t)) return t;
    await page.waitForTimeout(200);
  }
  return '';
}

async function settle<T>(page: Page, read: () => Promise<T>, done: (v: T) => boolean, ms: number): Promise<T> {
  const end = Date.now() + ms;
  let v = await read();
  while (!done(v) && Date.now() < end) {
    await page.waitForTimeout(500);
    v = await read();
  }
  return v;
}

const roleId = async (key: string) =>
  (await sql<{ id: string }>(`select id::text from core.role where key = $1`, [key]))[0]?.id ?? '';
const personVersion = async (id: string) =>
  (await sql<{ v: number }>(`select version as v from core.person where id = $1`, [id]))[0]?.v;
const profileVersion = async (person: string) =>
  (await sql<{ v: number }>(`select version as v from core.person_profile where person_id = $1`, [person]))[0]?.v;
const requestsBy = async (person: string) =>
  Number(
    (await sql<{ n: string }>(`select count(*)::text as n from audit.request where actor_id = $1`, [person]))[0]?.n,
  );

/** Supabase Auth's admin API with the LOCAL stack's secret key — test set-up only (a made-up password). */
function authAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API) || !secret) throw new Error('not a local QA stack');
  return createClient(API, secret, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

// ---------------------------------------------------------------- writes the browser sends
let volatileFns: Set<string> | null = null;
/** The api.* functions the database declares volatile — the writes; stable ones are reads. */
async function writeFns(): Promise<Set<string>> {
  volatileFns ??= new Set(
    (
      await sql<{ name: string }>(
        `select proname as name from pg_proc where pronamespace = 'api'::regnamespace and provolatile = 'v'`,
      )
    ).map((r) => r.name),
  );
  return volatileFns;
}
/** The person's own bookkeeping (OLD-012): the device's "still in use" and a page's "last seen". */
const BOOKKEEPING = new Set(['device_touch', 'page_seen']);
type Sent = { name: string; allowed: boolean };

/** Every write request the page sends: api.* writes, table writes, server actions, POSTs to the app's own routes. */
function watchWrites(page: Page, fns: Set<string>): Sent[] {
  const sent: Sent[] = [];
  page.on('request', (r) => {
    const method = r.method();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    const u = new URL(r.url());
    if (API && r.url().startsWith(API)) {
      const fn = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
      if (fn) {
        if (fns.has(fn)) sent.push({ name: `api.${fn}`, allowed: BOOKKEEPING.has(fn) });
        return;
      }
      if (u.pathname.startsWith('/auth/v1/token')) sent.push({ name: `session refresh`, allowed: true });
      else sent.push({ name: `${method} ${u.pathname}`, allowed: false });
      return;
    }
    if (r.headers()['next-action']) sent.push({ name: `server action on ${u.pathname}`, allowed: false });
    else if (u.origin === BASE_URL) sent.push({ name: `${method} ${u.pathname}`, allowed: false });
  });
  return sent;
}

/** The tab loses the focus and gets it back (another tab in front, then this one; the events a browser sends). */
async function refocus(page: Page): Promise<void> {
  const other = await page.context().newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await page.waitForTimeout(300);
  await page.bringToFront();
  await other.close();
  await page
    .evaluate(() => {
      for (const state of ['hidden', 'visible'] as const) {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event(state === 'hidden' ? 'blur' : 'focus'));
      }
    })
    .catch(() => undefined);
}

// ================================================================ ACC — access, sign-in, people
test('ACC-009 many wrong passwords in a minute: the rate-limited line; no app-level lockout', async ({ page }) => {
  // The password door (modules/org/screens/PasswordDoor.tsx → core/auth/password-actions.ts signInWithPassword: a 429
  // from Supabase Auth becomes 'rate_limited', V213's line) and Supabase Auth's per-address limit underneath (§4 step 3).
  const id = 'ACC-009';
  const who = user('c_rate');
  const limitedLine = say('sign_in.password.error.rate_limited');
  await page.goto('/sign-in');
  await hydrated(page);
  const N = 35; // above the hosted project's 30 sign-ins per 5 minutes per address
  const lines = new Map<string, number>();
  let limitedAt = 0;
  const started = Date.now();
  for (let i = 1; i <= N; i++) {
    await tryDoor(page, who.email, `Not-the-password-${i}`);
    const l = await doorLine(page);
    lines.set(l, (lines.get(l) ?? 0) + 1);
    if (l === limitedLine) {
      limitedAt = i;
      break;
    }
  }
  const secs = Math.round((Date.now() - started) / 1000);
  const seen = [...lines].map(([l, n]) => `${n}× "${l}"`).join('; ');
  if (limitedAt) {
    check(
      id,
      'many wrong passwords get the rate-limited line, in words',
      { screen: '/sign-in', user: 'c_rate', detail: `after ${limitedAt} tries in ${secs} s: ${seen}` },
      true,
    );
  } else {
    // Is there a limit to meet at all? Ask the auth server itself, as fast as it answers.
    const statuses = new Map<number, number>();
    for (let i = 0; i < 40; i++) {
      const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' },
        body: JSON.stringify({ email: who.email, password: `Not-the-password-probe-${i}` }),
      }).catch(() => null);
      const s = r?.status ?? 0;
      statuses.set(s, (statuses.get(s) ?? 0) + 1);
    }
    const answers = [...statuses].map(([s, n]) => `${n}× HTTP ${s}`).join(', ');
    if (statuses.get(429))
      check(
        id,
        'many wrong passwords get the rate-limited line, in words',
        {
          screen: '/sign-in',
          user: 'c_rate',
          detail: `the auth server limits (${answers}) but the door never said so: ${seen}`,
          shot: await snap(page, id, 'no-rate-limited-line'),
        },
        false,
      );
    else
      note(id, 'many wrong passwords get the rate-limited line — not reproducible on a local stack', {
        screen: '/sign-in',
        user: 'c_rate',
        detail:
          `${N} wrong passwords through the door in ${secs} s: ${seen}. The auth server itself answered 40 more with ` +
          `${answers}, never 429: the CLI (2.118.0) starts Supabase Auth without GOTRUE_RATE_LIMIT_HEADER, so no ` +
          'per-address limit applies locally, and lowering [auth.rate_limit] sign_in_sign_ups in the stack copy (it ' +
          'sets GOTRUE_RATE_LIMIT_OTP) cannot switch one on. The door maps a 429 to its line in ' +
          'core/auth/password-actions.ts; the limit itself is the hosted project’s.',
      });
  }
  note(id, "the rate-limited line's words", {
    screen: '/sign-in',
    detail: `the app (V213): "${limitedLine}" · the catalogue: "Too many tries — wait a minute and try again"`,
  });
  if (limitedAt) return; // a limited address cannot also prove the next part; the local stack never gets here
  await tryDoor(page, who.email, fx().password);
  await page.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  const inside = !/\/sign-in/.test(pathOf(page));
  check(
    id,
    'no app-level lockout: the right password still signs in after them',
    {
      screen: '/sign-in',
      user: 'c_rate',
      detail: inside ? `signed in → ${pathOf(page)}` : `refused: "${await doorLine(page)}"`,
      shot: inside ? undefined : await snap(page, id, 'locked-out'),
    },
    inside,
  );
});

test('ACC-010 the sign-in page: the forgot line is plain text, not a link; nothing else on the page', async ({
  page,
}) => {
  // The sign-in page as drawn (app/(auth)/sign-in/page.tsx → modules/org/screens/SignIn.tsx, DoorFrame.tsx,
  // PasswordDoor.tsx; V213, V75), signed out, at the sweep's desktop width.
  const id = 'ACC-010';
  await page.goto('/sign-in');
  await hydrated(page);
  const forgotText = say('sign_in.password.forgot');
  const forgot = page.getByText(forgotText, { exact: true });
  const n = await forgot.count();
  const how = n
    ? await forgot.first().evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        control: !!el.closest('a, button, [role="link"], [role="button"], [onclick], [tabindex]'),
      }))
    : { tag: '', control: false };
  check(
    id,
    'the forgot line is on the page once, as plain text — not a link or a button',
    { screen: '/sign-in', detail: `${n} × <${how.tag}>${how.control ? ' inside a control' : ''}` },
    n === 1 && !how.control,
  );

  const controls = await page
    .locator(
      'a[href], button, input, select, textarea, [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])',
    )
    .evaluateAll((els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        })
        .map((e) => {
          const el = e as HTMLInputElement;
          const type = el.getAttribute('type');
          const name = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
          return `${el.tagName.toLowerCase()}${type ? `[${type}]` : ''}${name ? ` "${name}"` : ''}`;
        }),
    );
  const allowedControls = [
    /^input\[email\]$/,
    /^input\[password\]$/,
    new RegExp(
      `^button\\[button\\] "(${escapeRe(say('sign_in.password.show'))}|${escapeRe(say('sign_in.password.hide'))})"$`,
    ),
    new RegExp(`^button\\[submit\\] "${escapeRe(say('sign_in.password.signIn'))}"$`),
  ];
  const extraControls = controls.filter((c) => !allowedControls.some((r) => r.test(c)));
  check(
    id,
    'the only controls are Work email, Password (with show/hide) and Sign in — no reset link, no other door',
    {
      screen: '/sign-in',
      detail: `controls: ${controls.join(', ')}${extraControls.length ? ` · not expected: ${extraControls.join(', ')}` : ''}`,
    },
    extraControls.length === 0 && controls.length === 4,
  );

  const lines = (await page.locator('body').innerText())
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [
    say('app.workspace'),
    say('app.name'),
    say('app.brand_line'),
    say('sign_in.password.subtitle'),
    say('sign_in.email_label'),
    say('sign_in.password.label'),
    say('sign_in.password.signIn'),
    forgotText,
  ];
  const extra = lines.filter((l) => !allowed.includes(l) && !/^© \d{4} Direct$/.test(l));
  check(
    id,
    'nothing else on the page: the logo, Commercial Workspace, the two fields, Sign in, the forgot line and © Direct',
    {
      screen: '/sign-in',
      detail: extra.length ? `other text: ${extra.map((s) => `"${s}"`).join(', ')}` : `text: ${lines.join(' | ')}`,
      shot: extra.length ? await snap(page, id, 'sign-in') : undefined,
    },
    extra.length === 0,
  );
  const logos = await page.locator('[data-brand-panel] img, [data-brand-panel] svg').count();
  note(id, 'the logo', { screen: '/sign-in', detail: `${logos} logo image(s) in the brand panel` });
});

test('ACC-026 head, manager, member and viewer POST /auth/admin/password: 403, and no password changes', async ({
  page,
}) => {
  // The generate route (app/auth/admin/password/route.ts: adminRoute → requireLevel('settings.org', 'full'), whose
  // PermissionDenied is answered 403 — core/auth/allow-list.ts), with each person's own browser session.
  const id = 'ACC-026';
  const target = user('c_pwtarget');
  const state = async () =>
    (
      await sql<{ p: string; must: string | null }>(
        `select encrypted_password as p, raw_app_meta_data->>'must_change_password' as must from auth.users
          where lower(email) = lower($1)`,
        [target.email],
      )
    )[0];
  const before = await state();
  for (const key of ['head', 'manager', 'member', 'viewer']) {
    await page.context().clearCookies();
    await signIn(page, key, '/profile');
    const res = await page.request.post('/auth/admin/password', {
      data: { person_id: target.id, reason: `QA catalogue ${id}` },
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: { kind?: string; key?: string };
      temporary_password?: string;
    } | null;
    const now = await state();
    const same = now?.p === before?.p && now?.must === before?.must;
    check(
      id,
      'refused 403 (admins only): no temporary password, the password unchanged',
      {
        screen: 'POST /auth/admin/password',
        user: key,
        detail: `HTTP ${res.status()} ${body?.error?.kind ?? ''} ${body?.error?.key ?? JSON.stringify(body).slice(0, 80)} · password ${same ? 'unchanged' : 'CHANGED'}`,
      },
      res.status() === 403 && body?.ok === false && !body?.temporary_password && same,
    );
  }
});

test('ACC-029 Generate for a person who already has a password: a Reset that names them and asks to confirm', async ({
  page,
}) => {
  // The person record's ⋯ menu → Generate temporary password (modules/org/screens/PersonRecord.tsx: a ReasonDialog,
  // then POST /auth/admin/password), against V451: never replace an existing password without a Reset that names the
  // person and asks to confirm.
  const id = 'ACC-029';
  const target = user('c_reset');
  const hash = async () =>
    (
      await sql<{ p: string }>(`select encrypted_password as p from auth.users where lower(email) = lower($1)`, [
        target.email,
      ])
    )[0]?.p ?? '';
  const before = await hash();
  await signIn(page, 'c_admin', `/people/${target.id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  const items = (await page.getByRole('menuitem').allInnerTexts()).map((s) => s.trim());
  await page.locator('[data-password-generate]').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 10_000 });
  const text = norm(await dialog.innerText());
  const afterOpen = await hash();
  check(
    id,
    'the confirmation names the person',
    { screen: '/people/[id] ⋯ Generate', user: 'c_admin', detail: `"${text.slice(0, 260)}"` },
    text.includes(target.name),
  );
  check(
    id,
    'nothing changes until the admin confirms (the menu item alone leaves the password as it was)',
    { screen: '/people/[id] ⋯ Generate', user: 'c_admin', detail: afterOpen === before ? 'unchanged' : 'CHANGED' },
    before.length > 0 && afterOpen === before,
  );
  const isReset =
    /reset/i.test(`${items.join(' ')} ${text}`) && /current|existing|no longer|stops? working|replace/i.test(text);
  check(
    id,
    'for a person who already has a password it is a Reset that says their current password stops working (not the first-time Generate)',
    {
      screen: '/people/[id] ⋯',
      user: 'c_admin',
      detail: `menu: ${items.join(', ')} · dialog: "${text.slice(0, 260)}"`,
      shot: isReset ? undefined : await snap(page, id, 'generate-dialog'),
    },
    isReset,
  );
  await dialog.getByRole('button', { name: say('common.cancel'), exact: true }).click();
  const afterCancel = await hash();
  check(
    id,
    'Cancel changes nothing',
    { screen: '/people/[id] ⋯ Generate', user: 'c_admin', detail: afterCancel === before ? 'unchanged' : 'CHANGED' },
    afterCancel === before,
  );
});

test('ACC-031 an auth user made outside the app is linked by its email: never a second one, its password untouched', async ({
  page,
  browser,
}) => {
  // The person record → Add email (PersonRecord.tsx → POST /auth/admin/emails → core/auth/allow-list.ts addEmail →
  // ensureAuthUser: createUser, and when the email is taken api.auth_user_of → api.person_auth_link), V451, V118. The
  // auth user was made by the seed with the admin API, as the owner made his in the Supabase dashboard.
  const id = 'ACC-031';
  const dash = fx().catalogue?.dash;
  if (!dash) throw new Error("no catalogue fixtures: run the sweep's full seed (tests/qa/sweep/run.sh)");
  const target = user('c_dash');
  const authUsers = async () =>
    sql<{ id: string; p: string; banned: string | null }>(
      `select id::text, encrypted_password as p, banned_until::text as banned from auth.users where lower(email) = lower($1)`,
      [dash.email],
    );
  const before = await authUsers();
  await signIn(page, 'c_admin', `/people/${target.id}`);
  await hydrated(page);
  await page.locator('[data-email-add]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(say('settings.people.email')).fill(dash.email);
  const line = await nextToast(page, () => dialog.locator('[data-email-save]').click());
  const after = await authUsers();
  const links = await sql<{ auth: string; person: string }>(
    `select auth_user_id::text as auth, person_id::text as person from core.person_auth where lower(email) = lower($1)`,
    [dash.email],
  );
  check(
    id,
    'the admin allows the email on the person record',
    { screen: '/people/[id] Add email', user: 'c_admin', detail: `toast "${line}"` },
    line.includes(dash.email),
  );
  check(
    id,
    'never a second auth user: one for the email, the one made outside the app',
    {
      screen: '/people/[id] Add email',
      user: 'c_admin',
      detail: `before ${before.length}, after ${after.length}: ${after.map((u) => (u.id === dash.authUserId ? 'the one made outside' : 'ANOTHER')).join(', ')}`,
    },
    after.length === 1 && after[0]?.id === dash.authUserId,
  );
  check(
    id,
    'linked by its email to this person',
    {
      screen: '/people/[id] Add email',
      user: 'c_admin',
      detail: links.length
        ? links
            .map(
              (l) =>
                `${l.auth === dash.authUserId ? 'that auth user' : 'another auth user'} → ${l.person === target.id ? 'this person' : 'SOMEONE ELSE'}`,
            )
            .join(', ')
        : 'no link',
    },
    links.length === 1 && links[0]?.auth === dash.authUserId && links[0]?.person === target.id,
  );
  check(
    id,
    'its password untouched (no Reset was confirmed)',
    {
      screen: '/people/[id] Add email',
      user: 'c_admin',
      detail: `${after[0]?.p === before[0]?.p ? 'unchanged' : 'CHANGED'} · banned ${after[0]?.banned ?? 'no'}`,
    },
    !!before[0]?.p && after[0]?.p === before[0]?.p,
  );
  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fprofile');
  await tryDoor(their, dash.email, dash.password);
  await their.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  const name = /\/profile/.test(pathOf(their))
    ? await their
        .getByLabel(say('profile.fullNameEn'), { exact: true })
        .inputValue({ timeout: 5_000 }) // My profile may show the display name only (V217): never wait the test out
        .catch(() => '')
    : '';
  note(id, 'the password typed outside the app still opens the door, as this person', {
    screen: '/sign-in',
    user: 'c_dash',
    detail: `${pathOf(their)}${name ? ` as "${name === target.name ? 'this person' : name}"` : ` — "${await doorLine(their)}"`}`,
  });
  await ctx.close();
});

test('ACC-048 a viewer: no Appraisal, Activity or Settings in the drawer; every write refused, in words', async ({
  page,
}) => {
  // The drawer (ui/shell/Drawer.tsx from ui/shell/nav.ts, levels from api.me()), the screens a viewer can open, and
  // the write doors of the Data API with the viewer's own session (§8, V138).
  const id = 'ACC-048';
  await signIn(page, 'viewer', '/my-day');
  await hydrated(page);
  const entries = await drawerEntries(page);
  const shown = ['Appraisal', 'Activity', 'Settings'].filter((l) => entries.includes(l));
  check(
    id,
    'the drawer has no Appraisal, Activity or Settings',
    { screen: '(drawer)', user: 'viewer', detail: `drawer: ${entries.join(', ')}` },
    entries.length > 0 && shown.length === 0,
  );
  // V217's menu rule: the work pages at any level above none, and of the manage pages only KPIs and Reports for a
  // Viewer (the rest stay reachable by address and Ctrl K, never locked)
  const work = ['My day', 'Clients', 'KPIs', 'Reports'];
  const manage = ['Overview', 'Projects', 'Finance'];
  const absent = work.filter((l) => !entries.includes(l));
  const extra = manage.filter((l) => entries.includes(l));
  check(
    id,
    'the menu holds the work pages, KPIs and Reports, and no other manage page (V217)',
    {
      screen: '(drawer)',
      user: 'viewer',
      detail: `${absent.length ? `missing: ${absent.join(', ')}` : 'all there'}${extra.length ? `; also: ${extra.join(', ')}` : ''}`,
    },
    absent.length === 0 && extra.length === 0,
  );

  const offered: string[] = [];
  for (const path of [`/people/${user('member2').id}`, `/people/${user('viewer').id}`, '/settings/work', '/activity']) {
    await page.goto(path);
    await hydrated(page);
    const n = await page
      .locator(
        '[data-person-edit], [data-person-switch], [data-person-more], [data-email-add], [data-setting-change], [data-list-add], [data-list-archive], [data-team-add], [data-person-add], [data-undo-request]',
      )
      .count();
    if (n) offered.push(`${path.replace(user('member2').id, '[member2]').replace(user('viewer').id, '[self]')}: ${n}`);
  }
  check(
    id,
    'no screen offers the viewer a write control',
    {
      user: 'viewer',
      detail: offered.join('; ') || 'none on /people/[member2], /people/[self], /settings/work, /activity',
    },
    offered.length === 0,
  );

  const api = await apiAs('viewer');
  const f = fx();
  const tries: [string, Record<string, unknown>][] = [
    ['note_add', { p_entity: 'partner', p_id: f.orgs.alpha.id, p_kind: 'comment', p_body: `QA catalogue ${id}` }],
    [
      'contract_save',
      {
        p_partner: f.orgs.alpha.id,
        p_id: null,
        p_values: { side: 'client', title: `QA catalogue ${id}`, start_on: f.today },
        p_reason: `QA catalogue ${id}`,
      },
    ],
    ['partner_status_set', { p_id: f.orgs.alpha.id, p_side: 'client', p_status: 'at_risk', p_note: `QA ${id}` }],
    ['contact_save', { p_partner: f.orgs.alpha.id, p_id: null, p_values: { name_en: `Test Contact ${id}` } }],
    [
      'person_update',
      {
        p_id: user('viewer').id,
        p_changes: { job_title_en: 'Set by the viewer' },
        p_version: await personVersion(user('viewer').id),
        p_reason: `QA catalogue ${id}`,
      },
    ],
    ['setting_set', { p_key: 'work.no_update_days', p_department: null, p_value: 9, p_reason: `QA ${id}` }],
  ];
  for (const [fn, args] of tries) {
    const r = await api(fn, args);
    check(
      id,
      'a write is refused, in words',
      { screen: `(api) ${fn}`, user: 'viewer', detail: said(r) },
      !r.ok && inWords(r),
    );
    const req = (r.data as { request_id?: string } | null)?.request_id;
    if (r.ok && req) await (await apiAs('c_admin'))('undo', { p_request: req });
  }
  note(id, 'a refused write shown on a screen', {
    user: 'viewer',
    detail: 'no screen offers a viewer a write control (above), so the refusal in words is proved at the doors',
  });
});

test('ACC-049 Finance at level none: hidden in the drawer, the no-access state by address, reads refused', async ({
  page,
}) => {
  // The drawer (nav.ts: an entry only above none) and /finance by address (app/(app)/finance/page.tsx: a placeholder
  // that calls Page(), which checks the session only), for a member whose Finance level is none (V125, V209, §5).
  const id = 'ACC-049';
  await signIn(page, 'c_nofin', '/my-day');
  await hydrated(page);
  const entries = await drawerEntries(page);
  check(
    id,
    'the drawer hides Finance',
    { screen: '(drawer)', user: 'c_nofin', detail: `drawer: ${entries.join(', ')}` },
    entries.length > 0 && !entries.includes('Finance'),
  );
  await page.goto('/finance');
  await hydrated(page);
  const s = await pageState(page);
  const ok = s.noAccess && !s.empty;
  check(
    id,
    'by address the page shows the no-access state in words, and nothing of the page',
    {
      screen: '/finance',
      user: 'c_nofin',
      detail: `no-access state ${s.noAccess}, placeholder drawn ${s.empty}: "${s.main.slice(0, 120)}"`,
      shot: ok ? undefined : await snap(page, id, 'finance'),
    },
    ok,
  );
  missing(id, 'Finance reads refused', {
    screen: '/finance',
    user: 'c_nofin',
    detail: 'no Finance reads exist yet (api.* has none; the page is a placeholder)',
  });
});

test('PRF-002 level none on Finance, KPIs, Reports, Overview and Appraisal: the no-access state by address, nothing drawn', async ({
  page,
}) => {
  // The five pages by address (app/(app)/{finance,kpis,reports,overview,appraisal}/page.tsx — placeholders whose Page()
  // checks the session only) for a person at level none on each (§5, V210, OA18); "as Settings does" = its header and
  // DataState no-access (app/(app)/settings/[group]/page.tsx).
  const id = 'PRF-002';
  await signIn(page, 'c_nofin', '/my-day');
  await hydrated(page);
  for (const path of ['/finance', '/kpis', '/reports', '/overview', '/appraisal']) {
    await page.goto(path);
    await hydrated(page);
    const s = await pageState(page);
    const ok = s.noAccess && !s.empty;
    check(
      id,
      'the no-access state in words; nothing of the page drawn',
      {
        screen: path,
        user: 'c_nofin',
        detail: `no-access state ${s.noAccess}, placeholder drawn ${s.empty}: "${s.main.slice(0, 120)}"`,
        shot: ok ? undefined : await snap(page, id, path.slice(1)),
      },
      ok,
    );
  }
});

test('ACC-055 demoted while an edit screen with Full controls is open: the next save is refused in words', async ({
  page,
}) => {
  // The person record's Edit dialog (modules/org/screens/PersonRecord.tsx saveEdit → rpc person_update, which the
  // database refuses below Organization & access · Full) left open while the person is demoted (§5, M42). No manager
  // screen offers Full controls yet (Clients, Pipeline … are placeholders), so the person demoted is an admin, to
  // Team member — the same stale-screen rule.
  const id = 'ACC-055';
  const me = user('c_demote');
  const target = user('c_target');
  const title = async () =>
    (await sql<{ t: string | null }>(`select job_title_en as t from core.person where id = $1`, [target.id]))[0]?.t ??
    null;
  const before = await title();
  await signIn(page, 'c_demote', `/people/${target.id}`);
  await hydrated(page);
  await page.locator('[data-person-edit]').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Job title', { exact: true }).fill(`Test title ${fx().tag} ${id}`);
  const demoted = await (
    await apiAs('c_admin')
  )('access_set_person_role', { p_person: me.id, p_role: await roleId('member'), p_reason: `QA catalogue ${id}` });
  if (!demoted.ok) throw new Error(`could not demote c_demote: ${said(demoted)}`);
  const line = await nextToast(page, () => dialog.locator('[data-person-save]').click());
  const after = await title();
  const worded = ACCESS_WORDS.some((w) => line.includes(w));
  check(
    id,
    'the next save is refused in words (it needs Full), and nothing is written',
    {
      screen: '/people/[id] Edit',
      user: 'c_demote',
      detail: `toast "${line}" · job title ${after === before ? 'unchanged' : `CHANGED to "${after}"`}`,
      shot: worded ? undefined : await snap(page, id, 'stale-save'),
    },
    worded && after === before,
  );
  await page.reload();
  await hydrated(page);
  const entries = await drawerEntries(page);
  const edits = await page.locator('[data-person-edit]').count();
  check(
    id,
    'after a reload the drawer has no Settings and the record no Edit',
    { screen: '/people/[id]', user: 'c_demote', detail: `drawer: ${entries.join(', ')} · Edit buttons ${edits}` },
    entries.length > 0 && !entries.includes('Settings') && edits === 0,
  );
});

test("ACC-066 a member opens a colleague's record: public details only — no emails, access, devices, sign-in log or history", async ({
  page,
}) => {
  // /people/[id] as a member (app/(app)/people/[id]/page.tsx reads people, access, history, devices and the sign-in log;
  // the database refuses what a member may not read; PersonRecord.tsx draws what came back). V132, V128.
  const id = 'ACC-066';
  const col = user('c_colleague');
  const why = `QA catalogue ${id} ${fx().tag}`;
  // something to leak: the colleague's own sign-in (a device and a sign-in log row), and a change in their history
  await apiAs('c_colleague');
  const changed = await (
    await apiAs('c_admin')
  )('person_update', {
    p_id: col.id,
    p_changes: { job_title_en: `Test title ${fx().tag}` },
    p_version: await personVersion(col.id),
    p_reason: why,
  });
  if (!changed.ok) note(id, 'set-up: a change in the colleague history', { detail: said(changed) });
  await signIn(page, 'member', `/people/${col.id}`);
  await hydrated(page);
  const html = await page.content();
  const main = page.locator('main').first();
  check(
    id,
    "no emails (neither drawn nor in the page's data)",
    {
      screen: '/people/[colleague]',
      user: 'member',
      detail: html.includes(col.email) ? 'the email is in the page' : 'absent',
    },
    !html.includes(col.email),
  );
  const cards = [say('settings.people.devices'), say('settings.people.signInLog')];
  const cardsShown: string[] = [];
  for (const c of cards)
    if (
      await main
        .locator('h2')
        .filter({ hasText: new RegExp(`^${escapeRe(c)}$`) })
        .count()
    )
      cardsShown.push(c);
  check(
    id,
    'no devices and no sign-in log',
    {
      screen: '/people/[colleague]',
      user: 'member',
      detail: `${cardsShown.join(', ') || 'no such cards'}${html.includes('QA sweep') ? ' · a device label is in the page' : ''}`,
    },
    cardsShown.length === 0 && !html.includes('QA sweep'),
  );
  const accessSection = await page
    .locator('[data-record-rail] h2, aside h2')
    .filter({ hasText: new RegExp(`^${escapeRe(say('settings.people.access'))}$`, 'i') })
    .count();
  check(
    id,
    'no access levels',
    { screen: '/people/[colleague]', user: 'member', detail: `${accessSection} Access sections` },
    accessSection === 0,
  );
  await page.goto(`/people/${col.id}?tab=activity`);
  await hydrated(page);
  const rows = await page.locator('[data-history-row]').count();
  const reasonShown = (await page.content()).includes(why);
  check(
    id,
    'no history',
    {
      screen: '/people/[colleague]?tab=activity',
      user: 'member',
      detail: `${rows} history rows${reasonShown ? " · the admin's change and its reason are in the page" : ''}`,
      shot: rows || reasonShown ? await snap(page, id, 'history') : undefined,
    },
    rows === 0 && !reasonShown,
  );
});

test('ACC-094 an admin adds a second email: one person, and either email signs in to him on the password door', async ({
  page,
  browser,
}) => {
  test.slow();
  // The person record's emails (PersonRecord.tsx: "+ Add email" is the rail field's empty-state control), the route it
  // calls (POST /auth/admin/emails → allow-list.ts addEmail: the row, a confirmed auth user, the link), Generate
  // temporary password (every auth user of the person gets it) and the door (password-actions.ts, set-password), V2,
  // V118.
  const id = 'ACC-094';
  const who = user('c_twomail');
  const tag = fx().tag;
  const second = `test.qa.c_twomail.alt.${tag}@example.test`;
  await signIn(page, 'c_admin', `/people/${who.id}`);
  await hydrated(page);
  const addControl = page.locator('[data-email-add]');
  const hasControl = (await addControl.count()) > 0;
  check(
    id,
    'the person record offers Add email beside the email the person already has',
    {
      screen: '/people/[id]',
      user: 'c_admin',
      detail: hasControl
        ? 'offered'
        : '"+ Add email" is the empty field\'s control only: once a person has one email there is none (the route is called directly below)',
      shot: hasControl ? undefined : await snap(page, id, 'no-add-email'),
    },
    hasControl,
  );
  let added = '';
  if (hasControl) {
    await addControl.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(say('settings.people.email')).fill(second);
    added = await nextToast(page, () => dialog.locator('[data-email-save]').click());
  } else {
    const res = await page.request.post('/auth/admin/emails', { data: { person_id: who.id, email: second } });
    added = `route: HTTP ${res.status()} ${JSON.stringify(await res.json().catch(() => null)).slice(0, 60)}`;
  }
  const rows = await sql<{ email: string; auth: string | null; person: string | null }>(
    `select e.email, a.auth_user_id::text as auth, a.person_id::text as person from core.person_email e
       left join core.person_auth a on lower(a.email) = lower(e.email)
      where e.person_id = $1 and e.deleted_at is null order by e.is_primary desc, e.email`,
    [who.id],
  );
  check(
    id,
    'one person holds both emails, each linked to its own auth user',
    {
      screen: '/people/[id]',
      user: 'c_admin',
      detail: `${added} · ${rows.map((r) => `${r.email.replace(tag, '[tag]')} → ${r.auth ? (r.person === who.id ? 'linked to this person' : 'linked ELSEWHERE') : 'NOT linked'}`).join(', ')}`,
    },
    rows.length === 2 && rows.every((r) => r.auth && r.person === who.id),
  );

  await page.reload();
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill(`QA catalogue ${id}`);
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(page, say('settings.people.password.generated'))).toBeVisible();
  const temporary = norm(await page.locator('[data-temporary-password]').textContent());

  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fprofile');
  await tryDoor(their, second, temporary);
  await their.waitForURL(/\/set-password/, { timeout: 20_000 }).catch(() => undefined);
  const own = `Own-QA-${tag}-two-emails`;
  if (/\/set-password/.test(pathOf(their))) {
    await hydrated(their);
    await their.getByLabel('New password', { exact: true }).fill(own);
    await their.getByLabel('New password again').fill(own);
    await submitAndSettle(their, their.locator('[data-set-password-save]'));
    await their
      .waitForURL((u) => !/\/set-password|\/sign-in/.test(u.pathname), { timeout: 20_000 })
      .catch(() => undefined);
  }
  const landed = pathOf(their);
  // who the session belongs to, from the sign-in log (My profile no longer shows the full name — V217, cut 6)
  const [last] = await sql<{ person_id: string | null }>(
    `select person_id::text from core.sign_in_log where email = $1 and result = 'ok' order by at desc limit 1`,
    [second],
  );
  const asWho = last?.person_id ?? '';
  check(
    id,
    'the second email signs in (the temporary password, then their own) — as the same person',
    {
      screen: '/sign-in',
      user: 'c_twomail',
      detail: `landed ${landed}; signed in as ${asWho === who.id ? 'this person' : asWho || 'nobody'}${/\/sign-in/.test(landed) ? ` — "${await doorLine(their)}"` : ''}`,
    },
    !/\/sign-in|\/set-password/.test(landed) && asWho === who.id,
  );

  await their.request.post('/auth/sign-out');
  await ctx.clearCookies();
  await their.goto('/sign-in?next=%2Fprofile');
  await tryDoor(their, who.email, own);
  await their.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  const first = pathOf(their);
  const firstLine = /\/sign-in/.test(first) ? await doorLine(their) : '';
  let temporaryStill = '';
  if (/\/sign-in/.test(first)) {
    await tryDoor(their, who.email, temporary);
    await their.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
    temporaryStill = /\/sign-in/.test(pathOf(their))
      ? 'no'
      : `yes (→ ${pathOf(their)}; the temporary password "works once", but here it works again on the first email)`;
  }
  check(
    id,
    'either email signs in to him: the first email takes the password he chose through the second',
    {
      screen: '/sign-in',
      user: 'c_twomail',
      detail: `first email + his own password → ${first}${firstLine ? ` — "${firstLine}"` : ''}${temporaryStill ? ` · the first email still takes the temporary password: ${temporaryStill}` : ''}`,
      shot: /\/sign-in/.test(first) ? await snap(their, id, 'first-email') : undefined,
    },
    !/\/sign-in|\/set-password/.test(first),
  );
  await ctx.close();
});

test('ACC-095 Remove email: a control on the person record that needs a reason; the removed email is refused at once', async ({
  page,
  browser,
}) => {
  test.slow();
  // The person record's emails (PersonRecord.tsx lists them; the catalog has settings.people.removeEmail) and what the
  // control would call, POST /auth/admin/emails/remove (allow-list.ts removeEmail: the soft delete, logged, and a ban of
  // its auth user), then the door and an open session with that email (V118, V144).
  const id = 'ACC-095';
  const who = user('c_rmmail');
  const tag = fx().tag;
  const second = `test.qa.c_rmmail.alt.${tag}@example.test`;
  const secondPassword = `Test-QA-Second-${tag}-x`;
  await signIn(page, 'c_admin', `/people/${who.id}`);
  await hydrated(page);
  const addRes = await page.request.post('/auth/admin/emails', { data: { person_id: who.id, email: second } });
  const addBody = (await addRes.json().catch(() => null)) as { ok?: boolean; auth_user_id?: string } | null;
  if (!addBody?.ok || !addBody.auth_user_id)
    throw new Error(`set-up: could not allow ${second}: HTTP ${addRes.status()}`);
  // set-up: a made-up password on the second email's auth user, so a browser can hold a session with it
  const set = await authAdmin().updateUserById(addBody.auth_user_id, { password: secondPassword });
  if (set.error) throw new Error(`set-up: ${set.error.message}`);
  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.goto('/sign-in?next=%2Fmy-day');
  await tryDoor(their, second, secondPassword);
  await their.waitForURL((u) => !/\/sign-in/.test(u.pathname), { timeout: 15_000 }).catch(() => undefined);
  note(id, 'set-up: the second email holds a session before the removal', {
    user: 'c_rmmail',
    detail: pathOf(their),
  });

  await page.reload();
  await hydrated(page);
  const label = say('settings.people.removeEmail');
  // each email row carries its own Remove (#127): the second email's, never the first row's
  const control = page
    .locator(`[data-person-email="${second}"] [data-email-remove]`)
    .or(page.locator(`[data-person-email="${second}"]`).getByRole('button', { name: label }))
    .or(page.getByRole('menuitem', { name: label }));
  const n = await control.count();
  check(
    id,
    'a Remove email control on the person record',
    {
      screen: '/people/[id]',
      user: 'c_admin',
      detail: n
        ? `${n} controls named "${label}"`
        : `none: the emails are listed as plain text (the catalog's "${label}" is unused); the route is called directly below`,
      shot: n ? undefined : await snap(page, id, 'no-remove-email'),
    },
    n > 0,
  );
  const emailId =
    (
      await sql<{ id: string }>(
        `select id::text from core.person_email where lower(email) = lower($1) and deleted_at is null`,
        [second],
      )
    )[0]?.id ?? '';
  const live = async () =>
    Number(
      (
        await sql<{ n: string }>(
          `select count(*)::text as n from core.person_email where id = $1 and deleted_at is null`,
          [emailId],
        )
      )[0]?.n,
    );
  if (n > 0) {
    await control.first().click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.locator('[data-reason-save]');
    const needsReason = await confirm.isDisabled().catch(() => false);
    check(
      id,
      'Remove email asks for a reason before anything is removed',
      { screen: '/people/[id] Remove email', user: 'c_admin', detail: `confirm disabled while empty: ${needsReason}` },
      needsReason && (await live()) === 1,
    );
    await dialog.getByLabel('Reason').fill(`QA catalogue ${id}`);
    await confirm.click();
    await page.waitForTimeout(2_000);
  } else {
    const noReason = await page.request.post('/auth/admin/emails/remove', { data: { id: emailId } });
    const nb = (await noReason.json().catch(() => null)) as {
      ok?: boolean;
      error?: { kind?: string; key?: string };
    } | null;
    const k = nb?.error?.key ?? '';
    const text = words(`errors.${k}`) ?? words(`errors.kind.${nb?.error?.kind ?? ''}`) ?? '';
    check(
      id,
      'the removal needs a reason (the route refuses one without, in words, removing nothing)',
      {
        screen: 'POST /auth/admin/emails/remove',
        user: 'c_admin',
        detail: `HTTP ${noReason.status()} ${nb?.error?.kind ?? ''} ${k} → "${text}"`,
      },
      nb?.ok === false && nb.error?.kind !== 'Unavailable' && !!text && (await live()) === 1,
    );
    const removed = await page.request.post('/auth/admin/emails/remove', {
      data: { id: emailId, reason: `QA catalogue ${id}` },
    });
    if (!removed.ok()) throw new Error(`could not remove ${second}: HTTP ${removed.status()}`);
  }
  const banned =
    (
      await sql<{ b: string | null }>(`select banned_until::text as b from auth.users where id = $1`, [
        addBody.auth_user_id,
      ])
    )[0]?.b ?? null;
  await their.goto('/my-day');
  await their.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  const openAt = pathOf(their);
  const openLine = await doorLine(their);
  check(
    id,
    'the open session with the removed email is refused at its next page',
    {
      screen: '/my-day',
      user: 'c_rmmail',
      detail: `${openAt}${openLine ? ` — "${openLine}"` : ''}`,
      shot: /\/sign-in/.test(openAt) ? undefined : await snap(their, id, 'open-session'),
    },
    /\/sign-in/.test(openAt),
  );
  await ctx.clearCookies();
  await their.goto('/sign-in');
  await tryDoor(their, second, secondPassword);
  const refused = await doorLine(their);
  check(
    id,
    'a new sign-in with the removed email is refused, in words; its auth user is banned',
    {
      screen: '/sign-in',
      user: 'c_rmmail',
      detail: `"${refused}" at ${pathOf(their)} · banned until ${banned ?? 'NOT banned'}`,
    },
    /\/sign-in/.test(pathOf(their)) && refused.length > 3 && !!banned,
  );
  await ctx.close();
});

test('ACC-117 member and viewer type /activity: the no-access state; api.activity refused', async ({ page }) => {
  // /activity (app/(app)/activity/page.tsx: DataState no-access at level none) and api.activity with each person's own
  // session (V97, §8).
  const id = 'ACC-117';
  for (const key of ['member', 'viewer']) {
    await page.context().clearCookies();
    await signIn(page, key, '/activity');
    await hydrated(page);
    const s = await pageState(page);
    const rows = await page.locator('[data-history-row]').count();
    check(
      id,
      'the no-access state, in words, and no activity rows',
      { screen: '/activity', user: key, detail: `no-access ${s.noAccess}, ${rows} rows: "${s.main.slice(0, 100)}"` },
      s.noAccess && rows === 0,
    );
    const r = await (await apiAs(key))('activity', { p_limit: 5 });
    check(
      id,
      'api.activity refused, in words',
      { screen: '(api) activity', user: key, detail: said(r) },
      !r.ok && inWords(r),
    );
  }
});

test('ACC-128 the theme picked in the profile menu follows the person to a second browser', async ({
  page,
  browser,
}) => {
  // The profile chip's menu (ui/shell/ProfileMenu.tsx → core/prefs setPref: a cookie in this browser) against the
  // profile as the source (core.person_profile.theme) and the root layout's <html data-theme> (app/layout.tsx, from
  // the cookie), V201, V9.
  const id = 'ACC-128';
  const who = user('c_theme');
  await signIn(page, 'c_theme', '/my-day');
  await hydrated(page);
  const start = await page.locator('html').getAttribute('data-theme');
  const pick = start === 'dark' ? 'colorful' : 'dark';
  await page.locator('[data-topbar] [data-profile-chip]').click();
  await page.locator(`[data-theme-option="${pick}"]`).click();
  const here = await page.locator('html').getAttribute('data-theme');
  await page.waitForTimeout(1_500);
  const stored =
    (await sql<{ t: string | null }>(`select theme as t from core.person_profile where person_id = $1`, [who.id]))[0]
      ?.t ?? null;
  check(
    id,
    'the choice is saved to the profile (the profile is the source; cookies only cache it)',
    {
      screen: '(profile menu)',
      user: 'c_theme',
      detail: `this browser ${start} → ${here} · profile theme ${stored ?? 'none'}`,
    },
    here === pick && stored === pick,
  );
  const ctx = await browser.newContext();
  const phone = await ctx.newPage();
  await signIn(phone, 'c_theme', '/my-day');
  await hydrated(phone);
  const there = await phone.locator('html').getAttribute('data-theme');
  check(
    id,
    'a second browser (his phone) opens in the theme he picked',
    {
      screen: '/my-day (second browser)',
      user: 'c_theme',
      detail: `${there} (picked ${pick} in the first)`,
      shot: there === pick ? undefined : await snap(phone, id, 'second-browser'),
    },
    there === pick,
  );
  await ctx.close();
});

// ================================================================ WRK — tasks
test('WRK-036 Tasks at level none: no entry in the drawer or the phone bar; the no-access state by address', async ({
  page,
}) => {
  // The drawer and the phone bar with More (ui/shell/Drawer.tsx, BottomBar.tsx from nav.ts) and /tasks by address
  // (app/(app)/tasks/page.tsx: a placeholder that calls Page(), which checks the session only), V125, V209.
  const id = 'WRK-036';
  await signIn(page, 'c_notasks', '/my-day');
  await hydrated(page);
  const entries = await drawerEntries(page);
  check(
    id,
    'no Tasks entry in the drawer',
    { screen: '(drawer)', user: 'c_notasks', detail: `drawer: ${entries.join(', ')}` },
    entries.length > 0 && !entries.includes('Tasks'),
  );
  await page.goto('/tasks');
  await hydrated(page);
  const s = await pageState(page);
  const ok = s.noAccess && !s.empty;
  check(
    id,
    'the address shows the no-access state in words, and nothing of the page',
    {
      screen: '/tasks',
      user: 'c_notasks',
      detail: `no-access state ${s.noAccess}, placeholder drawn ${s.empty}: "${s.main.slice(0, 120)}"`,
      shot: ok ? undefined : await snap(page, id, 'tasks'),
    },
    ok,
  );
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto('/my-day');
  await hydrated(page);
  const bar = page.locator('[data-bottom-bar]');
  const barShown = await bar.isVisible().catch(() => false);
  const onBar = await bar.getByRole('link', { name: 'Tasks', exact: true }).count();
  await page
    .locator('[data-bottom-more]')
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  const sheet = page.locator('[data-more-sheet]');
  const sheetShown = await sheet.isVisible().catch(() => false);
  const inMore = sheetShown ? await sheet.getByRole('link', { name: 'Tasks', exact: true }).count() : 0;
  check(
    id,
    'no Tasks entry on the phone bar or under More',
    {
      screen: '(phone bar)',
      user: 'c_notasks',
      detail: `bar shown ${barShown}: ${onBar} · More shown ${sheetShown}: ${inMore}`,
    },
    barShown && onBar + inMore === 0,
  );
  missing(id, 'task reads refused', { screen: '/tasks', user: 'c_notasks', detail: 'no task reads exist yet (P5-1)' });
});

// ================================================================ OLD — the old app's lessons
test('OLD-001 demoted or switched off while a page is open: on refocus redrawn, or signed out with a message — no reload', async ({
  page,
  browser,
}) => {
  test.slow();
  // The shell after an admin's change: levels come from api.me() once per server answer (core/auth/me-context.tsx:
  // "never fetched again in the browser for the same page load"); the old app re-read access every 90 s and whenever
  // the tab got the focus back (js/50). A: an admin on Settings, demoted to Team member. B: a member, switched off
  // through the admin's own screen (PersonRecord.tsx: person_switch, then /auth/admin/sync bans the auth users).
  const id = 'OLD-001';
  await signIn(page, 'c_refocus', '/settings/work');
  await hydrated(page);
  const controlsBefore = await page.locator('[data-setting-change]').count();
  const drawerBefore = await drawerEntries(page);
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await signIn(b, 'c_refocusoff', '/profile');
  await hydrated(b);

  const demoted = await (
    await apiAs('c_admin')
  )('access_set_person_role', {
    p_person: user('c_refocus').id,
    p_role: await roleId('member'),
    p_reason: `QA catalogue ${id}`,
  });
  if (!demoted.ok) throw new Error(`could not demote c_refocus: ${said(demoted)}`);
  const ctxAdmin = await browser.newContext();
  const adm = await ctxAdmin.newPage();
  await signIn(adm, 'c_admin', `/people/${user('c_refocusoff').id}`);
  await hydrated(adm);
  await adm.locator('[data-person-switch]').click();
  await adm.getByRole('dialog').getByLabel('Reason').fill(`QA catalogue ${id}`);
  await adm.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(toast(adm, /switched off/i)).toBeVisible();
  await ctxAdmin.close();

  for (const p of [page, b]) await refocus(p);
  const readA = async () => ({
    controls: await page
      .locator('[data-setting-change]')
      .count()
      .catch(() => -1),
    settings: (await drawerEntries(page)).includes('Settings'),
    at: pathOf(page),
  });
  const readB = async () => ({ at: pathOf(b), line: await doorLine(b) });
  const doneA = (s: { controls: number; settings: boolean; at: string }) =>
    s.controls === 0 || !s.settings || /\/sign-in/.test(s.at);
  const doneB = (s: { at: string }) => /\/sign-in/.test(s.at);
  let a = await settle(page, readA, doneA, 8_000);
  let bb = await settle(b, readB, doneB, 2_000);
  const onFocusA = doneA(a);
  const onFocusB = doneB(bb);
  let later = '';
  if (!onFocusA || !onFocusB) {
    // the old app's timer: 90 s
    a = await settle(page, readA, doneA, 95_000);
    bb = await settle(b, readB, doneB, 1_000);
    later = ` · after 95 s more: A ${a.controls} controls, drawer Settings ${a.settings}, at ${a.at}; B at ${bb.at}`;
  }
  check(
    id,
    'demoted (admin → Team member): on refocus the Settings controls and the drawer entry go, without a reload',
    {
      screen: '/settings/work',
      user: 'c_refocus',
      detail: `before: ${controlsBefore} setting controls, drawer Settings ${drawerBefore.includes('Settings')} · on refocus: ${onFocusA ? 'redrawn' : 'unchanged'}${later}`,
      shot: onFocusA ? undefined : await snap(page, id, 'demoted'),
    },
    onFocusA,
  );
  check(
    id,
    'switched off: on refocus signed out with a message, without a reload',
    {
      screen: '/profile',
      user: 'c_refocusoff',
      detail: `on refocus: ${onFocusB ? `at ${bb.at} — "${bb.line}"` : `still at ${bb.at}`}${later}`,
      shot: onFocusB ? undefined : await snap(b, id, 'switched-off'),
    },
    onFocusB && bb.line.length > 3,
  );
  await ctxB.close();
});

test('OLD-003 levels slow or missing: no write control before they are known; a worded state after the wait', async ({
  page,
}) => {
  test.slow();
  // Where the levels come from: api.me() on the server before the first paint (core/auth/require-me.ts, get-me.ts),
  // handed to the browser with the page (core/auth/me-context.tsx). The browser's own requests are routed here: any
  // api.me it asks is held and failed, and the server's answer to a navigation (which carries the levels) is late.
  const id = 'OLD-003';
  const meCalls: string[] = [];
  await page.route(
    (u) => API !== '' && u.href.startsWith(`${API}/rest/v1/rpc/me`),
    async (route) => {
      meCalls.push(route.request().method());
      await route.abort('timedout');
    },
  );
  await signIn(page, 'c_slow', '/settings/org');
  await hydrated(page);
  const controls = await page.locator('[data-person-add], [data-team-add]').count();
  await page.goto('/my-day');
  await hydrated(page);
  check(
    id,
    'no write control is drawn before the levels are known (fail closed)',
    {
      screen: '/settings/org',
      user: 'c_slow',
      detail: `the browser asked api.me ${meCalls.length} times (each held and failed here); the levels come with the server's answer before the first paint, and the write controls on /settings/org (${controls}) came with them`,
    },
    meCalls.length === 0 || controls === 0,
  );

  // the server's answer to the next page, 23 s late (every request for /settings… until then, prefetches too)
  const holdUntil = Date.now() + 23_000;
  let held = 0;
  await page.route(
    (u) => u.origin === BASE_URL && u.pathname.startsWith('/settings'),
    async (route) => {
      if (Date.now() < holdUntil) {
        held++;
        await new Promise((r) => setTimeout(r, Math.max(0, holdUntil - Date.now())));
      }
      await route.continue().catch(() => undefined);
    },
  );
  const statusTexts = async () =>
    (
      await page
        .locator('[role="status"], [role="alert"], [aria-busy="true"], [data-state="loading"]')
        .allInnerTexts()
        .catch(() => [] as string[])
    )
      .map(norm)
      .filter(Boolean);
  const before = new Set(await statusTexts());
  await page
    .locator('[data-drawer] a:not([aria-label])')
    .filter({ hasText: /^Settings$/ })
    .first()
    .click();
  await page.waitForTimeout(21_000);
  const said21 = (await statusTexts()).filter((t) => !before.has(t));
  const at21 = pathOf(page);
  const controls21 = await page.locator('[data-person-add], [data-team-add], [data-setting-change]').count();
  check(
    id,
    'no write control of the next page appears while its answer is late',
    { screen: '/my-day → Settings', user: 'c_slow', detail: `after 21 s at ${at21}: ${controls21} write controls` },
    controls21 === 0,
  );
  check(
    id,
    'after 20 s of waiting a worded state is shown — never a blank page or a silent wait',
    {
      screen: '/my-day → Settings',
      user: 'c_slow',
      detail: `${held} requests held; after 21 s at ${at21}, said: ${said21.map((t) => `"${t}"`).join(', ') || 'nothing (the previous page stays as it was)'}`,
      shot: said21.length ? undefined : await snap(page, id, 'late-answer'),
    },
    said21.length > 0,
  );
  await page.waitForURL(/\/settings\//, { timeout: 30_000 }).catch(() => undefined);
  note(id, 'the late answer arrives', { screen: '/settings', user: 'c_slow', detail: pathOf(page) });
  note(id, 'api.me failing on the server itself', {
    user: 'c_slow',
    detail:
      "not exercised: the browser never asks api.me, and a failure of the server's own call for one person cannot be arranged without changing the database for everyone on this stack",
  });
});

test('OLD-009 a save the server refuses: the refusal in words, and the field shows the stored value again', async ({
  page,
}) => {
  // My profile's inline fields (modules/org/screens/MyProfile.tsx TextField → run() → rpc profile_update, checked against
  // the person's version — core.check_version). A real refusal: the stored nickname changed elsewhere after the page was
  // opened, so the save carries a stale version.
  const id = 'OLD-009';
  const who = user('c_refuse');
  const tag = fx().tag;
  const api = await apiAs('c_refuse');
  const versions = async () => ({
    p_version: await profileVersion(who.id),
    p_person_version: await personVersion(who.id),
  });
  const first = await api('profile_update', { p_changes: { nickname_en: `Start${tag}` }, ...(await versions()) });
  if (!first.ok) throw new Error(`set-up: ${said(first)}`);
  await signIn(page, 'c_refuse', '/profile');
  await hydrated(page);
  const field = page.getByLabel(say('profile.nicknameEn'), { exact: true });
  const atOpen = await field.inputValue();
  const elsewhere = await api('profile_update', {
    p_changes: { nickname_en: `Elsewhere${tag}` },
    ...(await versions()),
  });
  if (!elsewhere.ok) throw new Error(`set-up: ${said(elsewhere)}`);
  await field.fill(`Typed${tag}`);
  const line = await nextToast(page, () => field.press('Enter'));
  await page.waitForTimeout(1_500);
  const stored =
    (await sql<{ n: string | null }>(`select nickname_en as n from core.person where id = $1`, [who.id]))[0]?.n ?? null;
  const shown = await field.inputValue();
  const refusedInWords = !!line && !line.includes(say('profile.saved')) && !line.includes(UNAVAILABLE);
  check(
    id,
    'the refusal is said in words',
    { screen: '/profile Nickname', user: 'c_refuse', detail: `toast "${line}"` },
    refusedInWords,
  );
  check(
    id,
    'the field shows the stored value again — never the refused change as if saved',
    {
      screen: '/profile Nickname',
      user: 'c_refuse',
      detail: `opened with "${atOpen}", stored "${stored}", the field shows "${shown}"`,
      shot: shown === stored ? undefined : await snap(page, id, 'refused-field'),
    },
    shown === stored,
  );
  check(
    id,
    'nothing was written',
    { screen: '/profile Nickname', user: 'c_refuse', detail: `stored "${stored}"` },
    stored === `Elsewhere${tag}`,
  );
});

test('OLD-010 open a record and press Save untouched: no write request is sent', async ({ page }) => {
  test.slow();
  // The edit dialogs a person can open today: a person (PersonRecord.tsx saveEdit sends only changed fields), a team and
  // a role (modules/org/screens/OrgAccess.tsx), a list entry (modules/settings/screens/ListEditor.tsx). Every write the
  // browser tries is counted and stopped here (aborted), so nothing is written (OA15).
  const id = 'OLD-010';
  const tag = fx().tag;
  const admin = await apiAs('c_admin');
  const dept = (await sql<{ id: string }>(`select id::text from core.department where code = 'commercial'`))[0]?.id;
  const teamCode = `qa_c_${tag}`;
  const team = await admin('team_save', {
    p_id: null,
    p_department: dept,
    p_code: teamCode,
    p_name_en: `Test Cat team ${tag}`,
    p_name_ar: 'فريق تجريبي',
    p_reason: `QA catalogue ${id}`,
  });
  const listKey = `qa_c_${tag}`;
  const entry = await admin('list_save', {
    p_list: 'priority',
    p_id: null,
    p_values: { key: listKey, name_en: `Test Cat priority ${tag}`, name_ar: 'أولوية تجريبية' },
    p_reason: `QA catalogue ${id}`,
  });
  if (!team.ok || !entry.ok) note(id, 'set-up', { detail: `team ${said(team)} · entry ${said(entry)}` });
  const fns = await writeFns();
  const sent: string[] = [];
  await page.route(
    (u) =>
      (API !== '' && u.href.startsWith(`${API}/rest/v1/`)) ||
      (u.origin === BASE_URL && u.pathname.startsWith('/auth/admin/')),
    async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      const fn = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
      const write = req.method() !== 'GET' && (fn ? fns.has(fn) : true);
      if (!write) return route.continue();
      sent.push(fn ? `api.${fn}` : `${req.method()} ${u.pathname}`);
      return route.abort();
    },
  );
  await signIn(page, 'c_untouched', '/my-day');
  await hydrated(page);
  const edit = new RegExp(`^${escapeRe(say('common.edit'))}\\b`);
  const dialogs: { name: string; screen: string; open: () => Promise<void>; save: string }[] = [
    {
      name: 'a person',
      screen: '/people/[id] Edit',
      open: async () => {
        await page.goto(`/people/${user('c_colleague').id}`);
        await hydrated(page);
        await page.locator('[data-person-edit]').click();
      },
      save: '[data-person-save]',
    },
    {
      name: 'a team',
      screen: '/settings/org?tab=teams Edit',
      open: async () => {
        await page.goto('/settings/org?tab=teams');
        await hydrated(page);
        await page.locator(`[data-team-row="${teamCode}"]`).getByRole('button', { name: edit }).click();
      },
      save: '[data-team-save]',
    },
    {
      name: 'a role',
      screen: '/settings/org?tab=roles Edit',
      open: async () => {
        await page.goto('/settings/org?tab=roles');
        await hydrated(page);
        await page.locator('[data-role-row="viewer"]').getByRole('button', { name: edit }).click();
      },
      save: '[data-role-save]',
    },
    {
      name: 'a list entry',
      screen: '/settings/work Priority Edit',
      open: async () => {
        await page.goto('/settings/work');
        await hydrated(page);
        await page.locator(`[data-list-entry="${listKey}"]`).getByRole('button', { name: edit }).click();
      },
      save: '[data-list-save]',
    },
  ];
  for (const d of dialogs) {
    sent.length = 0;
    let how = '';
    try {
      await d.open();
      const save = page.getByRole('dialog').locator(d.save);
      await save.waitFor({ timeout: 10_000 });
      if (await save.isDisabled()) how = 'Save is disabled until something changes';
      else {
        await save.click();
        how = 'Save pressed';
      }
      await page.waitForTimeout(2_000);
    } catch (e) {
      how = `could not open: ${String(e).slice(0, 100)}`;
    }
    const opened = !how.startsWith('could not');
    check(
      id,
      `Save untouched sends no write (${d.name})`,
      {
        screen: d.screen,
        user: 'c_untouched',
        detail: `${how}; writes sent: ${sent.join(', ') || 'none'}`,
        shot: sent.length || !opened ? await snap(page, id, d.name.replace(/\s+/g, '-')) : undefined,
      },
      opened && sent.length === 0,
    );
    await page.keyboard.press('Escape').catch(() => undefined);
  }
});

test('OLD-011 the network drops during a save: the dialog stays open with what was typed and says it was not saved', async ({
  page,
  context,
}) => {
  // Two dialogs saved with the browser offline (context.setOffline): the person Edit dialog (PersonRecord.tsx → run() →
  // rpc person_update) and a Settings list entry (ListEditor.tsx → rpc list_save). run() says a failure in a toast and
  // leaves the dialog as it is (OA17).
  const id = 'OLD-011';
  const tag = fx().tag;
  const col = user('c_colleague');
  const title = async () =>
    (await sql<{ t: string | null }>(`select job_title_en as t from core.person where id = $1`, [col.id]))[0]?.t ??
    null;
  const notSaved = (line: string) =>
    line.length > 3 && !/updated|saved|allowed/i.test(line) && !/^[a-z_]+(\.[a-z_]+)+$/.test(line);

  await signIn(page, 'c_offline', `/people/${col.id}`);
  await hydrated(page);
  const before = await title();
  await page.locator('[data-person-edit]').click();
  const dialog = page.getByRole('dialog');
  const typed = `Offline title ${tag}`;
  await dialog.getByLabel('Job title', { exact: true }).fill(typed);
  await context.setOffline(true);
  const line = await nextToast(page, () => dialog.locator('[data-person-save]').click(), 20_000);
  const open = await dialog.isVisible();
  const kept = open
    ? await dialog
        .getByLabel('Job title', { exact: true })
        .inputValue()
        .catch(() => '')
    : '';
  const shotPath = await snap(page, id, 'person-offline');
  await context.setOffline(false);
  const after = await title();
  check(
    id,
    'Edit person offline: the dialog stays open with the typed text and says it was not saved',
    {
      screen: '/people/[id] Edit',
      user: 'c_offline',
      detail: `dialog ${open ? 'open' : 'CLOSED'}, field "${kept === typed ? 'as typed' : kept}", toast "${line}", stored ${after === before ? 'unchanged' : 'CHANGED'}`,
      shot: shotPath,
    },
    open && kept === typed && notSaved(line) && after === before,
  );
  await dialog
    .getByRole('button', { name: say('common.cancel'), exact: true })
    .click()
    .catch(() => undefined);

  await page.goto('/settings/work');
  await hydrated(page);
  const key = `qa_off_${tag}`;
  await page.locator('[data-list="priority"] [data-list-add]').click();
  const d2 = page.getByRole('dialog');
  await d2.getByLabel('Key').fill(key);
  await d2.getByLabel('Name', { exact: true }).fill(`Test offline ${tag}`);
  await d2.getByLabel('Name (Arabic)').fill('تجربة بلا شبكة');
  await context.setOffline(true);
  const line2 = await nextToast(page, () => d2.locator('[data-list-save]').click(), 20_000);
  const open2 = await d2.isVisible();
  const kept2 = open2
    ? await d2
        .getByLabel('Key')
        .inputValue()
        .catch(() => '')
    : '';
  const shot2 = await snap(page, id, 'list-entry-offline');
  await context.setOffline(false);
  const rows = Number(
    (await sql<{ n: string }>(`select count(*)::text as n from work.priority where key = $1`, [key]))[0]?.n,
  );
  check(
    id,
    'a Settings list entry offline: the dialog stays open with the typed text and says it was not saved',
    {
      screen: '/settings/work Priority Add',
      user: 'c_offline',
      detail: `dialog ${open2 ? 'open' : 'CLOSED'}, key field "${kept2 === key ? 'as typed' : kept2}", toast "${line2}", ${rows} rows written`,
      shot: shot2,
    },
    open2 && kept2 === key && notSaved(line2) && rows === 0,
  );
});

test('OLD-012 a read-only walk of every page sends no write but the person’s own bookkeeping', async ({ browser }) => {
  test.slow();
  // Every page as a member and as an admin, only opened and read (and Ctrl K searched): the browser's requests — api.*
  // writes are the api schema's volatile functions; any table write; any server action; any POST to the app's own
  // routes — and the server's logged writes (audit.request rows by the person) are counted per page. Allowed: the
  // person's own bookkeeping (device_touch, page_seen, a session refresh). OA16.
  const id = 'OLD-012';
  const fns = await writeFns();
  const common = [
    '/my-day',
    '/overview',
    '/partners?view=clients',
    '/partners?view=suppliers',
    '/pipeline',
    '/projects',
    '/tasks',
    '/finance',
    '/kpis',
    '/reports',
    '/appraisal',
    '/activity',
    '/activity?tab=settings',
    '/activity?tab=signIns',
    '/profile',
  ];
  const admin = [
    '/settings/org',
    '/settings/org?tab=teams',
    '/settings/org?tab=roles',
    '/settings/org?tab=access',
    '/settings/org?tab=settings',
    '/settings/app',
    '/settings/finance',
    '/settings/partners',
    '/settings/performance',
    '/settings/work',
  ];
  for (const key of ['c_walkmember', 'c_walkadmin']) {
    const me = user(key);
    const col = user('c_colleague');
    const pages = [
      ...common,
      `/people/${me.id}`,
      `/people/${me.id}?tab=activity`,
      `/people/${col.id}`,
      `/people/${col.id}?tab=activity`,
      ...(key === 'c_walkadmin' ? admin : []),
    ];
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page, key, '/my-day');
    await hydrated(page);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const sent = watchWrites(page, fns);
    const bad: string[] = [];
    const kept: string[] = [];
    const visit = async (label: string, go: () => Promise<unknown>) => {
      sent.length = 0;
      const before = await requestsBy(me.id);
      await go();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(400);
      const logged = (await requestsBy(me.id)) - before;
      const writes = sent.filter((s) => !s.allowed).map((s) => s.name);
      if (writes.length || logged)
        bad.push(`${label}: ${[...writes, ...(logged ? [`${logged} logged on the server`] : [])].join(', ')}`);
      const bookkeeping = sent.filter((s) => s.allowed).map((s) => s.name);
      if (bookkeeping.length) kept.push(`${label}: ${bookkeeping.join(', ')}`);
    };
    for (const path of pages)
      await visit(path.replace(me.id, '[self]').replace(col.id, '[colleague]'), async () => {
        await page.goto(path).catch(() => undefined);
        await hydrated(page, 8_000);
      });
    await visit('Ctrl K search', async () => {
      await page.goto('/my-day');
      await hydrated(page);
      await page.keyboard.press('Control+k');
      await page.keyboard.type('Test', { delay: 50 });
      await page.waitForTimeout(1_500);
      await page.keyboard.press('Escape');
    });
    check(
      id,
      'a read-only walk sends no write, page by page',
      {
        screen: `${pages.length} pages + Ctrl K`,
        user: key,
        detail: bad.length ? bad.join(' | ') : 'no write on any page',
      },
      bad.length === 0,
    );
    note(id, 'the bookkeeping the walk sent (allowed)', {
      user: key,
      detail: kept.join(' | ') || 'none from the browser',
    });
    await ctx.close();
  }
});
