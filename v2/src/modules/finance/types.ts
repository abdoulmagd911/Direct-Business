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

/** Everything the Overview reads in one go; a part that failed is null and says so on the screen. */
export type OverviewData = {
  period: Period | null;
  closed: ClosedMonth[] | null;
  health: HealthEntry[] | null;
  notInvoiced: NotInvoiced | null;
  asOf: PaymentsAsOf | null;
  service: IncomeByService | null;
};
