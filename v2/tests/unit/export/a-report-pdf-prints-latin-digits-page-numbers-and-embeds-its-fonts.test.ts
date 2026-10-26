import { beforeAll, describe, expect, it } from 'vitest';
import { readPdf, renderReportPdf, type PdfPage } from './pdf-tools';

/**
 * What a person holding the PDF must find (plan P3-10, V40, V301): Latin digits only — even where the report's text
 * was typed with Arabic-Indic ones; "Page n of m" on every page after the cover, in the document's language; IBM Plex
 * Sans Arabic, Readex Pro and IBM Plex Mono embedded (subset) and no built-in PDF font, which cannot draw Arabic;
 * the document's language declared for screen readers.
 * Sabotages: `pdf-prints-arabic-digits`, `pdf-drops-page-numbers`, `pdf-falls-back-to-a-built-in-font`
 * (tests/sabotage/export.mjs).
 */
const ARABIC_DIGITS = /[\u{0660}-\u{0669}\u{06F0}-\u{06F9}\u{066A}-\u{066C}]/u;

const docs: Record<'ar' | 'en', { bytes: Buffer; pages: PdfPage[] }> = {} as never;
beforeAll(async () => {
  for (const lang of ['ar', 'en'] as const) {
    const bytes = await renderReportPdf(lang);
    docs[lang] = { bytes, pages: await readPdf(bytes) };
  }
});

describe('a report PDF prints Latin digits and page numbers, and embeds its fonts', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`prints no Arabic-Indic digit (${lang})`, () => {
      const found = docs[lang].pages.flatMap((p) => p.items.filter((i) => ARABIC_DIGITS.test(i.str)).map((i) => i.str));
      expect(found, 'an Arabic-Indic digit or sign reached the page').toEqual([]);
      // The sample's line typed with "٣" and "١٢٫٥٪" is on the page with Latin digits.
      const text = docs[lang].pages.flatMap((p) => p.items.map((i) => i.str)).join(' ');
      expect(text).toMatch(/7\.5%|%7\.5/);
    });

    it(`numbers every page after the cover (${lang})`, () => {
      const { pages } = docs[lang];
      const total = pages.length;
      pages.slice(1).forEach((page, i) => {
        const n = i + 2;
        const label = lang === 'ar' ? `صفحة ${n} من ${total}` : `Page ${n} of ${total}`;
        expect(
          page.items.some((it) => it.str === label && it.y < 40),
          `page ${n} carries "${label}" in its footer`,
        ).toBe(true);
      });
      expect(
        pages[0]?.items.some((it) => /صفحة|Page \d/.test(it.str)),
        'the cover has no page number',
      ).toBe(false);
    });

    it(`embeds the document fonts and no built-in one (${lang})`, () => {
      const raw = docs[lang].bytes.toString('latin1');
      const fonts = [...raw.matchAll(/\/BaseFont \/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map((m) => m[1]);
      for (const want of ['IBMPlexSansArabic', 'ReadexPro-SemiBold', 'IBMPlexMono'])
        expect(fonts, `${want} is embedded`).toContain(want);
      expect(
        fonts.filter((f) => /Helvetica|Times|Courier|Symbol|ZapfDingbats/.test(f ?? '')),
        'a built-in PDF font',
      ).toEqual([]);
      expect(raw.match(/\/FontFile2/g)?.length, 'every font carries its own file').toBe(new Set(fonts).size);
      expect(raw).toContain(`/Lang (${lang === 'ar' ? 'ar-SA' : 'en-GB'})`);
    });
  }
});
