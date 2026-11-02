import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { reportPdfElement } from '@/core/print/report/pdf/ReportPdf';
import type { Bi, Cell, Column, ReportDoc } from '@/core/print/report/model';
import { reportPptx } from '@/core/print/report/pptx/reportPptx';
import { paletteFromTokensCss } from '@/core/print/palette';
import { readPdf, renderReportPdf, V2, type PdfPage } from './pdf-tools';
import { readDeck, renderReportPptx } from './pptx-tools';
import { sampleReport } from './sample-report';

/**
 * Never drop a column (oversight, 29 Sep). A table as wide as the strategy team's KPI sheet — its 19 columns, V35 —
 * prints every column, in order (mirrored in Arabic), in the PDF and the PPTX; and a row a cell short or a cell too
 * many, or widths that cannot hold every column, is refused by name before anything is drawn — never printed with a
 * dash that is not in the data, never cut.
 * Sabotages: `table-drops-its-last-column`, `table-lets-a-short-row-print` (tests/sabotage/export.mjs).
 */
const b = (en: string, ar: string): Bi => ({ en, ar });
const Q = ['Q1', 'Q2', 'Q3', 'Q4'];
const QA = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
const columns: Column[] = [
  { key: 'no', title: b('No.', 'م'), kind: 'number', width: 0.03 },
  { key: 'indicator', title: b('Objective indicators', 'مؤشرات الأهداف'), kind: 'text', width: 0.12 },
  { key: 'link', title: b('Link to objectives', 'الارتباط بالأهداف'), kind: 'text', width: 0.07 },
  { key: 'unit', title: b('Unit', 'الوحدة'), kind: 'text', width: 0.04 },
  { key: 'base_year', title: b('Base year', 'سنة الأساس'), kind: 'id', width: 0.04 },
  { key: 'baseline', title: b('Baseline', 'خط الأساس'), kind: 'number', width: 0.05 },
  { key: 'achieved_2025', title: b('Achieved up to 2025', 'المحقق حتى 2025'), kind: 'number', width: 0.05 },
  { key: 'target_2026', title: b('2026 target', 'مستهدف 2026'), kind: 'number', width: 0.05 },
  ...Q.map((q, i) => ({
    key: `${q}_target`,
    title: b(`${q} target`, `مستهدف ${QA[i]}`),
    kind: 'number' as const,
    width: 0.05,
  })),
  ...Q.map((q, i) => ({
    key: `${q}_done`,
    title: b(`${q} achieved`, `المحقق ${QA[i]}`),
    kind: 'number' as const,
    width: 0.05,
  })),
  { key: 'total', title: b('Total', 'الإجمالي'), kind: 'number', width: 0.05 },
  { key: 'status', title: b('Status', 'الحالة'), kind: 'status', width: 0.05 },
  { key: 'owners', title: b('Owners', 'المسؤول'), kind: 'text', width: 0.05 },
];
/** Every number column holds its own made-up values (5 + column + row: 551 … 1683), so each column is found. */
const value = (col: number, row: number) => 500 + col * 10 + row;
const NUMBER_COLUMNS = columns.map((c, i) => (c.kind === 'number' && i > 0 ? i : -1)).filter((i) => i > 0);
const rows: Cell[][] = [1, 2, 3].map((r) =>
  columns.map((c, i): Cell => {
    if (i === 0) return r;
    if (c.kind === 'number') return value(i, r);
    if (c.key === 'indicator') return b(`Test indicator ${r}`, `مؤشر تجريبي ${r}`);
    if (c.key === 'link') return b(`Objective ${r}`, `الهدف ${r}`);
    if (c.key === 'unit') return b('Count', 'عدد');
    if (c.key === 'base_year') return { id: '2024' };
    if (c.key === 'status') return { status: 'on_track' };
    return b('Test Person', 'Test Person');
  }),
);
const wide: ReportDoc = {
  ...sampleReport,
  sections: [{ kind: 'table', key: 'kpi_sheet', title: b('KPI sheet', 'بطاقة المؤشرات'), columns, rows }],
};

describe('a 19-column table', () => {
  const pdf = {} as Record<'ar' | 'en', PdfPage[]>;
  beforeAll(async () => {
    for (const lang of ['ar', 'en'] as const) {
      pdf[lang] = await readPdf(await renderReportPdf(lang, wide));
      // For the review: the table's page, drawn, in the ignored results folder.
      fs.mkdirSync(path.join(V2, 'test-results/export'), { recursive: true });
      fs.writeFileSync(path.join(V2, `test-results/export/wide-table-${lang}.png`), pdf[lang][1]!.png);
    }
  });

  it('prints every column of every row in the PDF, in order, mirrored in Arabic', () => {
    for (const lang of ['ar', 'en'] as const) {
      const items = pdf[lang].flatMap((p) => p.items);
      const at = (text: string) => items.filter((t) => t.str.trim() === text);
      for (const r of [1, 2, 3]) {
        const xs = NUMBER_COLUMNS.map((c) => {
          const found = at(String(value(c, r)));
          expect(found, `${lang}: column "${columns[c]!.key}", row ${r}`).toHaveLength(1);
          return found[0]!.x;
        });
        const sorted = [...xs].sort((a, b) => (lang === 'ar' ? b - a : a - b));
        expect(xs, `${lang}: row ${r} reads from the ${lang === 'ar' ? 'right' : 'left'}`).toEqual(sorted);
      }
      expect(at('2024'), `${lang}: base year`).toHaveLength(3);
    }
    const english = pdf.en.flatMap((p) => p.items.map((t) => t.str)).join(' ');
    for (const c of columns)
      for (const word of (c.title.en ?? '').split(' ')) expect(english, `the header of "${c.key}"`).toContain(word);
    for (const text of ['Test indicator 3', 'Objective 3', 'Count', 'On track', 'Test Person'])
      expect(english.replace(/\s+/g, ' '), text).toContain(text.split(' ').at(-1)!);
  });

  it('keeps all 19 columns in the PPTX table, header and rows, mirrored in Arabic', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const deck = await readDeck(await renderReportPptx(lang, wide));
      const xml = deck.slides.find((s) => s.includes('<a:tbl>'))!;
      expect(xml, `${lang}: a slide holds the table`).toBeTruthy();
      expect([...xml.matchAll(/<a:gridCol\b/g)], `${lang}: grid columns`).toHaveLength(19);
      const trs = [...xml.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)].map((m) => m[0]);
      expect(trs, `${lang}: header and three rows`).toHaveLength(4);
      for (const tr of trs) expect([...tr.matchAll(/<a:tc\b/g)], `${lang}: cells in a row`).toHaveLength(19);
      const head = [...trs[0]!.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((m) =>
        [...m[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(''),
      );
      const titles = columns.map((c) => (lang === 'ar' ? c.title.ar : c.title.en!));
      expect(head).toEqual(lang === 'ar' ? [...titles].reverse() : titles);
    }
  });
});

describe('a table that cannot print every column', () => {
  const palette = paletteFromTokensCss(fs.readFileSync(path.join(V2, 'src/ui/tokens.css'), 'utf8'));
  const withTable = (patch: Partial<{ columns: Column[]; rows: Cell[][] }>): ReportDoc => ({
    ...wide,
    sections: [{ kind: 'table', key: 'kpi_sheet', title: b('KPI sheet', 'بطاقة المؤشرات'), columns, rows, ...patch }],
  });
  const refuses = async (doc: ReportDoc, message: RegExp) => {
    expect(() => reportPdfElement({ doc, lang: 'ar', palette, logo: null })).toThrow(message);
    await expect(reportPptx(doc, 'ar', { palette, logoPng: null, logoAspect: 1 })).rejects.toThrow(message);
  };

  it('is refused by name when a row is a cell short or a cell long', async () => {
    await refuses(withTable({ rows: [rows[0]!.slice(0, 18)] }), /table "kpi_sheet", row 1 has 18 cells for 19 columns/);
    await refuses(withTable({ rows: [[...rows[0]!, 'extra']] }), /row 1 has 20 cells for 19 columns/);
  });

  it('is refused when its widths cannot hold every column', async () => {
    await refuses(
      withTable({ columns: columns.map((c, i) => (i ? c : { ...c, width: 0 })) }),
      /column without a width/,
    );
    await refuses(withTable({ columns: columns.map((c) => ({ ...c, width: 0.1 })) }), /widths add up to 1\.9/);
    await refuses(
      withTable({ columns: [...columns.slice(0, 18), { ...columns[0]!, width: 0.05 }] }),
      /repeats a column/,
    );
  });
});
