import { expect, type BrowserContext, type Cookie, type Page } from '@playwright/test';
import { makePerson, signIn, sql } from './support/stack';

export const THEMES = ['light', 'dark', 'direct'] as const;
export type Theme = (typeof THEMES)[number];
export const BASE = 'http://127.0.0.1:9300';

export async function setPrefs(
  ctx: BrowserContext,
  prefs: Partial<{ theme: string; density: string; drawer: string; locale: string; dir: string }>,
) {
  await ctx.addCookies(Object.entries(prefs).map(([k, v]) => ({ name: `v2.${k}`, value: v, url: BASE })));
  // a signed-in person's theme and density come from their profile (V636), so these are written there too, when `open` signs in
  if (prefs.theme !== undefined || prefs.density !== undefined) {
    const before = wanted.get(ctx) ?? {};
    wanted.set(ctx, { theme: prefs.theme ?? before.theme, density: prefs.density ?? before.density });
  }
}

const wanted = new WeakMap<BrowserContext, { theme?: string; density?: string }>();
let person: { id: string } | null = null;

/** The theme and density a spec asked for sit on the signed-in person's profile; a spec that asked for none sees the defaults. */
async function applyProfile(ctx: BrowserContext) {
  if (!person) return;
  const w = wanted.get(ctx) ?? {};
  await sql(
    `insert into core.person_profile (person_id, created_by, theme, density) values ($1, $1, $2, $3)
       on conflict (person_id) do update set theme = $2, density = $3`,
    [person.id, w.theme ?? null, w.density ?? null],
  );
}

/** Grow the viewport to the whole scrolling page so a screenshot shows everything (the shell scrolls inside). */
export async function fitToPage(page: Page, width: number) {
  const h = await page.evaluate(() => {
    const el = document.querySelector('[data-page]') ?? document.body;
    return Math.max(document.documentElement.scrollHeight, el.scrollHeight + (el.getBoundingClientRect().top || 0));
  });
  await page.setViewportSize({ width, height: Math.min(Math.max(h + 24, 700), 6000) });
}

export async function expectNoConsoleErrors(page: Page, run: () => Promise<void>) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/hmr|WebSocket|favicon/i.test(m.text())) errors.push(m.text());
  });
  await run();
  expect(errors, 'console errors').toEqual([]);
}

// One made-up admin per worker signs in through the real door once (tests/e2e/support/stack.ts); the browsers that
// follow carry their session cookies, so a screen spec spends its time on the screen, not on the mail catcher.
let session: Cookie[] | null = null;

/** Open a page signed in (through the stack's door on the first call) and wait until it is hydrated. */
export async function open(page: Page, path: string) {
  const isDoor = path.startsWith('/sign-in');
  if (session && !isDoor) await page.context().addCookies(session);
  if (!isDoor) await applyProfile(page.context());
  await page.goto(path);
  if (!isDoor && /\/sign-in(\?|$)/.test(page.url())) {
    const made = await makePerson({ admin: true });
    person = { id: made.id };
    await applyProfile(page.context());
    await signIn(page, made.email, path);
    session = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
  }
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
}

/**
 * Where a spec saves its screenshot. Runs write into the ignored test-results/ folder (CI uploads it), so a run never
 * dirties the tree — the sabotage runner checks that. `SCREENSHOT_DIR=tests/e2e/screenshots pnpm test:e2e` refreshes
 * the committed set that the PR shows.
 */
export function shot(name: string): string {
  return `${process.env.SCREENSHOT_DIR ?? 'test-results/screenshots'}/${name}.png`;
}
