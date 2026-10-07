/**
 * Rows pasted from a spreadsheet (P5-2c). Excel and Google Sheets both put the selection on the clipboard as text:
 * cells split by tabs, rows by line breaks, and a cell that holds a tab, a line break or a quote wrapped in quotes
 * with its quotes doubled. This reads that text back into rows of cells, as the sheet showed them.
 */
export function readPastedTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let started = false; // a cell has begun (so a quote is literal inside it)
  const src = text.replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && !started) {
      quoted = true;
      started = true;
    } else if (ch === '\t') {
      row.push(cell);
      cell = '';
      started = false;
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      started = false;
    } else {
      cell += ch;
      started = true;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Spreadsheets end a copy with a line break, and a row of empty cells is no row.
  return rows.map((r) => r.map((c) => c.replace(/\u{00A0}/gu, ' ').trim())).filter((r) => r.some((c) => c !== ''));
}
