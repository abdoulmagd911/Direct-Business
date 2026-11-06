// The shapes the Finance reads answer in (api.finance_period, finance_closed_months, finance_health, …). The wrappers
// return jsonb, so the screen states what it reads here; a read that does not fit fails in words, never as 0 (M27, M53).

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
  /** Accepted and kept in saved views; no project link exists yet, so it changes nothing (see finance.ledger). */
  project?: string;
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
};

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
  cost: number;
  profit: number;
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
    cost: number;
    profit: number;
    without_cost: number;
    received: number;
    remaining: number;
    /** Only the unified read fills these; an older read leaves them out. */
    manualUnits?: number;
    importUnits?: number;
    promoUnits?: number;
    unconfirmedImportUnits?: number;
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
