import { describe, expect, it } from 'vitest';
import { readPastedTable } from '@/ui/grid/paste';

/**
 * What Excel and Google Sheets put on the clipboard reads back as the sheet showed it: tabs between cells, a cell
 * holding a line break, a tab or a quote wrapped in quotes with its quotes doubled, Excel's CRLF and closing line
 * break, Google's bare LF, non-breaking spaces, empty cells kept in place and empty rows dropped.
 * Sabotages: `paste-splits-a-quoted-line-break`, `paste-keeps-empty-rows` (tests/sabotage/grid.mjs).
 */
describe('a pasted table', () => {
  const expected = [
    ['Title', 'Date', 'Notes'],
    ['Made-up visit', '29/09/2026', 'Two lines\nof notes'],
    ['A "quoted" word', '', 'tab\there'],
  ];

  it('reads Excel’s copy', () => {
    const excel =
      'Title\tDate\tNotes\r\nMade-up visit\t29/09/2026\t"Two lines\r\nof notes"\r\n"A ""quoted"" word"\t\t"tab\there"\r\n';
    expect(readPastedTable(excel)).toEqual(expected);
  });

  it('reads Google Sheets’ copy the same', () => {
    const sheets =
      'Title\tDate\tNotes\nMade-up visit\t29/09/2026\t"Two lines\nof notes"\nA "quoted" word\t\t"tab\there"';
    expect(readPastedTable(sheets)).toEqual(expected);
  });

  it('trims cells, turns non-breaking spaces into spaces and drops empty rows', () => {
    expect(readPastedTable('  Made-up\u{00A0}visit \t 29/09/2026\n\t\t\n\n')).toEqual([
      ['Made-up visit', '29/09/2026'],
    ]);
    expect(readPastedTable('')).toEqual([]);
  });
});
