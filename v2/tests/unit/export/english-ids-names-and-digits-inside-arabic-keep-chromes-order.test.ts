import path from 'node:path';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { createElement as h, type ReactNode } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatNumber } from '@/core/i18n/format';
import { FONT, registerDocFonts } from '@/core/print/fonts';
import type { Lang } from '@/core/print/report/model';
import { direction } from '@/core/print/report/pdf/direction';
import { readPdf, V2, xOf, type PdfPage } from './pdf-tools';

/**
 * Inside an Arabic sentence, English names, IDs, dates and Latin digits must keep the order Chrome gives them — the
 * Unicode bidi algorithm's order, which is what the same line shows on screen (checked by eye on 29 Sep: react-pdf's
 * and Chrome's renderings of these lines are the same). Each English token is set in the mono font so pdf.js reads it
 * back as its own item with its own position; the expected orders below are Chrome's.
 * Sabotage: `pdf-forgets-right-to-left` (tests/sabotage/export.mjs).
 */

type Part = string | { t: string };
/** `order` names each token by its first word: pdf.js may split a run at its spaces. */
const PROBES: { lang: Lang; parts: Part[]; order: string[] }[] = [
  {
    // Logical order INV → DK → 7,250: in Arabic the first is the rightmost.
    lang: 'ar',
    parts: ['رقم الفاتورة ', { t: 'INV-T-0001' }, ' والعميل ', { t: 'DK-P-0001' }, ' بقيمة ', { t: '7,250' }, ' ريال.'],
    order: ['INV-T-0001', 'DK-P-0001', '7,250'],
  },
  {
    // An Arabic line that opens with an English name still reads from the right: the name is at the right edge.
    lang: 'ar',
    parts: [{ t: 'Test Co A' }, ' وقّعت اتفاقية بقيمة ', { t: 'SAR 7,250' }, ' بتاريخ ', { t: '12/07/2026' }, '.'],
    order: ['Test', 'SAR', '12/07/2026'],
  },
  {
    lang: 'ar',
    parts: ['مع ', { t: 'Sample Travel LLC' }, ' خلال ', { t: 'Q1–Q2' }, ' والعدد ', { t: '310' }, '.'],
    order: ['Sample', 'Q1–Q2', '310'],
  },
  {
    // The English report keeps left-to-right order around an Arabic name.
    lang: 'en',
    parts: ['Signed with ', 'شركة تيست', ' on ', { t: '12/07/2026' }, ' as ', { t: 'DK-P-0001' }, '.'],
    order: ['12/07/2026', 'DK-P-0001'],
  },
];

/**
 * Negative numbers. A person who types "-1,500" in Arabic text gets what Chrome shows for it: the bidi algorithm
 * sets the minus on the reading side of the digits (drawn "1,500-"). A figure the app formats carries a
 * left-to-right mark (Intl's Arabic format), so the minus stays on the digits' left — both read back from the PDF.
 */
const MINUS: Part[] = ['خسارة ', { t: '-1,500' }, ' ومبلغ ', { t: formatNumber(-2500, 'ar') }, ' فقط.'];

let pages: PdfPage[];
beforeAll(async () => {
  registerDocFonts((f) => path.join(V2, 'public/fonts/doc', f));
  const para = (lang: Lang, parts: Part[], key: number): ReactNode => {
    const d = direction(lang);
    return h(
      Text,
      {
        key,
        style: { direction: d.text, textAlign: d.alignStart, fontFamily: FONT.body, fontSize: 14, marginBottom: 18 },
      },
      ...parts.map((p, i) =>
        typeof p === 'string' ? p : h(Text, { key: i, style: { fontFamily: FONT.mono, direction: d.text } }, p.t),
      ),
    );
  };
  const doc = h(
    Document,
    null,
    ...[...PROBES, { lang: 'ar' as Lang, parts: MINUS }].map((probe, i) =>
      h(Page, { key: i, size: [700, 140], style: { padding: 30 } }, para(probe.lang, probe.parts, i)),
    ),
  );
  pages = await readPdf(await renderToBuffer(doc));
});

describe("English IDs, names and digits inside Arabic keep Chrome's order", () => {
  PROBES.forEach((probe, i) => {
    it(`${probe.lang}: ${probe.order.join(' → ')}`, () => {
      const page = pages[i] as PdfPage;
      const xs = probe.order.map((t) => xOf(page, t));
      const sorted = [...xs].sort((a, b) => (probe.lang === 'ar' ? b - a : a - b));
      expect(xs, `reads right to left in Arabic, left to right in English: ${probe.order.join(', ')}`).toEqual(sorted);
      if (probe.lang === 'ar') {
        // The line's first word sits at the right margin (700 − 30 padding).
        const first = page.items.reduce((m, it) => Math.max(m, it.x + it.width), 0);
        expect(first, 'the paragraph reads right to left from the right margin').toBeGreaterThan(660);
      }
    });
  });

  it('keeps a typed minus where Chrome puts it and a formatted one on the digits', () => {
    const page = pages[PROBES.length] as PdfPage;
    const strs = page.items.map((i) => i.str.replace(/\u200e/g, ''));
    expect(strs, 'a typed "-1,500" is drawn "1,500-" (the bidi algorithm, as on screen)').toContain('1,500-');
    expect(strs, 'a formatted −2,500 keeps its minus on the left').toContain('-2,500');
  });
});
