// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BOM, exportFileName, exportList, MIME } from '@/core/export';
import { readCsv, sampleColumns, sampleRows, standIn } from './list-tools';
import { blobBytes, readXlsx } from './xlsx-reader';

/**
 * Spec §3.11 Export and the P3-12 row: the export runs the list's own query with its chips, through `fetchAll`, and the
 * file holds exactly the list's rows — 2,500 made-up rows through a 1,000-row cap — named with the list and the export
 * time in Riyadh, in the importer's `YYYY-MM-DD_HH-MM-SS` pattern.
 * Sabotages: `export-reads-one-page`, `file-named-in-utc`, `file-name-keeps-a-slash`, `csv-drops-the-byte-order-mark`,
 * `xlsx-forgets-right-to-left` (tests/sabotage/export-lists.mjs).
 */
const rows = sampleRows(2500);
const at = new Date('2026-09-29T11:05:33Z'); // 14:05:33 in Riyadh

describe('exportList', () => {
  it('writes every row of a 2,500-row list to the CSV, after its byte-order mark', async () => {
    const api = standIn(rows, { cap: 1000, count: true });
    const out = await exportList({
      list: 'Invoices',
      columns: sampleColumns,
      page: api.page,
      format: 'csv',
      lang: 'en',
      at,
    });
    const bytes = await blobBytes(out.blob);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    expect(out.blob.type).toBe(MIME.csv);
    expect(bytes.slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    const table = readCsv(text.slice(BOM.length));
    expect(table.length - 1).toBe(2500);
    expect(out.rows).toBe(2500);
    expect(table.at(-1)![0]).toBe('INV-T-2500');
    expect(out.fileName).toBe('Invoices_2026-09-29_14-05-33.csv');
  });

  it('writes the list with its chips applied — the count the person sees', async () => {
    const where = (r: (typeof rows)[number]) => r.status === 'late' && r.paid;
    const seen = rows.filter(where).length;
    const api = standIn(rows, { cap: 1000, count: true, where });
    const out = await exportList({
      list: 'Invoices',
      columns: sampleColumns,
      page: api.page,
      format: 'xlsx',
      lang: 'en',
      at,
    });
    const book = await readXlsx(await blobBytes(out.blob));
    expect(book.rows.size - 1).toBe(seen);
    expect(out.rows).toBe(seen);
    expect(out.blob.type).toBe(MIME.xlsx);
    expect(out.fileName).toBe('Invoices_2026-09-29_14-05-33.xlsx');
  });

  it('writes an empty list as its header alone', async () => {
    const out = await exportList({
      list: 'Invoices',
      columns: sampleColumns,
      page: standIn([]).page,
      format: 'csv',
      lang: 'en',
      at,
    });
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blobBytes(out.blob));
    expect(readCsv(text.slice(BOM.length))).toHaveLength(1);
    expect(out.rows).toBe(0);
  });

  it('reads an Arabic workbook right to left', async () => {
    const out = await exportList({
      list: 'الفواتير',
      columns: sampleColumns,
      page: standIn(rows.slice(0, 5)).page,
      format: 'xlsx',
      lang: 'ar',
      at,
    });
    const book = await readXlsx(await blobBytes(out.blob));
    expect(book.rtl).toBe(true);
    expect(book.sheetName).toBe('الفواتير');
  });
});

describe('the file name', () => {
  it('carries the list and the Riyadh time of the export', () => {
    expect(exportFileName('Clients', at, 'csv')).toBe('Clients_2026-09-29_14-05-33.csv');
    // 22:30 UTC is already the next day in Riyadh.
    expect(exportFileName('Clients', new Date('2026-09-29T22:30:00Z'), 'xlsx')).toBe(
      'Clients_2026-09-30_01-30-00.xlsx',
    );
  });

  it('keeps Arabic, turns spaces into dashes and drops what no system allows', () => {
    expect(exportFileName('العملاء', at, 'csv')).toBe('العملاء_2026-09-29_14-05-33.csv');
    expect(exportFileName('Suppliers & partners', at, 'csv')).toBe('Suppliers-&-partners_2026-09-29_14-05-33.csv');
    expect(exportFileName('a/b\\c:d*e?f"g<h>i|j', at, 'csv')).toBe('a-b-c-d-e-f-g-h-i-j_2026-09-29_14-05-33.csv');
    expect(exportFileName(' ../.. ', at, 'csv')).toBe('export_2026-09-29_14-05-33.csv');
    expect(exportFileName('', at, 'csv')).toBe('export_2026-09-29_14-05-33.csv');
  });
});
