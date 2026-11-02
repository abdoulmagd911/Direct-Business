import { describe, expect, it } from 'vitest';
import { BOM, csvGuard, toCsv, type ExportColumn } from '@/core/export';
import { readCsv } from './list-tools';

/**
 * CP5: quoting does not stop formula injection — a spreadsheet opening the CSV evaluates a cell starting with "=", "+",
 * "@", a tab, a line break or a non-numeric minus. Every text cell, the headers and IDs included, passes through
 * `csvGuard`; a plain negative number keeps its minus.
 * Sabotages: `guard-lets-a-formula-through`, `guard-lets-a-minus-formula-through`, `csv-skips-the-guard-on-texts`,
 * `csv-skips-the-guard-on-headers`, `csv-drops-its-quoting`, `csv-drops-the-byte-order-mark`
 * (tests/sabotage/export-lists.mjs).
 */
describe('csvGuard', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['=HYPERLINK("http://example.invalid","x")', `'=HYPERLINK("http://example.invalid","x")`],
    ['+966500000000', "'+966500000000"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['-2+3', "'-2+3"],
    ['-Test Co A', "'-Test Co A"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', "'\r=1+1"],
    ['\n=1+1', "'\n=1+1"],
  ])('opens %j as text', (value, guarded) => {
    expect(csvGuard(value)).toBe(guarded);
  });

  it.each(['-8000', '-12.5', '8000', 'Test Co A', 'INV-T-0001', 'شركة تجربة', '', "it's"])(
    'leaves %j as it is',
    (v) => {
      expect(csvGuard(v)).toBe(v);
    },
  );

  it('writes nothing for an absent value', () => {
    expect(csvGuard(null)).toBe('');
    expect(csvGuard(undefined)).toBe('');
  });
});

describe('the CSV file', () => {
  type Row = { id: string; name: string; note: string; amount: number | string };
  const columns: ExportColumn<Row>[] = [
    { key: 'id', header: 'ID', kind: 'id', value: (r) => r.id },
    { key: 'name', header: '=Name', kind: 'text', value: (r) => r.name },
    { key: 'note', header: 'Note', kind: 'text', value: (r) => r.note },
    { key: 'amount', header: 'Amount', kind: 'money', value: (r) => r.amount },
  ];
  const rows: Row[] = [
    { id: '=1+1', name: '@Test Co A', note: 'plain, with a comma', amount: -8000 },
    { id: 'INV-T-0002', name: '+Sample Co', note: 'says "hi"\r\non two lines', amount: '-12.5' },
  ];
  const text = toCsv(rows, columns);
  const table = readCsv(text.slice(BOM.length));

  it('guards the headers, the texts and the IDs, and not the numbers', () => {
    expect(table[0]).toEqual(['ID', "'=Name", 'Note', 'Amount']);
    expect(table[1]).toEqual(["'=1+1", "'@Test Co A", 'plain, with a comma', '-8000']);
    expect(table[2]).toEqual(['INV-T-0002', "'+Sample Co", 'says "hi"\r\non two lines', '-12.5']);
  });

  it('starts with the byte-order mark and ends every line with CRLF', () => {
    expect(text.startsWith(BOM)).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    // The two data lines and the header: the line break inside a quoted cell is not a row.
    expect(table).toHaveLength(3);
  });

  it('quotes a cell holding a comma, a quote or a line break, and only those', () => {
    const lines = text.slice(BOM.length).split('\r\n');
    expect(lines[1]).toBe(`'=1+1,'@Test Co A,"plain, with a comma",-8000`);
    expect(lines[2]).toBe(`INV-T-0002,'+Sample Co,"says ""hi""`);
  });
});
