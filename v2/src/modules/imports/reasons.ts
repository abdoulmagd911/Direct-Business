// Why an import row is held, waits for its other half, or is flagged — as a code and the values its sentence names,
// so the review screen words it in the person's language from the catalogs (import.why.<code>, English and Arabic).
//
// The English sentence each code stands for is kept here as well, and every sentence the engine writes is made from
// it: it is what the database stores for a held row (the apply step keeps the sentence it is sent, in
// work.import_batch.problems), and what the engine's tests read. The database writes four sentences of its own for the
// clashes it finds while applying (work.import_apply) — they are here too, so whyOf() can read any stored sentence
// back into its code and a past import is worded in Arabic like a new one. Nothing here decides what passes or fails.

export const WHY = {
  // invoice export
  no_invoice_ref: 'No invoice number on this row, so it cannot be matched',
  row_type: 'Row type "{type}" is not invoice, item, or payment receipt',
  credit_note: 'Credit note, not a sale: not counted',
  no_amount: 'No amount on this invoice, so it cannot be counted',
  wallet_only: 'Wallet top-up only, not a sale: not counted',
  no_date: 'No date on this invoice, so it cannot be placed',
  not_paid: 'Not fully paid ({status}): not counted',
  date_from_payment: 'Creation date missing, payment date used instead',
  date_from_generate: 'Creation date missing, generate date used instead',
  // expense export
  expense_no_ref: 'No transaction number on this expense line, so it cannot be matched',
  expense_amount: 'Expense amount cannot be read, so this line is not counted',
  expense_not_approved: 'Expense not approved yet ({status}), so it is not counted as cost',
  // transaction list
  no_transaction_ref: 'No transaction number on this row, so it cannot be matched',
  // promo export
  promo_ref: 'Invoice number is not 10 digits, so it cannot be matched to an invoice',
  promo_amounts: 'Discount amounts cannot be read, so this row is not counted',
  promo_not_paid: 'Not fully paid ({status}): never counted',
  // the whole file
  file_no_code:
    'This file has no discount-code column, so it cannot be imported until you say which code it belongs to. Nothing was saved.',
  file_shape: 'This shape has no captured headers yet, so it cannot be read. Nothing was saved.',
  // the Fully Paid gate
  paid: 'Fully paid',
  paid_not: 'Not fully paid: {status}',
  paid_nothing_left: 'Fully paid: nothing remaining',
  paid_and_unpaid: 'Says fully paid and unpaid, with no remaining of 0.00 to settle it: not counted',
  no_status: 'No status written: held for a person',
  status_unknown: 'Status "{status}" is not named yet: held for a person',
  // the preview
  duplicate_skipped: 'Duplicate in this file, skipped',
  duplicate_kept: 'Duplicate in this file, kept by choice',
  group_fill: 'Also fills the tax number and status on {count} transaction rows sharing this invoice',
  total_differs:
    'Invoice total {total} differs from the stored transaction amount {stored}: transaction amount kept, held for a person',
  shared_invoice:
    'Invoice number {invoice} covers {count} transactions, so no single row owns this code link: held for a person',
  invoice_elsewhere: 'Invoice number {invoice} is already on another row: held for a person, nothing merged by guess',
  other_code: 'Already linked to another discount code, kept as it was',
  wait_transaction: 'Missing transaction number: fills in when the transaction list arrives',
  wait_invoice: 'Missing invoice number: fills in when the invoice arrives',
  wait_transaction_details: 'No transaction details yet: fills in when the transaction arrives',
  wait_invoice_export: 'No invoice yet: fills in when the invoice export arrives',
  changed_incomplete: 'Changed ({fields}), still missing its other half',
  changed: 'Changed: {fields}',
  // the database's own sentences, for the clashes it finds while applying (work.import_apply)
  db_total_differs:
    'Invoice total differs from the stored transaction amount: transaction amount kept, held for a person',
  db_invoice_elsewhere: 'Invoice number is already on another row: held for a person, nothing merged by guess',
  db_shared_invoice:
    'Invoice number covers several transactions, so no single row owns this code link: held for a person',
} as const;

export type WhyCode = keyof typeof WHY;

/** A reason: its code, the values its sentence names, and — for a change — the field names that changed. */
export type Why = { code: WhyCode; values?: Record<string, string | number>; fields?: string[] };

/** The word an empty status is written as in the English sentence. */
const NO_STATUS = 'no status';

/** A reason as its English sentence — what the database stores and the tests read. */
export function whyText(why: Why): string {
  const values: Record<string, string | number> = { ...why.values };
  if (why.fields) values.fields = why.fields.join(', ');
  return WHY[why.code].replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = values[name];
    if (name === 'status' && (v === undefined || v === '')) return NO_STATUS;
    return v === undefined ? '' : String(v);
  });
}

const PATTERNS = (Object.keys(WHY) as WhyCode[]).map((code) => {
  const names: string[] = [];
  const source = WHY[code].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\w+)\\\}/g, (_, name: string) => {
    names.push(name);
    return '(.*?)';
  });
  return { code, names, re: new RegExp(`^${source}$`) };
});

/**
 * A stored sentence read back into its reason (a past import's held rows, the database's clashes); null when the
 * sentence is none of the engine's — the screen then shows it as it was stored.
 */
export function whyOf(text: string): Why | null {
  for (const { code, names, re } of PATTERNS) {
    const m = re.exec(text.trim());
    if (!m) continue;
    const values: Record<string, string> = {};
    let fields: string[] | undefined;
    names.forEach((name, i) => {
      const v = m[i + 1] ?? '';
      if (name === 'fields') fields = v === '' ? [] : v.split(', ');
      else values[name] = name === 'status' && v === NO_STATUS ? '' : v;
    });
    return { code, ...(names.some((n) => n !== 'fields') ? { values } : {}), ...(fields ? { fields } : {}) };
  }
  return null;
}
