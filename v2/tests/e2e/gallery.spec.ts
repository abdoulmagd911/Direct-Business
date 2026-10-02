/**
 * The localhost preview gallery for QA (the oversight, 29 Sep 15:57): every route, as every role, in every state the
 * screen can be put in from outside — empty (a fresh stack), filled (made-up people, a team and a list value), no
 * access (a role at none) and failed (the browser's own reads cut) — screenshotted at 1,500 and 400 px into
 * test-results/gallery/<role>/<route>-<state>-<width>.png with an index.html beside them. The map of routes and states
 * is docs/v2/PREVIEW-GALLERY.md. Run: `GALLERY=1 pnpm test:e2e tests/e2e/gallery.spec.ts --workers=1`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { fitToPage } from './helpers';
import { makePerson, signIn, sql } from './support/stack';

test.skip(!process.env.GALLERY, 'the gallery runs on demand: GALLERY=1');
test.describe.configure({ mode: 'serial' });

const OUT = 'test-results/gallery';
// bd_member: a member in Business Development or Business Solutions, Pipeline Own by a person change (V217, brief E)
const ROLES = ['admin', 'head', 'manager', 'member', 'bd_member', 'viewer', 'none'] as const;
type Role = (typeof ROLES)[number];

type Shot = { role: Role; route: string; state: string; width: number; file: string };
const shots: Shot[] = [];

const slug = (route: string) =>
  route
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'root';

async function snap(page: Page, role: Role, route: string, state: string) {
  for (const width of [1500, 400] as const) {
    await page.setViewportSize({ width, height: 900 });
    await fitToPage(page, width);
    const file = `${role}/${slug(route)}-${state}-${width}.png`;
    await page.screenshot({ path: `${OUT}/${file}` });
    shots.push({ role, route, state, width, file });
  }
}

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

/** A person in the role; `none` is a role with no level anywhere; `bd_member` a member with Pipeline Own. */
async function personIn(role: Role) {
  const person = await makePerson({ admin: role === 'admin' });
  if (role === 'bd_member')
    await sql(
      `insert into core.person_page_level (person_id, page_key, level, reason, created_by)
       values ($1, 'pipeline', 'own', 'Made up: BD/BS team, ruling 30 Sep', $1)`,
      [person.id],
    );
  if (role === 'none')
    await sql(
      `insert into core.role (key, name_en, name_ar, is_admin) values ('test_none', 'Test None', 'بلا صلاحية', false)
       on conflict (key) do nothing`,
    );
  if (role !== 'admin' && role !== 'member' && role !== 'bd_member')
    await sql(`update core.person set role_id = (select id from core.role where key = $2) where id = $1`, [
      person.id,
      role === 'none' ? 'test_none' : role,
    ]);
  return person;
}

/** The "filled" state: a few made-up people, a team, and the seeded person's profile. */
async function seedFilled() {
  const tag = Date.now().toString(36);
  const people = await Promise.all([makePerson(), makePerson(), makePerson()]);
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [people[0]!.id, `tg_${tag}`, `Test Team Gallery ${tag}`, `فريق المعرض ${tag}`],
  );
  await sql(`update core.person set team_id = $2, job_title_en = 'Made-up title' where id = any($1::uuid[])`, [
    people.map((p) => p.id),
    team!.id,
  ]);
  return { people, team: team! };
}

const ROUTES = [
  '/my-day',
  '/overview',
  '/clients',
  '/suppliers',
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
  '/profile',
  '/settings',
  '/settings/org',
  '/settings/org?tab=teams',
  '/settings/org?tab=access',
  '/settings/org?tab=lists',
  '/settings/app',
  '/kit',
];

test('the gallery: every route as every role, in every reachable state', async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const filled = await seedFilled();
  for (const role of ROLES) {
    mkdirSync(`${OUT}/${role}`, { recursive: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const person = await personIn(role);
    await signIn(page, person.email, '/my-day');
    for (const route of ROUTES) {
      await page.goto(route);
      await hydrated(page);
      const state = (await page.locator('[data-state="no-access"]').count())
        ? 'no-access'
        : (await page.locator('[data-state="empty"]').count())
          ? 'empty'
          : 'filled';
      await snap(page, role, route, state);
    }
    // a person's record: filled (a made-up colleague) — and this person's own
    for (const [route, state] of [
      [`/people/${filled.people[0]!.id}`, 'filled'],
      [`/people/${person.id}`, 'own'],
    ] as const) {
      await page.goto(route);
      await hydrated(page);
      await snap(page, role, route.replace(/[0-9a-f-]{36}/, 'id'), state);
    }
    // failed: the browser's own reads cut — the bell, and a save from My profile
    await page.goto('/profile');
    await hydrated(page);
    await page.route('**/rest/v1/rpc/**', (r) => r.abort());
    await page.getByLabel('Display name', { exact: true }).fill('Gallery');
    await page.getByLabel('Display name', { exact: true }).press('Enter');
    await page
      .locator('[data-sonner-toast]')
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    await snap(page, role, '/profile', 'failed');
    await page.unroute('**/rest/v1/rpc/**');
    await ctx.close();
  }
  // the door, signed out
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Commercial Workspace' })).toBeVisible();
  await snap(page, 'none', '/sign-in', 'empty');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await snap(page, 'none', '/sign-in', 'invalid');
  await ctx.close();

  const rows = shots
    .map(
      (s) =>
        `<tr><td>${s.role}</td><td><code>${s.route}</code></td><td>${s.state}</td><td>${s.width}</td>` +
        `<td><a href="${s.file}"><img src="${s.file}" loading="lazy" style="max-width:360px"></a></td></tr>`,
    )
    .join('\n');
  writeFileSync(
    `${OUT}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Preview gallery</title>` +
      `<style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse}td{border:1px solid #ccc;padding:6px;vertical-align:top}</style>` +
      `<h1>Preview gallery — ${shots.length} screenshots</h1><table><tr><th>Role</th><th>Route</th><th>State</th><th>Width</th><th>Shot</th></tr>${rows}</table>`,
  );
  expect(shots.length).toBeGreaterThan(0);
});
