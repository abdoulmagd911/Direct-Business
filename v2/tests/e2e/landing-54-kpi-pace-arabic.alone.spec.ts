/**
 * Landing 54 — Reports → KPI pace in Arabic, wide and on a phone. It runs alone (Arabic is one setting for
 * everyone), under the Arabic specs' one database lock (support/arabic.ts); the person reads Arabic because they
 * saved it. The page is right to left with the design's words — وتيرة مؤشرات الأداء, المسؤول, الهدف الشهري,
 * المحقق حتى الآن, السنة, اليوم, عرضها — the same Western digits as in English, the drawing mirrored; at 1440 px
 * and at 375 px nothing scrolls sideways. Every value is made up.
 * With L54_SHOTS set to a folder, each view is saved there as a picture (for the builder's own look; nothing reads it).
 * Sabotage: tests/sabotage/landing-54-e2e.mjs.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { readsArabic, withArabicOn } from './support/arabic';
import { signedInAs } from './support/landing-32';
import { PHONE, sideways } from './support/landing-34';
import { seedPace } from './support/landing-54';

const SHOTS = process.env.L54_SHOTS;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('Arabic: KPI pace reads right to left with the design’s words, wide and on a phone', async ({ page, browser }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const seed = await seedPace(page, browser);
  try {
    await withArabicOn(seed.admin.id, 'made up: the KPI pace page in Arabic', async () => {
      await readsArabic(seed.manager.id);
      const m = await signedInAs(browser, seed.manager, `/reports/kpi-pace?month=${seed.last}`);
      const mp = m.page;
      await expect(mp.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(mp.getByRole('heading', { level: 1, name: 'وتيرة مؤشرات الأداء' })).toBeVisible();
      await expect(mp.locator('[data-pace-kpi]')).toHaveCount(3);
      const problem = mp.locator('[data-pace-kpi="PROBLEM"]');
      await expect(problem).toContainText('المسؤول');
      await expect(problem).toContainText('الهدف الشهري');
      await expect(problem).toContainText('المحقق حتى الآن');
      await expect(problem.locator('[data-pace-pct]')).toHaveText('100%');
      await expect(problem.locator('[data-pace-status]')).toHaveText('على المسار');
      await expect(problem.getByRole('link', { name: 'عرضها' })).toBeVisible();
      await expect(mp.locator('[data-pace-years]')).toContainText('السنة');
      await expect(mp.locator('[data-pace-count="behind"]')).toHaveText('1');
      // the drawing is mirrored: its box is flipped sideways, so the month starts at the right
      const flipped = await mp.locator('[data-pace-chart] svg').evaluate((el) => getComputedStyle(el).scale);
      expect(flipped.split(' ')[0], 'the drawing is mirrored').toBe('-1');
      expect(await sideways(mp), 'nothing scrolls sideways at 1440 px').toBeLessThanOrEqual(0);
      await shot(mp, 'arabic-last-month-1440');

      await mp.goto('/reports/kpi-pace');
      await expect(mp.locator('[data-pace-today]')).toContainText('اليوم');
      await shot(mp, 'arabic-this-month-1440');

      await mp.setViewportSize(PHONE);
      await mp.goto(`/reports/kpi-pace?month=${seed.last}`);
      await expect(mp.locator('[data-pace-kpi]')).toHaveCount(3);
      expect(await sideways(mp), 'nothing scrolls sideways at 375 px').toBeLessThanOrEqual(0);
      await shot(mp, 'arabic-last-month-375');
      await m.context.close();
    });
  } finally {
    await seed.close();
  }
});
