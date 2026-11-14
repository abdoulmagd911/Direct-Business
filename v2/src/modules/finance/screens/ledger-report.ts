import type { LedgerReport, LedgerRow, UnifiedPromoRow } from '../types';

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
/** The first of two names that is present: the database's own name, else the report's. */
const either = (r: Raw, db: string, screen: string): unknown => (r[db] !== undefined ? r[db] : r[screen]);

/**
 * The unified ledger's answer (api.finance_unified_ledger) as the report draws it. The database answers in its own
 * names — `promo_rows`, `code_discount`, `manual_units`, `unconfirmed_import_units`, a row's `is_promo` and
 * `discount_sar`, a promo row's `transaction_ref` / `invoice_ref` / `record_date` — and the report reads them here,
 * once. Read under the report's own names, they were never there: the discount-code rows (kept apart from the totals)
 * vanished from the page, and the source counts and a code's total discount were never shown.
 */
export function ledgerReportOf(answer: unknown): LedgerReport {
  const a = obj(answer);
  const totals = obj(a.totals);
  const count = (db: string, screen: string) => num(either(totals, db, screen)) ?? undefined;
  const rows = list(a.rows).map((r): LedgerRow => ({
    ...(r as unknown as LedgerRow),
    flags: Array.isArray(r.flags) ? (r.flags as string[]) : [],
    isPromo: either(r, 'is_promo', 'isPromo') === true,
    discountSar: num(either(r, 'discount_sar', 'discountSar')),
  }));
  const promoRows = list(either(a, 'promo_rows', 'promoRows')).map((p): UnifiedPromoRow => ({
    id: String(p.id ?? ''),
    partner_id: text(p.partner_id),
    transaction_number: text(either(p, 'transaction_ref', 'transaction_number')),
    invoice_number: text(either(p, 'invoice_ref', 'invoice_number')),
    created_on: text(either(p, 'record_date', 'created_on')) ?? '',
    code: text(p.code),
    discount_sar: num(p.discount_sar),
    revenue: num(p.revenue),
    cost: num(p.cost),
    profit: num(p.profit),
    counted: p.counted === true,
    direct_url: text(p.direct_url),
  }));
  return {
    ...(a as unknown as LedgerReport),
    totals: {
      ...(totals as unknown as LedgerReport['totals']),
      manualUnits: count('manual_units', 'manualUnits'),
      importUnits: count('import_units', 'importUnits'),
      promoUnits: count('promo_units', 'promoUnits'),
      unconfirmedImportUnits: count('unconfirmed_import_units', 'unconfirmedImportUnits'),
    },
    companies: list(a.companies) as unknown as LedgerReport['companies'],
    by_company: list(a.by_company) as unknown as LedgerReport['by_company'],
    invoices: list(a.invoices).map((v) => ({
      ...(v as unknown as LedgerReport['invoices'][number]),
      transactions: Array.isArray(v.transactions) ? (v.transactions as string[]) : [],
    })),
    rows,
    truncated: a.truncated === true,
    promoRows,
    codeDiscount: num(either(a, 'code_discount', 'codeDiscount')),
  };
}
