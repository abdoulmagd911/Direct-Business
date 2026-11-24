// Landing 47 — the marks a Ledger row carries beside its money (finance.ledger_marks): its deal type (A5), whether a
// postpaid row is paid but receivable (A12), whether its tax invoice is issued (A14) and, on a hand-typed commission,
// which commission it is (A7). Pure helpers: the report, its file and the tests read the same rules. None of this
// touches a figure — the database's totals are drawn as they come.

export const DEAL_TYPES = ['prepaid', 'postpaid', 'tender', 'promo'] as const;
export type DealType = (typeof DEAL_TYPES)[number];
/** What decided a row's deal type: a person, the client ID on its invoice, its code, or its organisation's own kind. */
export type DealTypeBy = 'person' | 'client_id' | 'code' | 'organisation';

export const COMMISSION_TYPES = ['airlines', 'provider', 'cashback', 'study_abroad', 'other'] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

/** A deal type as the database names it; anything else — and a row nothing settles — is null: "not set". */
export const dealTypeOf = (v: unknown): DealType | null =>
  (DEAL_TYPES as readonly unknown[]).includes(v) ? (v as DealType) : null;
export const dealTypeByOf = (v: unknown): DealTypeBy | null =>
  v === 'person' || v === 'client_id' || v === 'code' || v === 'organisation' ? v : null;
export const commissionTypeOf = (v: unknown): CommissionType | null =>
  (COMMISSION_TYPES as readonly unknown[]).includes(v) ? (v as CommissionType) : null;

/** The Ledger's deal-type filter: every row, one deal type, or the rows whose deal type is not set. */
export type DealFilter = 'all' | DealType | 'none';
export const DEAL_FILTERS: readonly DealFilter[] = ['all', ...DEAL_TYPES, 'none'];

/** The rows a deal-type filter keeps. "none" keeps the rows that are not set — they are never hidden by a filter. */
export function filterByDeal<T extends { deal_type?: DealType | null }>(rows: T[], filter: DealFilter): T[] {
  if (filter === 'all') return rows;
  if (filter === 'none') return rows.filter((r) => !r.deal_type);
  return rows.filter((r) => r.deal_type === filter);
}

const ORDER: Record<string, number> = { prepaid: 0, postpaid: 1, tender: 2, promo: 3 };
/** The rows by deal type — prepaid, postpaid, tender, promo, then not set — each group in the order it came. */
export function sortByDeal<T extends { deal_type?: DealType | null }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i, o: r.deal_type ? (ORDER[r.deal_type] ?? 4) : 4 }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.r);
}

/** The listed counted rows of one deal type, added up by the database (`by_deal_type`). A missing cost stays empty. */
export type DealTypeLine = {
  deal_type: DealType | null;
  units: number;
  revenue: number;
  cost: number | null;
  profit: number | null;
  without_cost: number;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** `by_deal_type` as the report draws it; a line with no count is no line. */
export function dealTypeLinesOf(v: unknown): DealTypeLine[] {
  if (!Array.isArray(v)) return [];
  return (v as Record<string, unknown>[]).flatMap((g): DealTypeLine[] => {
    const units = num(g?.units);
    if (units === null) return [];
    return [
      {
        deal_type: dealTypeOf(g.deal_type),
        units,
        revenue: num(g.revenue) ?? 0,
        cost: num(g.cost),
        profit: num(g.profit),
        without_cost: num(g.without_cost) ?? 0,
      },
    ];
  });
}
