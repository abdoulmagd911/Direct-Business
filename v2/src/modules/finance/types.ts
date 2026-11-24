// The shapes the Finance reads answer in (api.finance_period, finance_closed_months, finance_health, …). The wrappers
// return jsonb, so the screen states what it reads here; a read that does not fit fails in words, never as 0 (M27, M53).
import type { CommissionType, DealType, DealTypeBy, DealTypeLine } from './deal-type';

export type Part = { units: number; revenue: number; cost: number; profit: number };

export type MonthFigure = {
  month_on: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  provisional_units: number;
  provisional_revenue: number;
  provisional_profit: number;
  losses: number;
};

export type Period = {
  from: string;
  to: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  provisional: Part;
  losses: number;
  months: MonthFigure[];
};

export type LateChange = {
  invoice_id: string;
  ref: string;
  unit_kind: string;
  change: 'late_paid' | 'dropped' | 'revenue_changed' | 'cost_changed';
  revenue_change: number | null;
  cost_change: number | null;
  changed_on: string | null;
};

export type ClosedMonth = {
  month: string;
  closed_on: string;
  closed_by: string;
  note: string | null;
  frozen: Part;
  late_changes: LateChange[];
};

export type HealthEntry = { key: string; count: number; amount_sar: number | null };

export type NotInvoiced = {
  ready: { units: number; amount_sar: number };
  pending: { units: number; amount_sar: number };
};

export type PaymentsAsOf = { as_of: string | null; files: Record<string, string> };

export type ServiceRow = {
  part: 'service' | 'not_income' | 'no_service' | 'not_split';
  service_id: string | null;
  service_key: string | null;
  name_en: string | null;
  name_ar: string | null;
  revenue: number;
  cost: number;
  units: number;
};

export type IncomeByService = { from: string; to: string; revenue: number; rows: ServiceRow[]; gap: number };

/** The Finance page's extra filters (workstream B): the date range stays the period switch's own. */
export type LedgerFilter = {
  partner?: string;
  clientId?: string;
  kind?: 'transaction' | 'standalone' | 'billing' | 'credit_note' | 'wallet_topup';
  code?: string;
};

/** One company the filtered view can pick, as finance.ledger lists it (never the company filter applied). */
export type LedgerCompany = {
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  units: number;
};

/** One row of the ledger: a revenue unit with its two numbers apart (see finance.ledger). */
export type LedgerRow = {
  invoice_id: string;
  unit_kind: string;
  transaction_number: string | null;
  invoice_number: string | null;
  partner_id: string | null;
  created_on: string;
  revenue: number;
  /** Empty (null) while no approved expense exists — never 0, except a genuine no-supplier-cost 0. */
  cost: number | null;
  profit: number | null;
  dpin: string | null;
  flags: string[];
  /** Where the row came from: recorded here ('manual') or arrived by import ('import'). */
  source: 'manual' | 'import';
  /** True when the row carries a discount-code attribution. */
  isPromo: boolean;
  /** The discount on this row, when it carries one; otherwise null. */
  discountSar: number | null;
  /**
   * Landing 32 — "Counted?". The ledger now LISTS rows that do not count too; a row counts unless `counted` is
   * false (an older read leaves it out, and every row it listed counted). A row that does not count has no cost and
   * no profit, and is never part of a total.
   */
  counted?: boolean;
  /** The kind of rule that keeps the row out (client_id · name · tax_no · discount_code · invoice · product · partner). */
  excluded_by?: string | null;
  /** The reason typed when the row (or the list rule that catches it) was excluded. */
  not_counted_reason?: string | null;
  /** True: excluded by hand on this row — Include can undo it. False: a list rule in Settings catches it. */
  excluded_row_level?: boolean;
  /** The row's own number — what Exclude / Include takes. */
  number?: string | null;
  /** The organisation the row is recorded under — what Exclude / Include takes (never `partner_id` after a merge). */
  source_partner_id?: string | null;
  /** Set when the merge list moved the row under another organisation. */
  merged_by?: 'client_id' | 'discount_code' | null;
  /** What the code text on the row matched: one code, none, or more than one. */
  code_state?: CodeState;
  /** Landing 47 (A5): prepaid, postpaid, tender or promo; null = not set (nothing settles it yet). */
  deal_type?: DealType | null;
  /** What decided the deal type: a person, the invoice's client ID, its code, or its organisation's own kind. */
  deal_type_by?: DealTypeBy | null;
  /** Landing 47 (A12): a counted row of a postpaid deal — paid, and still to be settled by the organisation. */
  receivable?: boolean;
  /** Landing 47 (A14): the row carries a DPIN — its tax invoice is issued. */
  tax_invoice_issued?: boolean;
  /** Landing 47 (A7): which provider commission a hand-typed commission is. */
  commission_type?: CommissionType | null;
};

/** What a code text matched in the codes list; null when the row carries no code text. */
export type CodeState = 'found' | 'not_found' | 'ambiguous' | null;

/** One month (or one year) of "Is it counted?" — api.finance_counted_by_month. */
export type CountedFigures = {
  counted_units: number;
  counted_revenue: number;
  not_counted_units: number;
  not_counted_revenue: number;
  excluded_units: number;
  excluded_revenue: number;
  not_paid_units: number;
  not_paid_revenue: number;
  promo_pool_units: number;
  promo_pool_revenue: number;
};
export type CountedMonth = CountedFigures & { month_on: string };
export type CountedYear = CountedFigures & { year: number };
export type CountedByMonth = { from: string; to: string; months: CountedMonth[]; years: CountedYear[] };

/** One imported row that carries a discount-code attribution, kept apart from a plain view's totals. */
export type UnifiedPromoRow = {
  id: string;
  partner_id: string | null;
  transaction_number: string | null;
  invoice_number: string | null;
  created_on: string;
  code: string | null;
  discount_sar: number | null;
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  /** Whether this row counts for its code (fully paid). */
  counted: boolean;
  direct_url: string | null;
  /** What this row's code text matched (Landing 32); an older read leaves it out. */
  code_state?: CodeState;
};

/**
 * Landing 37 (A6) — one document that is not fully paid yet (Pending, Draft, part paid; an imported row not
 * confirmed paid). The Ledger lists it apart, with its amount; it is in no total until it is paid.
 */
export type NotYetCountedRow = {
  invoice_id: string;
  unit_kind: string;
  transaction_number: string | null;
  invoice_number: string | null;
  /** The row's own number: its transaction number, else its invoice number. */
  number: string | null;
  /** The organisation it would count under; null while its client is not known. */
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  created_on: string;
  /** The revenue that is not counted yet. */
  amount: number;
  /** What has arrived so far; empty for an imported row (its receipts are not read). */
  received: number | null;
  /** What is still to arrive; empty when the document carries no total. */
  remaining: number | null;
  /** The status word as it was recorded (Pending, Draft …). */
  status: string | null;
  source: 'manual' | 'import';
  /** The record's own page in Direct, when it carries one. */
  direct_url: string | null;
  /** Landing 47 (A5): the document's deal type; null = not set. An older read leaves it out. */
  deal_type?: DealType | null;
};

/** One invoice of the ledger: its total, what arrived, what is left, and its transactions. */
export type LedgerInvoice = {
  invoice_id: string;
  invoice_number: string | null;
  kind: string;
  partner_id: string | null;
  total_sar: number | null;
  received_sar: number;
  remaining_sar: number | null;
  dpin: string | null;
  transactions: string[];
};

/** One company's part of the filtered view: received and remaining come from its invoices, never its unit rows. */
export type LedgerByCompany = {
  partner_id: string | null;
  units: number;
  revenue: number;
  /** Empty (null) when none of this organisation's counted rows has a cost — never 0; profit is empty with it. */
  cost: number | null;
  profit: number | null;
  without_cost: number;
  received: number;
  remaining: number;
};

/** Everything finance.unified_ledger answers for one filtered view; the Codes page reads the same shape (by code). */
export type LedgerReport = {
  from: string;
  to: string;
  partner: string | null;
  client_id: string | null;
  kind: string | null;
  code: string | null;
  project: string | null;
  totals: {
    units: number;
    revenue: number;
    /** Empty (null) when no counted row has a cost — never 0; profit is empty with it. Counted rows only. */
    cost: number | null;
    profit: number | null;
    without_cost: number;
    received: number;
    remaining: number;
    /** The rows an exclusion keeps out of every figure above, and their revenue — said apart, never added in. */
    excludedUnits?: number;
    excludedRevenue?: number;
    /** Only the unified read fills these; an older read leaves them out. */
    manualUnits?: number;
    importUnits?: number;
    promoUnits?: number;
    unconfirmedImportUnits?: number;
    /** Landing 37: the documents not fully paid yet, and their amount — said apart, never part of `revenue`. */
    notYetCountedUnits?: number;
    notYetCountedAmount?: number;
  };
  companies: LedgerCompany[];
  by_company: LedgerByCompany[];
  invoices: LedgerInvoice[];
  rows: LedgerRow[];
  truncated: boolean;
  /** Imported code rows kept apart from a plain view's totals; empty on a code view. */
  promoRows?: UnifiedPromoRow[];
  /** The discount for the code asked for, when a code is asked for; otherwise null. */
  codeDiscount?: number | null;
  /** True when the reader may Exclude / Include a row (an admin); everyone else reads the column only. */
  canToggle?: boolean;
  /** Landing 37: the documents not fully paid yet, listed apart; an older read leaves it out. */
  notYetCounted?: NotYetCountedRow[];
  /** Landing 47 (A5): the listed counted rows added up by deal type — the database's own lines. */
  byDealType?: DealTypeLine[];
  /** True when the reader may set a row's deal type (Full on Finance). */
  canSetDealType?: boolean;
};

/** Everything the Overview reads in one go; a part that failed is null and says so on the screen. */
export type OverviewData = {
  period: Period | null;
  closed: ClosedMonth[] | null;
  health: HealthEntry[] | null;
  notInvoiced: NotInvoiced | null;
  asOf: PaymentsAsOf | null;
  service: IncomeByService | null;
};
