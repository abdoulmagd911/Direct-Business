import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { calendarDay } from '@/core/print/report/format';
import type { ReportDoc } from '@/core/print/report/model';
import { paletteFromTokensCss } from '@/core/print/palette';
import { reportPptx } from '@/core/print/report/pptx/reportPptx';
import { readPdf, renderReportPdf, V2, type PdfPage } from './pdf-tools';
import { paragraphs, readDeck, type Deck } from './pptx-tools';
import { sampleReport } from './sample-report';

/**
 * What the bulletproof audit of P3-10 found (V402, V301), kept as tests: a section with nothing in it still gets its
 * page in both documents (the PPTX once dropped it), text with XML's special characters prints as typed, forty long
 * lines flow over several pages and slides without anything lost, and a date that is not a calendar day is refused
 * by name instead of printing "Invalid Date".
 * Sabotage: `pptx-drops-an-empty-section` (tests/sabotage/export.mjs).
 */
const longAr = 'سطر طويل جداً مع Test Co A والرقم INV-T-0001 '.repeat(6);
const longEn = 'A long English line with Test Co A and INV-T-0001 '.repeat(5);
const awkward: ReportDoc = {
  ...sampleReport,
  sections: [
    { kind: 'lines', key: 'empty', title: { ar: 'قسم فارغ', en: 'Empty section' }, groups: [] },
    {
      kind: 'lines',
      key: 'xml',
      title: { ar: 'رموز خاصة', en: 'Special characters' },
      groups: [
        {
          title: null,
          lines: [
            { text: { ar: 'أ < ب & ج > د "هـ"', en: '<b>bold?</b> & "quoted" \'too\'' } },
            // A draft's line typed in English, its Arabic not written yet.
            { text: { ar: '', en: 'English only for now, Arabic to follow.' } },
          ],
        },
      ],
    },
    {
      kind: 'lines',
      key: 'long',
      title: { ar: 'طويل', en: 'Long' },
      groups: [
        {
          title: { ar: 'فئة', en: 'Category' },
          lines: Array.from({ length: 40 }, (_, i) => ({
            text: { ar: `${i + 1}. ${longAr}`, en: `${i + 1}. ${longEn}` },
          })),
        },
      ],
    },
  ],
};

const got = {} as Record<'ar' | 'en', { pdf: PdfPage[]; deck: Deck }>;
beforeAll(async () => {
  const palette = paletteFromTokensCss(fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8'));
  for (const lang of ['ar', 'en'] as const)
    got[lang] = {
      pdf: await readPdf(await renderReportPdf(lang, awkward)),
      deck: await readDeck(await reportPptx(awkward, lang, { palette, logoPng: null, logoAspect: 2 })),
    };
});

describe('awkward reports still print every section, and a bad date is refused', () => {
  for (const lang of ['ar', 'en'] as const) {
    const title = lang === 'ar' ? 'قسم فارغ' : 'Empty section';

    it(`gives an empty section its page and its slide (${lang})`, () => {
      expect(
        got[lang].pdf.some((p) => p.items.some((i) => i.str.includes(title))),
        'the PDF page',
      ).toBe(true);
      expect(
        got[lang].deck.slides.some((x) => paragraphs(x).some((p) => p.text === title)),
        'the empty section has its slide',
      ).toBe(true);
    });

    it(`prints XML's special characters as typed (${lang})`, () => {
      const want = lang === 'ar' ? 'أ < ب & ج > د "هـ"' : '<b>bold?</b> & "quoted" \'too\'';
      expect(
        got[lang].deck.slides.flatMap(paragraphs).some((p) => p.text.includes(want)),
        'in the PPTX',
      ).toBe(true);
      const pdfText = got[lang].pdf.flatMap((p) => p.items.map((i) => i.str)).join(' ');
      expect(pdfText, 'in the PDF').toContain(lang === 'ar' ? '&' : '<b>bold?</b>');
    });

    it(`flows forty long lines over several pages and slides and loses none (${lang})`, () => {
      const onSlides = got[lang].deck.slides.flatMap(paragraphs).filter((p) => /^•\s+\d+\. /.test(p.text));
      expect(
        onSlides.map((p) => Number(/\d+/.exec(p.text)?.[0])),
        'every line on a slide, in order',
      ).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
      const longSlides = got[lang].deck.slides.filter((x) => paragraphs(x).some((p) => /^•\s+\d+\. /.test(p.text)));
      expect(longSlides.length, 'more than one slide').toBeGreaterThan(2);
      expect(got[lang].pdf.length, 'more than one page for the long section').toBeGreaterThan(4);
    });
  }

  it('prints a draft line that has no Arabic yet in English, left to right, inside the Arabic deck', () => {
    const p = got.ar.deck.slides.flatMap(paragraphs).find((x) => x.text.includes('English only for now'));
    expect(p, 'the English-only line is printed, not left blank').toBeDefined();
    expect(p?.rtl).toBe(false);
    const pdfText = got.ar.pdf.flatMap((pg) => pg.items.map((i) => i.str)).join(' ');
    expect(pdfText).toContain('English only for now');
  });

  it('refuses a date that is not a calendar day, naming it, before any rendering', async () => {
    expect(calendarDay('2026-09-30').toISOString()).toBe('2026-09-30T12:00:00.000Z');
    for (const bad of ['2026-02-30', '30/09/2026', '2026-09-30T10:00:00Z', ''])
      expect(() => calendarDay(bad), bad).toThrow(/is not a calendar date/);
    await expect(renderReportPdf('ar', { ...sampleReport, issuedOn: '05/10/2026' })).rejects.toThrow(/05\/10\/2026/);
    const palette = paletteFromTokensCss(fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8'));
    await expect(
      reportPptx({ ...sampleReport, period: { start: '2026-09-30', end: '2026-09-01' } }, 'ar', {
        palette,
        logoPng: null,
        logoAspect: 2,
      }),
    ).rejects.toThrow(/ends \(2026-09-01\) before it starts/);
  });
});
