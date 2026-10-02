import { describe, expect, it } from 'vitest';
import { BOM, cellOf, ExportColumnError, toCsv, type ExportKind } from '@/core/export';
import { plainNumber } from '@/core/export/columns';
import { readCsv, sampleColumns, sampleRows } from './list-tools';

/**
 * Spec §3.11 Export: numbers as numbers, dates as Riyadh dates (D20), IDs as text exactly as stored, and a value that
 * does not fit its column refused by name — never written as "[object Object]", "NaN" or "1e-7". The workbook's side
 * of the same promise: an-excel-export-opens-as-typed-with-riyadh-dates-and-text-ids.test.ts.
 * Sabotages: `export-dates-in-utc`, `ids-become-numbers`, `numbers-print-exponents`, `columns-take-an-object`
 * (tests/sabotage/export-lists.mjs).
 */
const col = (kind: ExportKind) => ({ key: 'c', kind });

describe('one cell', () => {
  it('writes a moment as its Riyadh day and wall clock, not its UTC ones', () => {
    // 21:30 UTC on the 28th is 00:30 on the 29th in Riyadh.
    expect(cellOf(col('date'), '2026-09-28T21:30:00Z')).toEqual({ t: 'date', y: 2026, m: 9, d: 29 });
    expect(cellOf(col('datetime'), '2026-09-28T21:30:00Z')).toEqual({
      t: 'datetime',
      ...{ y: 2026, m: 9, d: 29, h: 0, mi: 30, s: 0 },
    });
    expect(cellOf(col('date'), new Date('2026-12-31T22:00:00Z'))).toEqual({ t: 'date', y: 2027, m: 1, d: 1 });
  });

  it('keeps a calendar date as that day, whatever the time zone', () => {
    expect(cellOf(col('date'), '2026-09-29')).toEqual({ t: 'date', y: 2026, m: 9, d: 29 });
  });

  it('keeps an ID exactly as stored', () => {
    expect(cellOf(col('id'), '00123')).toEqual({ t: 'text', v: '00123' });
    expect(cellOf(col('id'), 'INV-T-0001')).toEqual({ t: 'text', v: 'INV-T-0001' });
    expect(cellOf(col('id'), 42)).toEqual({ t: 'text', v: '42' });
  });

  it('writes numbers, money and percent points as numbers', () => {
    expect(cellOf(col('money'), 11500.5)).toEqual({ t: 'number', v: 11500.5 });
    expect(cellOf(col('money'), '-8000')).toEqual({ t: 'number', v: -8000 });
    expect(cellOf(col('percent'), 87.5)).toEqual({ t: 'number', v: 87.5 });
    expect(cellOf(col('number'), -0)).toEqual({ t: 'number', v: 0 });
  });

  it('leaves "not measured" empty, never 0 (M60)', () => {
    for (const kind of ['number', 'money', 'percent', 'date', 'text', 'id'] as const)
      for (const v of [null, undefined, '']) expect(cellOf(col(kind), v)).toEqual({ t: 'empty' });
  });

  it.each([
    ['text', { a: 1 }],
    ['id', 12345678901234567890],
    ['id', 1.5],
    ['number', 'about 12'],
    ['number', Number.NaN],
    ['money', Infinity],
    ['money', 1e21],
    ['date', '29/09/2026'],
    ['date', '2026-02-30'],
    ['datetime', '2026-09-29'],
    ['datetime', 'yesterday'],
    ['boolean', 'yes'],
  ] as [ExportKind, unknown][])('refuses a %s column holding %j', (kind, v) => {
    expect(() => cellOf({ key: 'c', kind }, v)).toThrow(ExportColumnError);
    expect(() => cellOf({ key: 'c', kind }, v)).toThrow(/column "c"/);
  });

  it('never prints a number in exponent form', () => {
    expect(plainNumber(1e-7)).toBe('0.0000001');
    expect(plainNumber(-1.23e-7)).toBe('-0.000000123');
    expect(plainNumber(123456789012345)).toBe('123456789012345');
    expect(plainNumber(0.1)).toBe('0.1');
  });
});

describe('the CSV', () => {
  const rows = sampleRows(30);
  const table = readCsv(toCsv(rows, sampleColumns).slice(BOM.length));
  const at = (r: number, header: string) => table[r]![table[0]!.indexOf(header)];

  it('writes the forms a spreadsheet reads', () => {
    expect(table[0]).toEqual(sampleColumns.map((c) => c.header));
    expect(at(1, 'Invoice')).toBe('INV-T-0001');
    expect(at(1, 'Amount (SAR)')).toBe('0.5');
    expect(at(2, 'Amount (SAR)')).toBe('7919.5');
    expect(at(1, 'Share')).toBe('');
    expect(at(2, 'Share')).toBe('0.1');
    expect(at(1, 'Due')).toBe('2026-01-01');
    expect(at(1, 'Updated')).toBe('2026-09-02 00:30:00');
    expect(at(1, 'Paid')).toBe('TRUE');
    expect(at(2, 'Paid')).toBe('FALSE');
    expect(at(1, 'Roles')).toBe('Supplier; Client');
  });
});
