// Import screen (workstream D's engine, UI build Nov 2026): reading a CSV file in the browser.
import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/modules/imports';

describe('parseCsv', () => {
  it('reads plain rows and drops the byte-order mark', () => {
    expect(parseCsv('\uFEFFType,Invoice Reference #\ninvoice,1163000002\n')).toEqual([
      ['Type', 'Invoice Reference #'],
      ['invoice', '1163000002'],
    ]);
  });

  it('keeps a comma inside a quoted field and a doubled quote as one quote', () => {
    expect(parseCsv('Name,Total\n"Acme, Ltd",100\n"He said ""hi""",200\n')).toEqual([
      ['Name', 'Total'],
      ['Acme, Ltd', '100'],
      ['He said "hi"', '200'],
    ]);
  });

  it('keeps a line break inside a quoted field', () => {
    expect(parseCsv('Name,Total\n"First\nSecond",100\n')).toEqual([
      ['Name', 'Total'],
      ['First\nSecond', '100'],
    ]);
  });

  it('reads CRLF endings and a file with no trailing newline', () => {
    expect(parseCsv('A,B\r\n1,2\r\n3,4')).toEqual([
      ['A', 'B'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('keeps an empty field and an empty file as no rows', () => {
    expect(parseCsv('A,B\n1,\n')).toEqual([
      ['A', 'B'],
      ['1', ''],
    ]);
    expect(parseCsv('')).toEqual([]);
  });
});
