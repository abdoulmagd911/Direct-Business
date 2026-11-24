// Landing 47 — the three reads beside the Ledger (finance.reconciliation, finance.ageing, finance.held_rows) as the
// cards draw them. Pure: each answer is read into its shape once, here; an answer that is not that shape is null — a
// failed read, said so on the card, never an empty list that would read as "all is well". No figure is worked out
// here: every amount is the database's own.
import { formatDate } from '@/core/i18n/format';
import { dealTypeOf, type DealType } from './deal-type';

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

// ------------------------------------------------------------------ A10 — Finance agrees with itself
export type Side = { units: number | null; revenue: number | null; cost: number | null; profit: number | null };
export type GapKind = 'sides' | 'row_profit' | 'cost_lines' | 'organisations';
export type Gap = {
  kind: GapKind;
  /** The figure the two sides part on (sides, organisations). */
  figure: 'units' | 'revenue' | 'cost' | 'profit' | null;
  /** The row's own number (row_profit, cost_lines). */
  number: string | null;
  left: number | null;
  right: number | null;
  difference: number;
  /** 1 SAR or more (or any difference in a count): a failure, not a rounding note. */
  failing: boolean;
};
export type Reconciliation = {
  overview: Side;
  ledger: Side;
  gaps: Gap[];
  agrees: boolean;
  failing: number;
  /** The Ledger's row list was cut: the row checks covered the listed rows only. */
  rowsTruncated: boolean;
};

const sideOf = (v: unknown): Side | null => {
  const s = obj(v);
  if (!s) return null;
  return { units: num(s.units), revenue: num(s.revenue), cost: num(s.cost), profit: num(s.profit) };
};
const KINDS: readonly GapKind[] = ['sides', 'row_profit', 'cost_lines', 'organisations'];
const FIGURES = ['units', 'revenue', 'cost', 'profit'] as const;

/** api.finance_reconciliation as the card draws it. "Agrees" is said only when the answer has no gap at all. */
export function reconciliationOf(answer: unknown): Reconciliation | null {
  const a = obj(answer);
  if (!a || !Array.isArray(a.gaps)) return null;
  const overview = sideOf(a.overview);
  const ledger = sideOf(a.ledger);
  if (!overview || !ledger) return null;
  const gaps: Gap[] = [];
  for (const g of a.gaps as Raw[]) {
    const difference = num(g?.difference);
    if (!KINDS.includes(g?.kind as GapKind) || difference === null) return null;
    gaps.push({
      kind: g.kind as GapKind,
      figure: (FIGURES as readonly unknown[]).includes(g.figure) ? (g.figure as Gap['figure']) : null,
      number: text(g.number),
      left: num(g.left),
      right: num(g.right),
      difference,
      failing: g.failing === true,
    });
  }
  // A missing cost is empty, never 0. The Finance page's read answers 0 where no counted row has a cost; the Ledger
  // answers nothing. When the Ledger has no cost (or no profit) and the page's figure is that 0, the page's side has
  // nothing to show either — a dash, like the Ledger's, and never a 0 that would read as a known cost.
  const emptyLike = (page: number | null, ledgerFigure: number | null) =>
    ledgerFigure === null && page === 0 ? null : page;
  return {
    overview: {
      ...overview,
      cost: emptyLike(overview.cost, ledger.cost),
      profit: emptyLike(overview.profit, ledger.profit),
    },
    ledger,
    gaps,
    // never taken on trust: no gap listed is what agreement is
    agrees: gaps.length === 0,
    failing: gaps.filter((g) => g.failing).length,
    rowsTruncated: a.rows_truncated === true,
  };
}

// ------------------------------------------------------------------ A6 — outstanding and how old
export const AGE_BUCKETS = ['days_0_30', 'days_31_60', 'days_61_90', 'days_over_90'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number] | 'no_date';
export type AgeingRow = {
  source: 'manual' | 'import';
  number: string | null;
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  issued_on: string | null;
  outstanding: number;
  age_days: number | null;
  bucket: AgeBucket;
  deal_type: DealType | null;
};
export type AgeingCompany = {
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  units: number;
  outstanding: number;
  oldest_days: number | null;
  days_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
};
export type Ageing = {
  as_of: string | null;
  all: boolean;
  outstanding: number;
  units: number;
  buckets: Record<(typeof AGE_BUCKETS)[number], number>;
  companies: AgeingCompany[];
  rows: AgeingRow[];
  truncated: boolean;
};

const bucketOf = (v: unknown): AgeBucket =>
  (AGE_BUCKETS as readonly unknown[]).includes(v) ? (v as AgeBucket) : 'no_date';

/** api.finance_ageing as the card draws it. A row with no amount owed is no row. */
export function ageingOf(answer: unknown): Ageing | null {
  const a = obj(answer);
  if (!a || !Array.isArray(a.rows) || !Array.isArray(a.companies)) return null;
  const outstanding = num(a.outstanding);
  if (outstanding === null) return null;
  const b = obj(a.buckets) ?? {};
  const rows = (a.rows as Raw[]).flatMap((r): AgeingRow[] => {
    const owed = num(r?.outstanding);
    if (owed === null || owed <= 0) return [];
    return [
      {
        source: r.source === 'import' ? 'import' : 'manual',
        number: text(r.number),
        partner_id: text(r.partner_id),
        partner_number: text(r.partner_number),
        trade_name_en: text(r.trade_name_en),
        trade_name_ar: text(r.trade_name_ar),
        issued_on: text(r.issued_on),
        outstanding: owed,
        age_days: num(r.age_days),
        bucket: bucketOf(r.bucket),
        deal_type: dealTypeOf(r.deal_type),
      },
    ];
  });
  const companies = (a.companies as Raw[]).flatMap((c): AgeingCompany[] => {
    const owed = num(c?.outstanding);
    if (owed === null) return [];
    return [
      {
        partner_id: text(c.partner_id),
        partner_number: text(c.partner_number),
        trade_name_en: text(c.trade_name_en),
        trade_name_ar: text(c.trade_name_ar),
        units: num(c.units) ?? 0,
        outstanding: owed,
        oldest_days: num(c.oldest_days),
        days_0_30: num(c.days_0_30) ?? 0,
        days_31_60: num(c.days_31_60) ?? 0,
        days_61_90: num(c.days_61_90) ?? 0,
        days_over_90: num(c.days_over_90) ?? 0,
      },
    ];
  });
  return {
    as_of: text(a.as_of),
    all: a.all === true,
    outstanding,
    units: num(a.units) ?? rows.length,
    buckets: {
      days_0_30: num(b.days_0_30) ?? 0,
      days_31_60: num(b.days_31_60) ?? 0,
      days_61_90: num(b.days_61_90) ?? 0,
      days_over_90: num(b.days_over_90) ?? 0,
    },
    companies,
    rows,
    truncated: a.truncated === true,
  };
}

// ------------------------------------------------------------------ A11 — held, never dropped
export const HELD_REASONS = ['no_organisation', 'no_client_id', 'same_number'] as const;
export type HeldReason = (typeof HELD_REASONS)[number];
export type HeldRow = {
  reason: HeldReason;
  source: 'manual' | 'import';
  number: string | null;
  partner_id: string | null;
  partner_number: string | null;
  trade_name_en: string | null;
  trade_name_ar: string | null;
  created_on: string | null;
  amount: number | null;
  counted: boolean;
};
export type Held = {
  units: number;
  totals: Partial<Record<HeldReason, { units: number; amount: number }>>;
  rows: HeldRow[];
  truncated: boolean;
};

/** api.finance_held_rows as the card draws it. A reason the card does not know is not dropped: the read fails. */
export function heldOf(answer: unknown): Held | null {
  const a = obj(answer);
  if (!a || !Array.isArray(a.rows)) return null;
  const rows: HeldRow[] = [];
  for (const r of a.rows as Raw[]) {
    if (!(HELD_REASONS as readonly unknown[]).includes(r?.reason)) return null;
    rows.push({
      reason: r.reason as HeldReason,
      source: r.source === 'import' ? 'import' : 'manual',
      number: text(r.number),
      partner_id: text(r.partner_id),
      partner_number: text(r.partner_number),
      trade_name_en: text(r.trade_name_en),
      trade_name_ar: text(r.trade_name_ar),
      created_on: text(r.created_on),
      amount: num(r.amount),
      counted: r.counted === true,
    });
  }
  const totals: Held['totals'] = {};
  const t = obj(a.totals) ?? {};
  for (const reason of HELD_REASONS) {
    const g = obj(t[reason]);
    if (g) totals[reason] = { units: num(g.units) ?? 0, amount: num(g.amount) ?? 0 };
  }
  return { units: num(a.units) ?? rows.length, totals, rows, truncated: a.truncated === true };
}

// ------------------------------------------------------------------ A13 — a contract's payments
export type ContractInvoice = {
  number: string | null;
  source: 'manual' | 'import';
  created_on: string | null;
  amount: number | null;
  counted: boolean;
  status: string | null;
};
export type ContractPeriod = {
  period_start: string;
  units: number;
  total: number;
  not_yet_counted: number;
  invoices: ContractInvoice[];
};
export type ContractPayments = {
  grain: 'month' | 'quarter';
  from: string | null;
  to: string | null;
  units: number;
  total: number;
  not_yet_counted: number;
  periods: ContractPeriod[];
  truncated: boolean;
};

/** api.finance_contract_payments as the card draws it. A period with no start is no period: the read fails. */
export function contractPaymentsOf(answer: unknown): ContractPayments | null {
  const a = obj(answer);
  if (!a || !Array.isArray(a.periods)) return null;
  const total = num(a.total);
  if (total === null) return null;
  const periods: ContractPeriod[] = [];
  for (const p of a.periods as Raw[]) {
    const start = text(p?.period_start);
    const periodTotal = num(p?.total);
    if (!start || periodTotal === null) return null;
    periods.push({
      period_start: start,
      units: num(p.units) ?? 0,
      total: periodTotal,
      not_yet_counted: num(p.not_yet_counted) ?? 0,
      invoices: (Array.isArray(p.invoices) ? (p.invoices as Raw[]) : []).map((v) => ({
        number: text(v?.number),
        source: v?.source === 'import' ? 'import' : 'manual',
        created_on: text(v?.created_on),
        amount: num(v?.amount),
        counted: v?.counted === true,
        status: text(v?.status),
      })),
    });
  }
  return {
    grain: a.grain === 'quarter' ? 'quarter' : 'month',
    from: text(a.from),
    to: text(a.to),
    units: num(a.units) ?? 0,
    total,
    not_yet_counted: num(a.not_yet_counted) ?? 0,
    periods,
    truncated: a.truncated === true,
  };
}

/**
 * A period's own name, from its first day and never from today: a month is written by the one date formatter
 * ("March 2026"); a quarter is its number and year, handed to the caller's own wording ("Q1 2026").
 */
export function periodLabel(
  start: string,
  grain: 'month' | 'quarter',
  locale: 'en' | 'ar',
  quarterWord: (quarter: number, year: number) => string,
): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(start);
  if (!m) return start;
  if (grain === 'quarter') return quarterWord(Math.floor((Number(m[2]) - 1) / 3) + 1, Number(m[1]));
  return formatDate(`${start}T12:00:00+03:00`, locale, { day: undefined, month: 'long', year: 'numeric' });
}
