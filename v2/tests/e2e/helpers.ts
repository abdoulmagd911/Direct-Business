import { expect, type BrowserContext, type Cookie, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

export const THEMES = ['light', 'dark', 'colorful', 'direct'] as const;
export type Theme = (typeof THEMES)[number];
export const BASE = 'http://127.0.0.1:9300';

export async function setPrefs(
  ctx: BrowserContext,
  prefs: Partial<{ theme: string; density: string; drawer: string; locale: string; dir: string }>,
) {
  await ctx.addCookies(Object.entries(prefs).map(([k, v]) => ({ name: `v2.${k}`, value: v, url: BASE })));
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
  await page.goto(path);
  if (!isDoor && /\/sign-in(\?|$)/.test(page.url())) {
    const person = await makePerson({ admin: true });
    await signIn(page, person.email, path);
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
