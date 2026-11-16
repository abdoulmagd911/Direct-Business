/**
 * Landing 31 · the look bar, shared by the English spec and the Arabic (alone) one: on each key screen, in each of
 * the five themes, at a PC and a phone width — the page wears the theme, nothing scrolls sideways, and no visible
 * word is drawn under 12 px.
 */
import { expect, type Page } from '@playwright/test';
import { sql } from './stack';

export const LOOK_THEMES = ['light', 'dark', 'direct', 'turquoise', 'system'] as const;
export const LOOK_SCREENS = ['/my-day', '/partners', '/finance', '/tasks', '/settings/org', '/profile'] as const;

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** Words drawn smaller than 12 px, as "size · the words" (visible elements only; screen-reader-only text is not drawn). */
export const smallWords = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('body *')) {
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!own) continue;
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      if (s.visibility === 'hidden' || s.display === 'none' || b.width <= 1 || b.height <= 1) continue;
      if (e.closest('.sr-only')) continue;
      const size = parseFloat(s.fontSize);
      if (size < 12) out.push(`${size} · ${(e.textContent ?? '').trim().slice(0, 40)}`);
    }
    return out;
  });

export async function walkLook(page: Page, personId: string, width: number, dir: 'ltr' | 'rtl'): Promise<void> {
  await page.setViewportSize({ width, height: width < 700 ? 800 : 1000 });
  for (const theme of LOOK_THEMES) {
    await sql(
      `insert into core.person_profile (person_id, created_by, theme) values ($1, $1, $2)
         on conflict (person_id) do update set theme = excluded.theme`,
      [personId, theme],
    );
    for (const path of LOOK_SCREENS) {
      const at = `${path} · ${theme} · ${width} px · ${dir}`;
      await page.goto(path);
      await hydrated(page);
      await expect(page.locator('html'), `${at}: the page wears the theme`).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html'), `${at}: the direction`).toHaveAttribute('dir', dir);
      await expect(page.locator('#main h1, #main [data-day-banner]').first(), `${at}: the page is drawn`).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${at}: nothing scrolls sideways`).toBeLessThanOrEqual(0);
      expect(await smallWords(page), `${at}: no word is under 12 px`).toEqual([]);
    }
  }
}
