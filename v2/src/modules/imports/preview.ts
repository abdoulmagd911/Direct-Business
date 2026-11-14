// The five-count preview. Nothing saves until Confirm: this is pure, so the review screen
// and the database apply step can be checked against each other.
//
// Every incoming record gets exactly one outcome, in this order:
// 1. excluded by rule — a held row (not fully paid, wallet top-up only, unknown status,
//    unreadable amount, no key). It is not written.
// 2. unchanged — the merged record is identical to what is already stored. This wins over
//    needs-linking on purpose: re-importing the same file twice changes nothing the
//    second time, even for rows still waiting for their other half.
// 3. needs-linking — the merged record is new or changed but still incomplete: a missing
//    transaction number, a missing invoice number, a promo row with no invoice yet, or
//    an expense holding with no transaction details yet. It IS written, flagged.
// 4. new — a complete record never seen before. 5. updated — a complete record whose
//    stored figures changed.
//
// Writing in place: a later value overwrites an earlier one, but a blank never wipes a
// stored value. Duplicates inside one file are flagged with a skip/keep choice; skip is
// the default and counts as unchanged (nothing changes), keep diffs the row normally.
// Matching is by natural key only: invoice rows by Invoice Reference #, transaction and
// expense rows by transaction number, promo rows by the 10-digit Invoice Number only —
// never by DPIN, TTIN, or a receipt reference.

import type { HeldRow, NormalisedRow } from './normalise';
import { whyText, type Why } from './reasons';

export type ExistingRecord = {
  transaction_ref: string | null;
  invoice_ref: string | null;
  tax_no: string | null;
  record_date: string | null;
  amount: number | null;
  wallet_topup: number;
  cost: number | null;
  status_text: string | null;
  fully_paid: boolean;
  provisional: boolean;
  source_promo: string | null;
  product: string | null;
};

export type PreviewOutcome = 'new' | 'updated' | 'unchanged' | 'excluded' | 'needs_linking';

/** One changed field on a matched row, with its stored value and the incoming one (F182). */
export type PreviewChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type PreviewRow = {
  row_no: number;
  row_nos: number[];
  kind: NormalisedRow['kind'];
  outcome: PreviewOutcome;
  /** The reasons in English words; `whys` holds the same reasons as codes, in the same order, for the screen. */
  reasons: string[];
  whys: Why[];
  duplicate: boolean;
  transaction_ref: string | null;
  invoice_ref: string | null;
  /** The stored record this row matched, or null for a new row — so the reviewer can see which record the
   * preview is talking about and what changes on it. Held rows carry neither: they matched nothing. */
  matched: ExistingRecord | null;
  /** The changed fields as old → new pairs (empty when nothing changed). */
  changes: PreviewChange[];
  /** The row's own values as they will be written (the merged record) — so the preview can show
   * them when there is no matched record to diff against. Null for held and skipped rows, which
   * carry no values of their own. */
  values: ExistingRecord | null;
  /** Promo discount figures, from the row itself: a promo row carries no amount of its own, so
   * these travel apart from `values` (null for every other kind). */
  promo_before: number | null;
  promo_discount: number | null;
  promo_after: number | null;
};

export type PreviewCounts = {
  new: number;
  updated: number;
  unchanged: number;
  excluded: number;
  needs_linking: number;
};

export type Preview = {
  counts: PreviewCounts;
  rows: PreviewRow[];
  /** Held rows, with row numbers and plain reasons. */
  problems: HeldRow[];
  /** Same invoice number already held by another row: written, flagged, held for a person. */
  clashes: { row_no: number; reason: string; why: Why }[];
};

export type PreviewDecisions = Record<number, 'skip' | 'keep'>;

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005;
  return a === b;
}

/**
 * Merge an incoming record over an existing one: incoming blanks never wipe stored values.
 *
 * One rule matters for grouped invoices: the amount lives on the transaction, never on
 * the invoice as a second money row. So when an invoice row meets an existing transaction
 * row, it fills only the tax number, status, paid state, and a missing date — it never
 * overwrites the transaction's own amount. When it meets its own invoice-only row (no
 * transaction yet), its figures apply in full. `groupSize` is how many transaction rows
 * already share this invoice number: a wallet part is only ever taken onto a single
 * transaction row, never spread across a group.
 */
export function mergedRecord(existing: ExistingRecord | null, incoming: NormalisedRow, groupSize = 1): ExistingRecord {
  const base: ExistingRecord = existing ?? {
    transaction_ref: null,
    invoice_ref: null,
    tax_no: null,
    record_date: null,
    amount: null,
    wallet_topup: 0,
    cost: null,
    status_text: null,
    fully_paid: false,
    provisional: false,
    source_promo: null,
    product: null,
  };
  const pick = <T>(next: T | null, current: T | null): T | null =>
    next === null || next === undefined ? current : next;
  if (incoming.kind === 'invoice' && base.transaction_ref !== null) {
    return {
      ...base,
      tax_no: pick(incoming.tax_no, base.tax_no),
      record_date: base.record_date ?? incoming.record_date,
      amount: base.amount ?? incoming.amount,
      wallet_topup:
        groupSize === 1 ? (base.wallet_topup > 0 ? base.wallet_topup : incoming.wallet_topup) : base.wallet_topup,
      status_text: pick(incoming.status_text, base.status_text),
      fully_paid: incoming.fully_paid,
      provisional: incoming.provisional,
    };
  }
  const merged: ExistingRecord = {
    transaction_ref: pick(incoming.transaction_ref, base.transaction_ref),
    invoice_ref: pick(incoming.invoice_ref, base.invoice_ref),
    tax_no: pick(incoming.tax_no, base.tax_no),
    // An expense line only brings a cost to a transaction that is already stored: the apply step keeps that
    // transaction's own date (work.import_apply), so the preview never says the date will move to the expense's day.
    record_date:
      incoming.kind === 'expense' && existing ? base.record_date : pick(incoming.record_date, base.record_date),
    amount: pick(incoming.amount, base.amount),
    wallet_topup: incoming.kind === 'invoice' ? incoming.wallet_topup : base.wallet_topup,
    // An expense import is the cost source for its transactions at that moment: its
    // approved sum replaces the stored cost (re-importing the same file is unchanged).
    cost: incoming.kind === 'expense' ? incoming.cost : pick(incoming.cost, base.cost),
    status_text: pick(incoming.status_text, base.status_text),
    fully_paid: incoming.kind === 'invoice' || incoming.kind === 'promo' ? incoming.fully_paid : base.fully_paid,
    provisional: incoming.kind === 'invoice' ? incoming.provisional : base.provisional,
    source_promo: pick(incoming.source_promo, base.source_promo),
    product: pick(incoming.product, base.product),
  };
  return merged;
}

function fieldsChanged(before: ExistingRecord | null, after: ExistingRecord): PreviewChange[] {
  if (before === null) return [];
  const changed: PreviewChange[] = [];
  const checks: [string, unknown, unknown][] = [
    ['amount', before.amount, after.amount],
    ['wallet part', before.wallet_topup, after.wallet_topup],
    ['cost', before.cost, after.cost],
    ['status', before.status_text, after.status_text],
    ['tax number', before.tax_no, after.tax_no],
    ['date', before.record_date, after.record_date],
    ['transaction number', before.transaction_ref, after.transaction_ref],
    ['invoice number', before.invoice_ref, after.invoice_ref],
    ['discount code', before.source_promo, after.source_promo],
    ['service', before.product, after.product],
  ];
  for (const [field, oldValue, newValue] of checks) {
    if (!same(oldValue, newValue)) changed.push({ field, before: oldValue, after: newValue });
  }
  return changed;
}

/** Still missing its other half after merging? */
function incompleteAfterMerge(kind: NormalisedRow['kind'], merged: ExistingRecord, matched: boolean): boolean {
  if (kind === 'promo') return !matched;
  if (kind === 'expense') return merged.amount === null;
  return merged.transaction_ref === null || merged.invoice_ref === null;
}

function naturalKey(row: NormalisedRow): string {
  switch (row.kind) {
    case 'invoice':
      return `invoice:${row.invoice_ref ?? ''}`;
    case 'transaction':
    case 'expense':
      return `transaction:${row.transaction_ref ?? ''}`;
    case 'promo':
      return `promo:${row.source_promo ?? ''}:${row.invoice_ref ?? ''}`;
  }
}

function findMatch(row: NormalisedRow, existing: ExistingRecord[]): ExistingRecord | null {
  if (row.kind === 'expense') {
    return existing.find((e) => e.transaction_ref !== null && e.transaction_ref === row.transaction_ref) ?? null;
  }
  if (row.kind === 'promo') {
    // Invoice Number only. tax_no (DPIN/TTIN) and any receipt reference are never keys.
    // An invoice-only row first; else a single transaction row. When several transaction
    // rows share the invoice number, no single row owns the code link: no match, and the
    // caller records a clash (a promo invoice is an individual booking, so this is rare).
    const invoiceOnly = existing.find((e) => e.transaction_ref === null && e.invoice_ref === row.invoice_ref);
    if (invoiceOnly) return invoiceOnly;
    const sharing = existing.filter((e) => e.transaction_ref !== null && e.invoice_ref === row.invoice_ref);
    return sharing.length === 1 ? (sharing[0] ?? null) : null;
  }
  if (row.kind === 'invoice') {
    // Its own invoice-only row first; else a transaction row already carrying this
    // invoice number (the group case: the invoice fills tax number and status, and the
    // transaction amounts stand — see mergedRecord).
    return (
      existing.find((e) => e.transaction_ref === null && e.invoice_ref === row.invoice_ref) ??
      existing.find((e) => e.transaction_ref !== null && e.invoice_ref === row.invoice_ref) ??
      null
    );
  }
  // Transaction list: its own number first; then an invoice-only row carrying the same
  // invoice number (progressive fill: the list row supplies the missing transaction).
  const byTransaction = existing.find((e) => e.transaction_ref !== null && e.transaction_ref === row.transaction_ref);
  if (byTransaction) return byTransaction;
  if (row.invoice_ref !== null) {
    return existing.find((e) => e.transaction_ref === null && e.invoice_ref === row.invoice_ref) ?? null;
  }
  return null;
}

export function buildPreview(
  existing: ExistingRecord[],
  incoming: NormalisedRow[],
  held: HeldRow[],
  decisions: PreviewDecisions = {},
): Preview {
  const rows: PreviewRow[] = [];
  const counts: PreviewCounts = { new: 0, updated: 0, unchanged: 0, excluded: 0, needs_linking: 0 };
  const clashes: Preview['clashes'] = [];
  const seen = new Set<string>();
  // What this file itself has already merged for each key, so a kept duplicate diffs
  // against its first occurrence instead of creating a second record for one key.
  const inFile = new Map<string, ExistingRecord>();
  const clash = (row_no: number, why: Why) => clashes.push({ row_no, reason: whyText(why), why });

  for (const row of incoming) {
    const rowNo = row.rowNos[0] ?? 2;
    const key = naturalKey(row);
    const duplicate = seen.has(key);
    seen.add(key);
    // every reason is said once, as its English sentence and as its code, in the same order
    const reasons: string[] = [];
    const whys: Why[] = [];
    const say = (why: Why) => {
      reasons.push(whyText(why));
      whys.push(why);
    };
    if (duplicate) {
      const decision = decisions[rowNo] ?? 'skip';
      if (decision === 'skip') {
        const skipped: Why = { code: 'duplicate_skipped' };
        rows.push({
          row_no: rowNo,
          row_nos: row.rowNos,
          kind: row.kind,
          outcome: 'unchanged',
          reasons: [whyText(skipped)],
          whys: [skipped],
          duplicate: true,
          transaction_ref: row.transaction_ref,
          invoice_ref: row.invoice_ref,
          matched: null,
          changes: [],
          values: null,
          promo_before: null,
          promo_discount: null,
          promo_after: null,
        });
        counts.unchanged += 1;
        continue;
      }
      say({ code: 'duplicate_kept' });
    }
    const match = (duplicate ? inFile.get(key) : undefined) ?? findMatch(row, existing);
    const groupSize =
      row.kind === 'invoice' && row.invoice_ref !== null
        ? existing.filter((e) => e.transaction_ref !== null && e.invoice_ref === row.invoice_ref).length
        : 1;
    const merged = mergedRecord(match, row, groupSize);
    if (row.kind === 'invoice' && match && match.transaction_ref !== null && groupSize > 1) {
      say({ code: 'group_fill', values: { count: groupSize } });
    }
    if (
      row.kind === 'invoice' &&
      match &&
      match.transaction_ref !== null &&
      match.amount !== null &&
      row.amount !== null &&
      Math.abs(match.amount - row.amount) >= 0.01
    ) {
      clash(rowNo, { code: 'total_differs', values: { total: row.amount, stored: match.amount } });
    }
    if (row.kind === 'promo' && match === null && row.invoice_ref !== null) {
      const sharing = existing.filter((e) => e.transaction_ref !== null && e.invoice_ref === row.invoice_ref);
      if (sharing.length > 1) {
        clash(rowNo, { code: 'shared_invoice', values: { invoice: row.invoice_ref, count: sharing.length } });
      }
    }
    // A transaction row filling an invoice number that an invoice-only row already
    // holds is progress on this row, but the two rows now describe one invoice: say so.
    if (row.kind === 'transaction' && match?.transaction_ref !== null && row.invoice_ref !== null) {
      const invoiceOnly = existing.find(
        (e) => e !== match && e.transaction_ref === null && e.invoice_ref === row.invoice_ref,
      );
      if (invoiceOnly) {
        clash(rowNo, { code: 'invoice_elsewhere', values: { invoice: row.invoice_ref } });
      }
    }
    // A promo row never overwrites an attribution already given to another code.
    if (row.kind === 'promo' && match && match.source_promo !== null && match.source_promo !== row.source_promo) {
      const kept: Why = { code: 'other_code' };
      rows.push({
        row_no: rowNo,
        row_nos: row.rowNos,
        kind: row.kind,
        outcome: 'unchanged',
        reasons: [whyText(kept)],
        whys: [kept],
        duplicate,
        transaction_ref: row.transaction_ref,
        invoice_ref: row.invoice_ref,
        matched: match,
        changes: fieldsChanged(match, merged),
        values: merged,
        promo_before: row.promo_before,
        promo_discount: row.promo_discount,
        promo_after: row.promo_after,
      });
      counts.unchanged += 1;
      continue;
    }
    const changed = fieldsChanged(match, merged);
    inFile.set(key, merged);
    let outcome: PreviewOutcome;
    if (match === null) {
      outcome = incompleteAfterMerge(row.kind, merged, false) ? 'needs_linking' : 'new';
      if (outcome === 'needs_linking') {
        if (row.kind === 'invoice') say({ code: 'wait_transaction' });
        if (row.kind === 'transaction') say({ code: 'wait_invoice' });
        if (row.kind === 'expense') say({ code: 'wait_transaction_details' });
        if (row.kind === 'promo') say({ code: 'wait_invoice_export' });
      }
    } else if (changed.length === 0) {
      outcome = 'unchanged';
    } else if (incompleteAfterMerge(row.kind, merged, true)) {
      outcome = 'needs_linking';
      say({ code: 'changed_incomplete', fields: changed.map((c) => c.field) });
    } else {
      outcome = 'updated';
      say({ code: 'changed', fields: changed.map((c) => c.field) });
    }
    rows.push({
      row_no: rowNo,
      row_nos: row.rowNos,
      kind: row.kind,
      outcome,
      reasons,
      whys,
      duplicate,
      transaction_ref: row.transaction_ref,
      invoice_ref: row.invoice_ref,
      matched: match,
      changes: changed,
      values: merged,
      promo_before: row.promo_before,
      promo_discount: row.promo_discount,
      promo_after: row.promo_after,
    });
    counts[outcome] += 1;
  }

  for (const heldRow of held) {
    rows.push({
      row_no: heldRow.row_no,
      row_nos: [heldRow.row_no],
      kind: 'invoice',
      outcome: 'excluded',
      reasons: [heldRow.reason],
      whys: heldRow.why ? [heldRow.why] : [],
      duplicate: false,
      transaction_ref: null,
      invoice_ref: null,
      matched: null,
      changes: [],
      values: null,
      promo_before: null,
      promo_discount: null,
      promo_after: null,
    });
    counts.excluded += 1;
  }
  rows.sort((a, b) => a.row_no - b.row_no);
  return { counts, rows, problems: held, clashes };
}
