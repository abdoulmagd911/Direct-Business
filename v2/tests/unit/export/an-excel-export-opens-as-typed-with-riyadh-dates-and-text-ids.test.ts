// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { toXlsx, XlsxCellTooLong, type ExportColumn } from '@/core/export';
import { columnName, excelText, sheetName } from '@/core/export/xlsx';
import { sampleColumns, sampleRows } from './list-tools';
import { fromSerial, readXlsx, unexcel, type ReadCell } from './xlsx-reader';

/**
 * The Excel export (spec §3.11; V303): number cells for numbers, date cells holding Riyadh's day and wall clock (D20),
 * text-formatted cells for texts and IDs; the header bold, frozen and filtered; right to left in Arabic. CP5 in a
 * workbook: no cell is ever a formula, and a text `csvGuard` would prefix carries Excel's quote prefix — it reads as
 * stored and stays text when edited. What a workbook cannot hold is refused (too long) or escaped (control characters,
 * a literal `_x0041_`), never changed. Every part is well-formed XML and counted right.
 * Sabotages: `xlsx-text-is-not-text`, `xlsx-drops-the-quote-prefix`, `xlsx-dates-in-utc`,
 * `xlsx-decodes-a-literal-code`, `xlsx-forgets-right-to-left`, `xlsx-cuts-a-long-text`, `xlsx-miscounts-its-strings`,
 * `xlsx-writes-a-bare-ampersand` (tests/sabotage/export-lists.mjs).
 */
const at = new Date('2026-09-29T11:05:33Z');
const rows = sampleRows(30);
const colOf = (key: string) => columnName(sampleColumns.findIndex((c) => c.key === key));

describe('the workbook', () => {
  it('writes number cells, Riyadh date cells and text-formatted ID cells', async () => {
    const book = await readXlsx(await toXlsx(rows, sampleColumns, { sheet: 'Invoices', rtl: false, at }));
    const cell = (r: number, key: string) => book.rows.get(r)!.get(colOf(key));
    expect(book.rows.size).toBe(31);
    expect(book.sheetName).toBe('Invoices');

    expect(cell(1, 'number')).toMatchObject({ type: 's', value: 'Invoice', bold: true });
    expect(cell(2, 'number')).toMatchObject({ type: 's', value: 'INV-T-0001', numFmt: '@', quotePrefix: false });
    expect(cell(3, 'amount')).toMatchObject({ type: 'n', value: 7919.5, numFmt: '#,##0.00' });
    expect(cell(2, 'share')).toBeUndefined(); // not measured: an empty cell, never 0
    expect(cell(3, 'share')).toMatchObject({ type: 'n', value: 0.1, numFmt: '0.0"%"' });
    // Excel has no time zone: the cell holds Riyadh's day and wall clock (21:30 UTC → 00:30 the next day).
    expect(cell(2, 'due')).toMatchObject({ type: 'n', numFmt: 'yyyy-mm-dd' });
    expect(fromSerial(cell(2, 'due')!.value as number)).toBe('2026-01-01T00:00:00.000Z');
    expect(cell(2, 'updated')).toMatchObject({ type: 'n', numFmt: 'yyyy-mm-dd hh:mm:ss' });
    expect(fromSerial(cell(2, 'updated')!.value as number)).toBe('2026-09-02T00:30:00.000Z');
    expect(cell(2, 'paid')).toMatchObject({ type: 'b', value: true });
    expect(cell(3, 'paid')).toMatchObject({ type: 'b', value: false });
    expect(cell(2, 'roles')).toMatchObject({ type: 's', value: 'Supplier; Client' });
    expect(book.created).toBe('2026-09-29T11:05:33Z');
  });

  it('freezes and filters the header, and reads right to left in Arabic', async () => {
    const en = await readXlsx(await toXlsx(rows, sampleColumns, { sheet: 'Invoices', rtl: false, at }));
    const ar = await readXlsx(await toXlsx(rows, sampleColumns, { sheet: 'الفواتير', rtl: true, at }));
    expect([en.rtl, ar.rtl]).toEqual([false, true]);
    expect([en.frozenRows, ar.frozenRows]).toEqual([1, 1]);
    expect(ar.sheetName).toBe('الفواتير');
    expect(en.autoFilter).toBe('A1:I31');
    expect(en.filterDatabase).toBe("'Invoices'!$A$1:$I$31");
    expect(ar.filterDatabase).toBe("'الفواتير'!$A$1:$I$31");
    expect(en.widths).toEqual([18, 28, 28, 16, 10, 12, 20, 9, 28]);
  });

  it('keeps a risky text a text: never a formula, and quote-prefixed where csvGuard would prefix it', async () => {
    type R = { id: string; name: string };
    const cols: ExportColumn<R>[] = [
      { key: 'id', header: 'ID', kind: 'id', value: (r) => r.id },
      { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
    ];
    const risky: R[] = [
      { id: '=1+1', name: '=HYPERLINK("http://example.invalid","x")' },
      { id: '00123', name: '+966500000000' },
      { id: '-T-1', name: '@SUM(A1)' },
      { id: 'INV-T-0004', name: '-8000' },
      { id: 'INV-T-0005', name: 'Test Co A' },
    ];
    const book = await readXlsx(await toXlsx(risky, cols, { sheet: 'Risky', rtl: false, at }));
    const got = risky.map((_, i): [ReadCell, ReadCell] => [
      book.rows.get(i + 2)!.get('A')!,
      book.rows.get(i + 2)!.get('B')!,
    ]);
    expect(got.map(([a, b]) => [a.value, b.value])).toEqual(risky.map((r) => [r.id, r.name]));
    expect(got.flat().every((c) => c.type === 's' && !c.formula && c.numFmt === '@')).toBe(true);
    expect(got.map(([a, b]) => [a.quotePrefix, b.quotePrefix])).toEqual([
      [true, true],
      [false, true],
      [true, true],
      [false, false],
      [false, false],
    ]);
  });

  it('escapes what XML cannot hold and what Excel would decode, so both read back as stored', async () => {
    type R = { note: string };
    const cols: ExportColumn<R>[] = [{ key: 'note', header: 'Note', kind: 'text', value: (r) => r.note }];
    const notes = ['bell\u{0007} and tab\t', 'code _x0041_ as typed', 'lone \u{D800} half', 'Test & <Co> "A"'];
    const book = await readXlsx(
      await toXlsx(
        notes.map((note) => ({ note })),
        cols,
        { sheet: 'N', rtl: false, at },
      ),
    );
    const back = notes.map((_, i) => book.rows.get(i + 2)!.get('A')!.value);
    expect(back).toEqual(['bell\u{0007} and tab\t', 'code _x0041_ as typed', 'lone \u{FFFD} half', 'Test & <Co> "A"']);
    expect(excelText('_x0041_')).toBe('_x005F_x0041_');
    expect(unexcel(excelText('\u{0001}_x0001_'))).toBe('\u{0001}_x0001_');
  });

  it('refuses a text longer than a cell holds instead of cutting it', async () => {
    type R = { note: string };
    const cols: ExportColumn<R>[] = [{ key: 'note', header: 'Note', kind: 'text', value: (r) => r.note }];
    const write = (n: number) => toXlsx([{ note: 'x'.repeat(n) }], cols, { sheet: 'N', rtl: false, at });
    await expect(write(32_768)).rejects.toThrow(XlsxCellTooLong);
    const book = await readXlsx(await write(32_767));
    expect((book.rows.get(2)!.get('A')!.value as string).length).toBe(32_767);
  });

  it('writes an empty list as its header row, filtered, and a list without columns as a valid empty sheet', async () => {
    const empty = await readXlsx(await toXlsx([], sampleColumns, { sheet: 'Invoices', rtl: false, at }));
    expect(empty.rows.size).toBe(1);
    expect(empty.autoFilter).toBe('A1:I1');
    const bare = await readXlsx(await toXlsx(rows, [], { sheet: 'Invoices', rtl: false, at }));
    expect(bare.autoFilter).toBeNull();
  });

  it('writes the same bytes for the same list and time', async () => {
    const a = await toXlsx(rows, sampleColumns, { sheet: 'Invoices', rtl: false, at });
    const b = await toXlsx(rows, sampleColumns, { sheet: 'Invoices', rtl: false, at });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('names the sheet as Excel allows', () => {
    expect(sheetName('Clients · Government')).toBe('Clients · Government');
    expect(sheetName('a/b\\c?d*e[f]g:h')).toBe('a b c d e f g h');
    expect(sheetName("'quoted'")).toBe('quoted');
    expect(Array.from(sheetName('ع'.repeat(40)))).toHaveLength(31);
    expect(sheetName('  ')).toBe('Export');
  });

  it('names columns past Z', () => {
    expect([0, 25, 26, 51, 52, 701, 702, 16_383].map(columnName)).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
      'XFD',
    ]);
  });
});
