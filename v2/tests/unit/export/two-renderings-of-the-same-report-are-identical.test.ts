import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderReportPdf } from './pdf-tools';
import { renderReportPptx } from './pptx-tools';

/**
 * The same frozen report makes the same file, whenever it is downloaded (plan P6-2: "two renderings of the same
 * snapshot are identical"): the PDF's own dates are the report's, never the moment of rendering. The clock is moved
 * a day between the two renderings, so a date taken from "now" would show.
 * Sabotages: `pdf-stamps-the-download-time`, `pptx-stamps-the-download-time` (tests/sabotage/export.mjs).
 */
afterEach(() => {
  vi.useRealTimers();
});

describe('two renderings of the same report are identical', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`gives the same bytes a day apart (${lang})`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-05T09:00:00Z'));
      const first = await renderReportPdf(lang);
      vi.setSystemTime(new Date('2026-10-06T15:30:00Z'));
      const second = await renderReportPdf(lang);
      expect(second.equals(first), 'the second rendering differs from the first').toBe(true);
    });

    it(`gives the same PPTX bytes a day apart (${lang})`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-05T09:00:00Z'));
      const first = Buffer.from(await renderReportPptx(lang));
      vi.setSystemTime(new Date('2026-10-06T15:30:00Z'));
      const second = Buffer.from(await renderReportPptx(lang));
      expect(second.equals(first), 'the second deck differs from the first').toBe(true);
    });
  }
});
