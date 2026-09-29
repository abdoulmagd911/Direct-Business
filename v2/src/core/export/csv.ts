import { cellOf, clockText, dayText, plainNumber, type Cell, type ExportColumn } from './columns';
import { csvGuard } from './csvGuard';

/**
 * A list as CSV (spec §3.11 Export): UTF-8 with a byte-order mark, so Excel reads Arabic as Arabic; commas; CRLF line
 * ends and RFC 4180 quoting. Numbers are bare ("11500.5", "-8000"); dates are Riyadh dates ("2026-09-29"); moments
 * are Riyadh wall clock ("2026-09-29 14:05:33"); booleans TRUE/FALSE; IDs exactly as stored. Every text — the headers
 * and IDs included — passes through `csvGuard` (CP5).
 */
export const BOM = '\u{FEFF}';

function field(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvCell(cell: Cell): string {
  switch (cell.t) {
    case 'empty':
      return '';
    case 'text':
      return field(csvGuard(cell.v));
    case 'number':
      return plainNumber(cell.v);
    case 'date':
      return dayText(cell);
    case 'datetime':
      return clockText(cell);
    case 'bool':
      return cell.v ? 'TRUE' : 'FALSE';
  }
}

export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const lines = [columns.map((c) => field(csvGuard(c.header))).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(cellOf(c, c.value(row)))).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}
