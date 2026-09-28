import { expect, type BrowserContext, type Page } from '@playwright/test';

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

/** Open a page and wait until it is hydrated (the dev server hydrates late; a click before that is lost). */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
}
