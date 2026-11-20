import type { CodeLedgerRow } from './types';

/** What an admin may do to one ledger row's place in the count, and what the database needs to do it. */
export type RowToggle = { kind: 'exclude' | 'include'; partnerId: string; number: string };

/**
 * The one action a row offers an admin (Landing 32), or none:
 * a counted row can be excluded; a row excluded by hand on the row itself can be included again. A row a list rule
 * catches is changed in Settings → Finance, and a row that is not counted for another reason (not fully paid) has
 * nothing to undo — neither offers a button. A row the read gives no organisation or no number for cannot be named
 * to the database, so it offers nothing either.
 */
export function toggleOf(row: CodeLedgerRow): RowToggle | null {
  if (!row.partner_id || !row.number) return null;
  const target = { partnerId: row.partner_id, number: row.number };
  if (row.counted) return { kind: 'exclude', ...target };
  if (row.excluded_row_level === true) return { kind: 'include', ...target };
  return null;
}
