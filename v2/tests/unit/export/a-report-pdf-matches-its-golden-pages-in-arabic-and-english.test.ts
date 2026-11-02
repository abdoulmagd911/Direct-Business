import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareWithGolden, GOLDEN_DIR, readPdf, renderReportPdf, UPDATING } from './pdf-tools';

/**
 * The golden PDF test (plan P3-10, V301). The made-up monthly report is drawn in Arabic and in English, each page is
 * rasterised by pdf.js, and every page must match its golden PNG in `tests/unit/export/golden/` — the pages a person
 * checked by eye against Chrome's own rendering of the same lines (letters joined, right to left, Latin digits,
 * tables, page numbers). The golden PDFs themselves sit beside them, as the samples the PR shows.
 *
 * Refresh on purpose only: `UPDATE_GOLDEN=1 pnpm exec vitest run tests/unit/export/`, look at every changed PNG, and
 * say why in the PR. A failing run leaves `test-results/export/<page>.actual.png` and `.diff.png`.
 * Sabotage: `pdf-tile-grows` (tests/sabotage/export.mjs).
 */
describe('a report PDF matches its golden pages', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`matches every golden page in ${lang === 'ar' ? 'Arabic' : 'English'}`, async () => {
      const bytes = await renderReportPdf(lang);
      const pages = await readPdf(bytes);
      const goldenPages = () =>
        fs.existsSync(GOLDEN_DIR)
          ? fs.readdirSync(GOLDEN_DIR).filter((f) => f.startsWith(`report-${lang}.p`) && f.endsWith('.png'))
          : [];
      if (UPDATING) {
        fs.mkdirSync(GOLDEN_DIR, { recursive: true });
        for (const f of goldenPages()) fs.rmSync(path.join(GOLDEN_DIR, f));
        fs.writeFileSync(path.join(GOLDEN_DIR, `report-${lang}.pdf`), bytes);
      }
      for (const [i, page] of pages.entries()) {
        const name = `report-${lang}.p${i + 1}`;
        const { differing, budget, golden } = await compareWithGolden(page, name);
        expect(
          differing,
          `${name}: ${differing} pixels differ from its golden ${path.basename(golden)} (at most ${budget})`,
        ).toBeLessThanOrEqual(budget);
      }
      expect(pages.length, 'the page count of the golden set').toBe(goldenPages().length);
    });
  }
});
