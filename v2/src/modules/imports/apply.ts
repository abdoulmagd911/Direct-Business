// The Confirm call's payload, built from the preview the person already saw.
//
// One row per preview row that is written (held rows are never in it — they travel
// apart as `held`, with their reasons, and the database counts them as excluded).
// A row is the normalised record as the apply function reads it: `row_no` is the
// spreadsheet row number (header is row 1), and the money fields carry the
// normaliser's own names (`amount`, `wallet_topup`, `cost`, `promo_before` …),
// because that is what work.import_apply reads. Duplicate choices travel as
// `decisions`: a kept duplicate is written, a skipped one is counted unchanged.
import type { ExistingRecord } from './preview';
import type { HeldRow, NormalisedRow } from './normalise';
import type { Preview, PreviewDecisions } from './preview';

export type ApplyRow = Record<string, unknown>;

export function toApplyPayload(
  preview: Preview,
  records: NormalisedRow[],
  decisions: PreviewDecisions,
): { rows: ApplyRow[]; held: HeldRow[]; decisions: PreviewDecisions } {
  const byRowNo = new Map(records.map((r) => [r.rowNos[0] ?? 2, r]));
  const rows: ApplyRow[] = [];
  for (const p of preview.rows) {
    if (p.outcome === 'excluded') continue;
    const record = byRowNo.get(p.row_no);
    if (!record) continue;
    rows.push({
      row_no: record.rowNos[0] ?? 2,
      kind: record.kind,
      transaction_ref: record.transaction_ref,
      invoice_ref: record.invoice_ref,
      tax_no: record.tax_no,
      record_date: record.record_date,
      amount: record.amount,
      wallet_topup: record.wallet_topup,
      cost: record.cost,
      status_text: record.status_text,
      fully_paid: record.fully_paid,
      audit_required: record.audit_required,
      provisional: record.provisional,
      product: record.product,
      expense_gate: record.expense_gate,
      source_promo: record.source_promo,
      promo_before: record.promo_before,
      promo_discount: record.promo_discount,
      promo_after: record.promo_after,
      direct_url: record.direct_url,
      direct_ref: record.direct_ref,
      duplicate: p.duplicate,
    });
  }
  return { rows, held: preview.problems, decisions };
}

/** One stored import row, as api.import_ledger answers it. */
export type ImportLedgerRecord = {
  transaction_ref?: unknown;
  invoice_ref?: unknown;
  tax_no?: unknown;
  record_date?: unknown;
  amount_sar?: unknown;
  wallet_topup_sar?: unknown;
  cost_sar?: unknown;
  status_text?: unknown;
  fully_paid?: unknown;
  provisional?: unknown;
  source_promo?: unknown;
  product?: unknown;
};

const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * The stored rows for one partner, in the shape buildPreview matches against: what
 * is already there decides whether an incoming row is new, updated, or unchanged.
 * Anything the ledger does not answer is treated as absent, never invented.
 */
export function existingFromImportLedger(answer: unknown): ExistingRecord[] {
  const rows = (answer as { records?: unknown } | null)?.records;
  if (!Array.isArray(rows)) return [];
  return (rows as ImportLedgerRecord[]).map((r) => ({
    transaction_ref: textOrNull(r.transaction_ref),
    invoice_ref: textOrNull(r.invoice_ref),
    tax_no: textOrNull(r.tax_no),
    record_date: textOrNull(r.record_date),
    amount: numOrNull(r.amount_sar),
    wallet_topup: typeof r.wallet_topup_sar === 'number' ? r.wallet_topup_sar : 0,
    cost: numOrNull(r.cost_sar),
    status_text: textOrNull(r.status_text),
    fully_paid: r.fully_paid === true,
    provisional: r.provisional === true,
    source_promo: textOrNull(r.source_promo),
    product: textOrNull(r.product),
  }));
}
