// Landing 47 (A3 + A4): what an expense file comes to, as the DATABASE settles it — before the preview is drawn.
//
// One expense is told from another by its transaction number, amount, approval time and expense type. The database
// holds that rule (work.expense_settle) and the keys of the expenses already counted, so the preview asks it
// (api.import_expense_preview) instead of working the cost out here a second way: for each expense row it answers
// the cost that Confirm will store (what is stored + what is new), how many lines are repeats, or that the row is
// held because its reference is a tax invoice number. This file only applies that answer to the rows.
import { whyText, type Why } from './reasons';
import type { HeldRow, NormalisedRow } from './normalise';

type Settled = { row_no: number; transaction_ref: string; held: boolean; cost: number | null; repeated: number };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** api.import_expense_preview's answer, row by row; anything that is not such an answer is null (a failed read). */
export function settledOf(answer: unknown): Settled[] | null {
  if (!Array.isArray(answer)) return null;
  const out: Settled[] = [];
  for (const a of answer as Record<string, unknown>[]) {
    const rowNo = num(a?.row_no);
    if (rowNo === null || typeof a.transaction_ref !== 'string') return null;
    out.push({
      row_no: rowNo,
      transaction_ref: a.transaction_ref,
      held: a.held === true,
      cost: num(a.cost),
      repeated: num(a.repeated) ?? 0,
    });
  }
  return out;
}

/** What the preview's read is asked: each expense row's number, transaction and Approved lines. */
export function expenseRowsToSettle(records: NormalisedRow[]): Record<string, unknown>[] {
  return records
    .filter((r) => r.kind === 'expense' && r.transaction_ref !== null)
    .map((r) => ({ row_no: r.rowNos[0] ?? 2, transaction_ref: r.transaction_ref, lines: r.lines }));
}

/**
 * The rows as the database settles them: an expense row takes the cost Confirm will store and its count of
 * repeats; a row the database holds (keyed to a tax invoice number) leaves the records and joins the held rows with
 * its reason. Rows of every other kind, and an expense row the answer does not name, are returned as they came.
 */
export function applySettled(
  records: NormalisedRow[],
  held: HeldRow[],
  settled: Settled[],
): { records: NormalisedRow[]; held: HeldRow[] } {
  const byRow = new Map(settled.map((s) => [`${s.row_no}|${s.transaction_ref}`, s]));
  const outRecords: NormalisedRow[] = [];
  const outHeld = [...held];
  for (const r of records) {
    const s = r.kind === 'expense' ? byRow.get(`${r.rowNos[0] ?? 2}|${r.transaction_ref}`) : undefined;
    if (!s) {
      outRecords.push(r);
      continue;
    }
    if (s.held) {
      const why: Why = { code: 'db_expense_tax_ref' };
      for (const rowNo of r.rowNos) outHeld.push({ row_no: rowNo, reason: whyText(why), why });
      continue;
    }
    outRecords.push(s.cost === null ? r : { ...r, cost: s.cost, expense_repeats: s.repeated });
  }
  return { records: outRecords, held: outHeld };
}
