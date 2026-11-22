import type { CodeState, LedgerReport, LedgerRow, NotYetCountedRow, UnifiedPromoRow } from '../types';

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {});
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
/** What a code text matched, as the database names it; anything else is no state. */
const codeState = (v: unknown): CodeState => (v === 'found' || v === 'not_found' || v === 'ambiguous' ? v : null);
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
    // Landing 32: a row counts unless the database says it does not (an older answer listed counted rows only)
    counted: r.counted !== false,
    excluded_by: text(r.excluded_by),
    not_counted_reason: text(r.not_counted_reason),
    excluded_row_level: r.excluded_row_level === true,
    number: text(r.number),
    source_partner_id: text(r.source_partner_id),
    merged_by: r.merged_by === 'client_id' || r.merged_by === 'discount_code' ? r.merged_by : null,
    code_state: codeState(r.code_state),
    // a row that does not count carries no cost and no profit, whatever arrived
    ...(r.counted === false ? { cost: null, profit: null } : {}),
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
    // only when the answer carries it: an older answer has no such part
    ...(p.code_state !== undefined ? { code_state: codeState(p.code_state) } : {}),
  }));
  // Landing 37: the documents not fully paid yet. A row with no amount is no row; a link is kept only when it is a
  // web address (the database stores what the file gave).
  const notYetCounted = list(either(a, 'not_yet_counted', 'notYetCounted')).flatMap((n): NotYetCountedRow[] => {
    const amount = num(n.amount);
    if (amount === null) return [];
    const link = text(n.direct_url);
    return [
      {
        invoice_id: String(n.invoice_id ?? ''),
        unit_kind: text(n.unit_kind) ?? '',
        transaction_number: text(n.transaction_number),
        invoice_number: text(n.invoice_number),
        number: text(n.number),
        partner_id: text(n.partner_id),
        partner_number: text(n.partner_number),
        trade_name_en: text(n.trade_name_en),
        trade_name_ar: text(n.trade_name_ar),
        created_on: text(n.created_on) ?? '',
        amount,
        received: num(n.received),
        remaining: num(n.remaining),
        status: text(n.status),
        source: n.source === 'import' ? 'import' : 'manual',
        direct_url: link && /^https?:\/\//i.test(link) ? link : null,
      },
    ];
  });
  return {
    ...(a as unknown as LedgerReport),
    totals: {
      ...(totals as unknown as LedgerReport['totals']),
      // null stays null: no counted row has a cost, so there is no cost and no profit to show — never 0
      cost: num(totals.cost),
      profit: num(totals.profit),
      excludedUnits: count('excluded_units', 'excludedUnits'),
      excludedRevenue: count('excluded_revenue', 'excludedRevenue'),
      manualUnits: count('manual_units', 'manualUnits'),
      importUnits: count('import_units', 'importUnits'),
      promoUnits: count('promo_units', 'promoUnits'),
      unconfirmedImportUnits: count('unconfirmed_import_units', 'unconfirmedImportUnits'),
      notYetCountedUnits: count('not_yet_counted_units', 'notYetCountedUnits'),
      notYetCountedAmount: count('not_yet_counted_amount', 'notYetCountedAmount'),
    },
    companies: list(a.companies) as unknown as LedgerReport['companies'],
    by_company: list(a.by_company).map((c) => ({
      ...(c as unknown as LedgerReport['by_company'][number]),
      cost: num(c.cost),
      profit: num(c.profit),
    })),
    invoices: list(a.invoices).map((v) => ({
      ...(v as unknown as LedgerReport['invoices'][number]),
      transactions: Array.isArray(v.transactions) ? (v.transactions as string[]) : [],
    })),
    rows,
    truncated: a.truncated === true,
    promoRows,
    codeDiscount: num(either(a, 'code_discount', 'codeDiscount')),
    canToggle: either(a, 'can_toggle', 'canToggle') === true,
    notYetCounted,
  };
}
