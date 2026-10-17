/**
 * CP5: every text cell of a CSV export passes through `csvGuard`. Quoting a field does not stop formula injection —
 * a spreadsheet opening the file still evaluates a cell that starts with `=`, `+`, `@`, a tab, a line break, or a
 * minus that does not begin a plain number. The guard puts an apostrophe in front of such a cell, so it opens as text.
 *
 * Ported from the old app (`js/core/core-01-foundation.js`), with the line feed added: a field can start with one once
 * it is quoted. A plain number ("-8000", "-12.5") keeps its minus, so a negative figure typed as text stays a figure.
 */
export function csvGuard(value: unknown): string {
  const v = value === null || value === undefined ? '' : String(value);
  if (/^[=+@\t\r\n]/.test(v)) return `'${v}`;
  if (v.startsWith('-') && !/^-\d+(\.\d+)?$/.test(v)) return `'${v}`;
  return v;
}
