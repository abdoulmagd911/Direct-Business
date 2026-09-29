import { beforeAll, describe, expect, it } from 'vitest';
import { one, readPdf, renderReportPdf, type PdfPage } from './pdf-tools';

/**
 * The page layout mirrors in Arabic (V301): the section title, the first tile, the first table column and the start
 * of every line sit at the right edge, the footer's page number at the left — and the other way round in English.
 * Positions are read back from the PDF itself (pdf.js), in points from the page's left edge.
 * Sabotage: `pdf-forgets-right-to-left` (tests/sabotage/export.mjs).
 */
let ar: PdfPage[];
let en: PdfPage[];
beforeAll(async () => {
  [ar, en] = await Promise.all([renderReportPdf('ar').then(readPdf), renderReportPdf('en').then(readPdf)]);
});

const page = (pages: PdfPage[], n: number): PdfPage => {
  const p = pages[n - 1];
  if (!p) throw new Error(`the report has no page ${n}`);
  return p;
};
const right = (p: PdfPage, needle: string) => {
  const i = one(p, needle);
  return i.x + i.width;
};
const MID = 480;

describe('Arabic report pages read from the right, English ones from the left', () => {
  it('puts the section title at the reading start', () => {
    expect(one(page(ar, 2), 'مقارنة').x, 'the Arabic title sits right of the middle').toBeGreaterThan(MID);
    expect(right(page(ar, 2), 'مقارنة'), 'and ends at the right margin').toBeGreaterThan(915);
    expect(one(page(en, 2), 'This month vs').x, 'the English title starts at the left margin').toBeLessThan(45);
  });

  it('lays the tiles out from the reading start', () => {
    // Revenue is the first tile: rightmost in Arabic, leftmost in English.
    expect(one(page(ar, 2), '606,500').x).toBeGreaterThan(one(page(ar, 2), '82').x);
    expect(one(page(en, 2), '606,500').x).toBeLessThan(one(page(en, 2), '82').x);
  });

  it('orders table columns from the reading start and repeats the header on the next page', () => {
    const t = page(ar, 3);
    expect(one(t, 'K-REV').x, 'the code column is the rightmost in Arabic').toBeGreaterThan(one(t, '100,000').x);
    expect(one(page(en, 3), 'K-REV').x, 'and the leftmost in English').toBeLessThan(one(page(en, 3), '100,000').x);
    expect(one(page(ar, 4), 'الرمز').x, 'the header row repeats on the second table page').toBeGreaterThan(MID);
    expect(one(page(ar, 4), 'K-EVT').x).toBeGreaterThan(MID);
  });

  it('starts every achievement line at the reading start', () => {
    const lines = page(ar, 5).items.filter((i) => i.str.includes('INV-T-0001') || i.str.includes('DPIN-T-0001'));
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.x + l.width, `"${l.str}" ends at the right margin`).toBeGreaterThan(900);
    const enLine = one(page(en, 5), 'INV-T-0001');
    expect(enLine.x, 'the English line starts at the left bullet').toBeLessThan(60);
  });

  it('puts the page number at the reading end', () => {
    expect(one(page(ar, 5), 'صفحة').x, 'the Arabic page number is at the left').toBeLessThan(MID);
    expect(one(page(en, 5), 'Page 5 of').x, 'the English one at the right').toBeGreaterThan(MID);
  });
});
