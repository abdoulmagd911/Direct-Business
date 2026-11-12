import type { CodeRow, CodeState } from './types';

/**
 * A code's state from its dates, against today: expired once its last day has passed, inactive before its first
 * day, active in between (open ends count as live). This mirrors finance.code_state in the database — the two
 * must stay the same rule; the list the screen shows carries the database's own state, and this is only the
 * filter's and the tests' copy of the rule.
 */
export function codeState(validFrom: string | null, validTo: string | null, today: string): CodeState {
  if (validTo !== null && validTo < today) return 'expired';
  if (validFrom !== null && validFrom > today) return 'inactive';
  return 'active';
}

/** The list's order: total discount first, highest first, codes with no counted use last, then the code text. */
export function sortCodes(rows: CodeRow[]): CodeRow[] {
  return [...rows].sort((a, b) => {
    if (a.total_discount === null && b.total_discount === null) return a.code.localeCompare(b.code);
    if (a.total_discount === null) return 1;
    if (b.total_discount === null) return -1;
    if (b.total_discount !== a.total_discount) return b.total_discount - a.total_discount;
    return a.code.localeCompare(b.code);
  });
}

/** The state filter: 'all' keeps the list as sorted; otherwise only the codes in that state. */
export function filterCodes(rows: CodeRow[], state: CodeState | 'all'): CodeRow[] {
  if (state === 'all') return rows;
  return rows.filter((r) => r.state === state);
}

/**
 * The search box (F-B3-04, Landing 15): a code whose text carries the typed fragment, case-insensitively, in
 * the list's own order. An empty box keeps the list as it is.
 */
export function searchCodes(rows: CodeRow[], query: string): CodeRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.code.toLowerCase().includes(q));
}
