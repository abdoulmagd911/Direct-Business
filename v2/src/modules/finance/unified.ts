// The pilot unified read, in plain TypeScript: the same rules the database
// function finance.unified_ledger applies, so the rules are tested here
// without a live database. The database is still the read the pages use;
// this helper is the tested copy of its rules, and the two must stay the
// same — a rule changed here must change there too, and vice versa.
//
// Rules, in plain words:
// - A row counts once, and only once: rows are deduped by their key
//   within their own source. Manually recorded rows and imported rows
//   never share a key, so the two stores never cancel each other out.
// - Only fully paid rows count. A manually recorded row counts only when
//   it is already counted; an imported row counts only when its fully
//   paid flag is set. Anything else sits in the unconfirmed count,
//   never in a total.
// - Revenue is the invoice amount less any wallet top-up part; cost is
//   approved expenses only; profit is revenue less cost. A missing cost
//   stays empty (null), never 0, and profit stays empty with it.
// - A row with no revenue figure carries no money and is dropped, never
//   counted as 0.
// - A row that carries a discount-code attribution is flagged promo and,
//   on a plain view, sits apart from the totals — never mixed into a
//   company's own totals. On a code view (a code is asked for), only
//   rows for that code belong in the view, and promo rows for that code
//   are the view's rows, so they do count there.
// - Settlement is never read, and no VAT appears anywhere here.

import { roundMoney } from '@/modules/imports/money';

export type UnifiedSource = 'manual' | 'import';

export type UnifiedInputRow = {
  /** The dedupe key within its own source (an id, or a transaction/invoice number pair). */
  key: string;
  source: UnifiedSource;
  partnerId: string | null;
  createdOn: string;
  transactionNumber: string | null;
  invoiceNumber: string | null;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  /** Manually recorded: already counted by finance.ledger. Imported: fully paid. */
  counted: boolean;
  /** True when the row carries a discount-code attribution. */
  isPromo: boolean;
  /** The code text an imported row arrived with, or null. */
  code: string | null;
  discount: number | null;
};

export type UnifiedTotals = {
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  withoutCost: number;
  manualUnits: number;
  importUnits: number;
  promoUnits: number;
  unconfirmedUnits: number;
};

export type UnifiedResult = {
  rows: UnifiedInputRow[];
  promoRows: UnifiedInputRow[];
  totals: UnifiedTotals;
};

function emptyTotals(): UnifiedTotals {
  return {
    units: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    withoutCost: 0,
    manualUnits: 0,
    importUnits: 0,
    promoUnits: 0,
    unconfirmedUnits: 0,
  };
}

/**
 * Merge manually recorded rows with imported rows into one read. `code`
 * asks for one code's view; without it the view is the plain company
 * view, where promo rows stay apart from the totals.
 */
export function unifyRows(rows: UnifiedInputRow[], opts: { code?: string | null } = {}): UnifiedResult {
  const codeView = !!opts.code;
  const seen = new Set<string>();
  const out: UnifiedInputRow[] = [];
  const promoRows: UnifiedInputRow[] = [];
  const totals = emptyTotals();
  for (const row of rows) {
    const dedupeKey = `${row.source}:${row.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (row.revenue === null) continue;
    if (!row.counted) {
      totals.unconfirmedUnits += 1;
      continue;
    }
    if (codeView) {
      // A code view holds only that code's rows. Manually recorded rows
      // arrive already filtered by the database; imported rows match by
      // their code text (the import stores no code id — see NOTES.md).
      if (row.source === 'import' && row.code !== opts.code) continue;
    } else if (row.isPromo) {
      promoRows.push(row);
      totals.promoUnits += 1;
      continue;
    }
    out.push(row);
    totals.units += 1;
    totals.revenue = roundMoney(totals.revenue + row.revenue);
    if (row.cost !== null) totals.cost = roundMoney(totals.cost + row.cost);
    if (row.profit !== null) totals.profit = roundMoney(totals.profit + row.profit);
    if (row.cost === null) totals.withoutCost += 1;
    if (row.source === 'manual') totals.manualUnits += 1;
    else totals.importUnits += 1;
  }
  return { rows: out, promoRows, totals };
}
