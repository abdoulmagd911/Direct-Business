// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOM, ExportColumnMissing, exportList, type ExportColumn } from '@/core/export';
import { forbiddenIn } from '../../../scripts/checks/forbidden-words.mjs';
import { readCsv, sampleColumns, sampleRows, standIn, type SampleRow } from './list-tools';
import { blobBytes, readXlsx } from './xlsx-reader';

/**
 * The scenario catalogue's export items (oversight 29 Sep 16:03): an export for every role, in CSV and Excel, in
 * English and Arabic, holds exactly the columns that role sees on the list, in its order — a column its screen hides
 * is never in the file — and exactly the rows its own query returns (the database's row rules decide them; here a
 * stand-in per role). A visible column that cannot be a cell is named with its reason, and one with neither a column
 * nor a reason is refused before anything is read (OA23). Every risky text is opened as text (CP5), the file is
 * named `<list>_YYYY-MM-DD_HH-MM-SS` in Riyadh time, and no file name, sheet or header says a word the app never says
 * (V59) — for every list name in both catalogs.
 * Sabotages: `export-writes-hidden-columns`, `export-drops-a-visible-column-unseen`
 * (tests/sabotage/export-lists.mjs); the guard's own are in `a-csv-export-opens-every-risky-cell-as-text`.
 */
const V2 = path.resolve(import.meta.dirname, '../../..');
type Catalog = { [k: string]: string | Catalog };
const catalog = (lang: 'en' | 'ar') =>
  JSON.parse(fs.readFileSync(path.join(V2, `messages/${lang}.json`), 'utf8')) as Catalog;

const at = new Date('2026-09-29T11:05:33Z'); // 14:05:33 in Riyadh
const STAMP = /_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(csv|xlsx)$/;

/** Made-up rows, a few of them risky: a formula, a phone with its plus, an at-sign. */
const rows: SampleRow[] = sampleRows(120).map((r, i) =>
  i % 17 === 3 ? { ...r, partner: ['=1+1', '+966500000000', '@SUM(A1:A2)'][i % 3]! } : r,
);
const RISKY = new Set(['=1+1', '+966500000000', '@SUM(A1:A2)']);
const header = (key: string) => sampleColumns.find((c) => c.key === key)!.header;

/** What each role sees on the Invoices list — its columns, and the rows its own query returns. */
const ROLES: {
  role: string;
  visible: string[];
  sees: (r: SampleRow) => boolean;
}[] = [
  {
    role: 'admin',
    visible: ['number', 'partner', 'status', 'amount', 'share', 'due', 'updated', 'paid', 'roles', 'actions'],
    sees: () => true,
  },
  {
    role: 'head of department',
    visible: ['number', 'partner', 'status', 'amount', 'due', 'updated', 'paid', 'actions'],
    sees: () => true,
  },
  { role: 'manager', visible: ['number', 'partner', 'status', 'amount', 'due', 'actions'], sees: (r) => !r.paid },
  { role: 'member', visible: ['number', 'partner', 'status', 'due', 'actions'], sees: (r) => r.status !== 'done' },
  { role: 'viewer', visible: ['partner', 'number', 'status'], sees: (r) => r.status === 'open' },
];
const OMIT = { actions: 'buttons, not data' };

describe('an export for every role', () => {
  for (const { role, visible, sees } of ROLES)
    for (const format of ['csv', 'xlsx'] as const)
      for (const lang of ['en', 'ar'] as const)
        it(`holds what the ${role} sees, and nothing else (${format}, ${lang})`, async () => {
          const theirs = rows.filter(sees);
          const list = lang === 'ar' ? 'الفواتير' : 'Invoices';
          const out = await exportList({
            list,
            columns: sampleColumns,
            page: standIn(rows, { count: true, where: sees }).page,
            format,
            lang,
            at,
            visible,
            omit: OMIT,
          });
          const shown = visible.filter((k) => k !== 'actions');
          const want = shown.map(header);

          let head: string[];
          let body: string[][];
          let sheet = '';
          if (format === 'csv') {
            const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(out.blob));
            const table = readCsv(text.slice(BOM.length));
            [head, ...body] = [table[0]!, ...table.slice(1)];
          } else {
            const book = await readXlsx(await blobBytes(out.blob));
            sheet = book.sheetName;
            const grid = [...book.rows.values()].map((r) => [...r.values()]);
            head = grid[0]!.map((c) => String(c.value));
            body = grid.slice(1).map((r) => r.map((c) => String(c.value)));
            // A risky text is text in the workbook: never a formula, opened with its quote prefix.
            for (const r of grid.slice(1))
              for (const c of r)
                if (typeof c.value === 'string' && RISKY.has(c.value)) {
                  expect(c.formula, `${c.ref} is not a formula`).toBe(false);
                  expect(c.quotePrefix, `${c.ref} opens as text`).toBe(true);
                }
          }

          expect(head, `the ${role}'s columns, in their order`).toEqual(want);
          expect(body, `the ${role}'s rows`).toHaveLength(theirs.length);
          expect(out.rows).toBe(theirs.length);
          const partner = shown.indexOf('partner');
          expect(body.map((r) => r[partner])).toEqual(
            theirs.map((r) => (format === 'csv' && RISKY.has(r.partner) ? `'${r.partner}` : r.partner)),
          );
          expect(out.omitted).toEqual(visible.includes('actions') ? [{ key: 'actions', reason: OMIT.actions }] : []);
          expect(out.fileName.startsWith(`${list}_`) && STAMP.test(out.fileName), out.fileName).toBe(true);
          expect(forbiddenIn([out.fileName, sheet, ...head].join('\n')), 'no word the app never says').toEqual([]);
        });

  it('refuses a visible column with no export column and no reason, before reading anything', async () => {
    const api = standIn(rows, { count: true });
    let refused: unknown = null;
    try {
      await exportList({
        list: 'Invoices',
        columns: sampleColumns,
        page: api.page,
        format: 'csv',
        lang: 'en',
        at,
        visible: ['number', 'notes'],
      });
    } catch (e) {
      refused = e;
    }
    expect(refused, 'a visible column with no place in the file is refused').toBeInstanceOf(ExportColumnMissing);
    expect(api.asked, 'nothing is read').toEqual([]);
  });

  it('writes every column when the screen names none (a screen with no hidden columns)', async () => {
    const out = await exportList({
      list: 'Invoices',
      columns: sampleColumns,
      page: standIn(rows.slice(0, 3)).page,
      format: 'csv',
      lang: 'en',
      at,
    });
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(out.blob));
    expect(readCsv(text.slice(BOM.length))[0]).toEqual(sampleColumns.map((c) => c.header));
    expect(out.omitted).toEqual([]);
  });
});

describe("every list name in the app's own words", () => {
  const labels = (c: Catalog, at = ''): [string, string][] =>
    Object.entries(c).flatMap(([k, v]) => (typeof v === 'string' ? [[`${at}${k}`, v]] : labels(v, `${at}${k}.`)));

  for (const lang of ['en', 'ar'] as const)
    it(`names a file and a sheet without a banned word, for every page and record type (${lang})`, async () => {
      const words = labels(catalog(lang)).filter(([k]) => /^(nav|entity)\./.test(k));
      expect(words.length).toBeGreaterThan(20);
      const one: ExportColumn<SampleRow>[] = [{ key: 'n', header: words[0]![1], kind: 'id', value: (r) => r.number }];
      for (const [key, name] of words) {
        const out = await exportList({
          list: name,
          columns: one,
          page: standIn(rows.slice(0, 1)).page,
          format: 'xlsx',
          lang,
          at,
        });
        const book = await readXlsx(await blobBytes(out.blob));
        expect(forbiddenIn(`${out.fileName}\n${book.sheetName}`), `${key}: ${out.fileName}`).toEqual([]);
        expect(STAMP.test(out.fileName), `${key}: ${out.fileName}`).toBe(true);
      }
    });
});
