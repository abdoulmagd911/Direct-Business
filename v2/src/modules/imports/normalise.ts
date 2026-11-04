// Turning file rows into records, one signature at a time. Plain rules:
//
// - Customer names, emails and phones are never copied into a record: they are read for
//   detection only. A VAT column is never read at all, and a settlement column is never
//   read at all — both are dropped at import, by construction, not by filtering later.
// - Invoice rows come one per line: rows sharing one Invoice Reference # are grouped into
//   one invoice before anything else, in any order (order never matters).
// - The record date is the creation date. When a file row has no creation date, the
//   payment date, then the generate date, is used and the row says so plainly; a row with
//   no date at all is held.
// - "Waiting for Issuing" is not a payment verdict: it marks a provisional invoice (inside
//   Direct, not a tax invoice yet). Such a row is written and flagged provisional, never
//   counted as fully-paid revenue. Every other not-fully-paid payment status is excluded
//   by rule and not written.
// - A wallet top-up only invoice is excluded by rule ("wallet top-up only, not a sale").
//   A wallet line inside a real sale (product "Direct Wallet", or a line named Wallet
//   Balance / رصيد المحفظة) is split off: revenue is the invoice amount less that part.
// - Expense rows join to a transaction, never straight to an invoice: the expense file's
//   Invoice# column IS the transaction number. Only Approved lines count as cost.
// - Promo rows match an invoice by the 10-digit Invoice Number only. The file has no code
//   column, so the code id must be given at import time; without it the whole file stops.

import { headerKey, type SignatureKey } from './signatures';
import { parseDate, parseIssuedInvoice, parseMoney, tenDigitRef } from './money';
import { fullyPaidVerdict, isApprovedExpense } from './paid';

export type NormalisedRow = {
  kind: 'invoice' | 'transaction' | 'expense' | 'promo';
  /** Spreadsheet row numbers this record came from (header is row 1). */
  rowNos: number[];
  transaction_ref: string | null;
  invoice_ref: string | null;
  /** The tax number (DPIN or TTIN). Stored, never used as a key. */
  tax_no: string | null;
  /** Creation date (YYYY-MM-DD), or null when the file carries none yet. */
  record_date: string | null;
  /** Plain note when the date fell back to payment or generate date. */
  date_note: string | null;
  /** Invoice or transaction total, or null when not carried yet. */
  amount: number | null;
  /** Wallet portion split off a sale (0 when none). */
  wallet_topup: number;
  /** Approved expense sum (expense rows only, otherwise null). */
  cost: number | null;
  /** How many expense lines fed this cost (expense rows only). */
  expense_lines: number;
  status_text: string | null;
  fully_paid: boolean;
  audit_required: boolean;
  /** Waiting for Issuing: inside Direct, not a tax invoice yet. */
  provisional: boolean;
  product: string | null;
  /** Discount-code id given at import time (promo rows only). */
  source_promo: string | null;
  promo_before: number | null;
  promo_discount: number | null;
  promo_after: number | null;
  /** Expense gate from the transaction list (ready / done / pending). */
  expense_gate: string | null;
  /** Direct link, only when the caller supplied a pattern with {ref} in it. Never guessed. */
  direct_url: string | null;
  /** The Direct reference itself, always kept so a link can be built later. */
  direct_ref: string | null;
};

export type HeldRow = { row_no: number; reason: string };

export type NormaliseResult = {
  records: NormalisedRow[];
  /** Rows that were not written, each with a plain reason and its row number. */
  held: HeldRow[];
  /** A whole-file stop (e.g. promo file with no code given). Null when the file ran. */
  fileProblem: string | null;
};

export type NormaliseOptions = {
  /** Discount-code id for a promo file. Required there, ignored elsewhere. */
  sourcePromo?: string | null;
  /** Direct link pattern with {ref} in it, e.g. "https://…/invoices/{ref}". */
  directUrlTemplate?: string | null;
};

function directUrl(template: string | null | undefined, ref: string | null): string | null {
  if (!template || !ref || !template.includes('{ref}')) return null;
  return template.replace('{ref}', ref);
}

type RowReader = {
  get: (row: string[], ...names: string[]) => string;
  index: Map<string, number>;
};

function makeReader(header: string[]): RowReader {
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const key = headerKey(h);
    if (!index.has(key)) index.set(key, i);
  });
  return {
    index,
    get(row, ...names) {
      for (const name of names) {
        const at = index.get(headerKey(name));
        if (at !== undefined) return String(row[at] ?? '').trim();
      }
      return '';
    },
  };
}

function blankRow(row: string[]): boolean {
  return row.every((c) => String(c ?? '').trim() === '');
}

function baseRow(kind: NormalisedRow['kind'], rowNos: number[]): NormalisedRow {
  return {
    kind,
    rowNos,
    transaction_ref: null,
    invoice_ref: null,
    tax_no: null,
    record_date: null,
    date_note: null,
    amount: null,
    wallet_topup: 0,
    cost: null,
    expense_lines: 0,
    status_text: null,
    fully_paid: false,
    audit_required: false,
    provisional: false,
    product: null,
    source_promo: null,
    promo_before: null,
    promo_discount: null,
    promo_after: null,
    expense_gate: null,
    direct_url: null,
    direct_ref: null,
  };
}

function isWalletLine(product: string, name: string): boolean {
  return product === 'Direct Wallet' || /Wallet Balance|رصيد المحفظة/i.test(name);
}

function normaliseInvoices(header: string[], rows: string[][], options: NormaliseOptions): NormaliseResult {
  const read = makeReader(header);
  const held: HeldRow[] = [];
  type Group = {
    ref: string;
    rowNos: number[];
    type: string | null;
    taxNo: string | null;
    created: string | null;
    generated: string | null;
    paid: string | null;
    status: string | null;
    statusAt: string | null;
    total: number | null;
    items: { product: string; name: string; total: number }[];
    receiptFullyApplied: boolean;
  };
  const groups = new Map<string, Group>();
  const order: string[] = [];
  const groupFor = (ref: string, rowNo: number): Group => {
    let group = groups.get(ref);
    if (!group) {
      group = {
        ref,
        rowNos: [],
        type: null,
        taxNo: null,
        created: null,
        generated: null,
        paid: null,
        status: null,
        statusAt: null,
        total: null,
        items: [],
        receiptFullyApplied: false,
      };
      groups.set(ref, group);
      order.push(ref);
    }
    group.rowNos.push(rowNo);
    return group;
  };

  rows.forEach((row, i) => {
    const rowNo = i + 2;
    if (blankRow(row)) return;
    const type = read.get(row, 'Type').toLowerCase();
    const ref = read.get(row, 'Invoice Reference #');
    if (!ref) {
      held.push({ row_no: rowNo, reason: 'No invoice number on this row, so it cannot be matched' });
      return;
    }
    if (type === 'invoice' || type === 'credit_note') {
      const group = groupFor(ref, rowNo);
      const statusAt = parseDate(read.get(row, 'Last Status At'));
      // A repeated copy of one invoice keeps the newer status, whichever comes last.
      if (group.type === null || (statusAt !== null && (group.statusAt === null || statusAt > group.statusAt))) {
        group.type = type;
        group.taxNo = read.get(row, 'Invoice Number') || null;
        group.created = parseDate(read.get(row, 'Invoice Create Date'));
        group.generated = parseDate(read.get(row, 'Invoice Generate Date'));
        group.paid = parseDate(read.get(row, 'Last Payment Date'));
        group.status = read.get(row, 'Invoice Status') || null;
        group.statusAt = statusAt;
        group.total = parseMoney(read.get(row, 'Invoice Total'));
      }
    } else if (type === 'item') {
      const group = groupFor(ref, rowNo);
      const total = parseMoney(read.get(row, 'Item Total'));
      group.items.push({
        product: read.get(row, 'Product'),
        name: read.get(row, 'Name'),
        total: total ?? 0,
      });
    } else if (type === 'payment_receipt') {
      const group = groupFor(ref, rowNo);
      if (/fully applied/i.test(row.join(' '))) group.receiptFullyApplied = true;
    } else {
      held.push({
        row_no: rowNo,
        reason: `Row type "${read.get(row, 'Type')}" is not invoice, item, or payment receipt`,
      });
    }
  });

  const records: NormalisedRow[] = [];
  for (const ref of order) {
    const group = groups.get(ref) as Group;
    if (group.type === 'credit_note') {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: 'Credit note, not a sale: not counted' });
      continue;
    }
    const itemTotal = group.items.reduce((sum, item) => sum + item.total, 0);
    const total = group.total ?? (group.items.length > 0 ? Math.round(itemTotal * 100) / 100 : null);
    if (total === null) {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: 'No amount on this invoice, so it cannot be counted' });
      continue;
    }
    let wallet = 0;
    let serviceItems = 0;
    for (const item of group.items) {
      if (isWalletLine(item.product, item.name)) wallet += item.total;
      else serviceItems += 1;
    }
    wallet = Math.round(wallet * 100) / 100;
    const topup = wallet > 0 && (serviceItems === 0 || wallet >= total - 0.01);
    if (topup) {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: 'Wallet top-up only, not a sale: not counted' });
      continue;
    }
    const statusText = group.status;
    const statusLower = (statusText ?? '').trim().toLowerCase();
    const record = baseRow('invoice', group.rowNos);
    record.invoice_ref = ref;
    record.tax_no = group.taxNo;
    record.amount = total;
    record.wallet_topup = wallet;
    record.status_text = statusText;
    record.direct_ref = ref;
    record.direct_url = directUrl(options.directUrlTemplate, ref);
    if (group.created) {
      record.record_date = group.created;
    } else if (group.paid) {
      record.record_date = group.paid;
      record.date_note = 'Creation date missing, payment date used instead';
    } else if (group.generated) {
      record.record_date = group.generated;
      record.date_note = 'Creation date missing, generate date used instead';
    } else {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: 'No date on this invoice, so it cannot be placed' });
      continue;
    }
    if (statusLower === 'waiting for issuing') {
      // Provisional: inside Direct, not a tax invoice yet. Written and flagged, never
      // counted as fully-paid revenue.
      record.provisional = true;
      record.fully_paid = false;
      records.push(record);
      continue;
    }
    const verdict = fullyPaidVerdict(statusText, null);
    if (verdict.outcome === 'counts' || (verdict.outcome === 'unknown' && group.receiptFullyApplied)) {
      record.fully_paid = true;
      record.audit_required = verdict.auditRequired;
      records.push(record);
    } else if (verdict.outcome === 'ignored') {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: `Not fully paid (${statusText ?? 'no status'}): not counted` });
    } else {
      held.push({ row_no: group.rowNos[0] ?? 2, reason: verdict.reason });
    }
  }
  return { records, held, fileProblem: null };
}

function normaliseExpenses(header: string[], rows: string[][]): NormaliseResult {
  const read = makeReader(header);
  const held: HeldRow[] = [];
  type Group = { rowNos: number[]; sum: number; lines: number; date: string | null };
  const groups = new Map<string, Group>();
  const order: string[] = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2;
    if (blankRow(row)) return;
    const ref = read.get(row, 'Invoice#');
    if (!ref) {
      held.push({ row_no: rowNo, reason: 'No transaction number on this expense line, so it cannot be matched' });
      return;
    }
    const amount = parseMoney(read.get(row, 'Amount (SAR)'));
    if (amount === null) {
      held.push({ row_no: rowNo, reason: 'Expense amount cannot be read, so this line is not counted' });
      return;
    }
    if (!isApprovedExpense(read.get(row, 'Status'))) {
      held.push({
        row_no: rowNo,
        reason: `Expense not approved yet (${read.get(row, 'Status') || 'no status'}), so it is not counted as cost`,
      });
      return;
    }
    let group = groups.get(ref);
    if (!group) {
      group = { rowNos: [], sum: 0, lines: 0, date: null };
      groups.set(ref, group);
      order.push(ref);
    }
    group.rowNos.push(rowNo);
    group.sum = Math.round((group.sum + amount) * 100) / 100;
    group.lines += 1;
    if (group.date === null) group.date = parseDate(read.get(row, 'Created At'));
  });
  const records = order.map((ref) => {
    const group = groups.get(ref) as Group;
    const record = baseRow('expense', group.rowNos);
    record.transaction_ref = ref;
    record.cost = group.sum;
    record.expense_lines = group.lines;
    record.record_date = group.date;
    record.direct_ref = ref;
    return record;
  });
  return { records, held, fileProblem: null };
}

function normaliseTransactionList(header: string[], rows: string[][], options: NormaliseOptions): NormaliseResult {
  const read = makeReader(header);
  const held: HeldRow[] = [];
  const records: NormalisedRow[] = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2;
    if (blankRow(row)) return;
    const ref = read.get(row, 'RECEIPT REF.');
    if (!ref) {
      held.push({ row_no: rowNo, reason: 'No transaction number on this row, so it cannot be matched' });
      return;
    }
    const issuing = read.get(row, 'INVOICE ISSUING');
    const invoiceRef = parseIssuedInvoice(issuing);
    const gateRaw = read.get(row, 'EXPENSE STATUS');
    // Blank expense status together with an issued invoice means the expenses are done,
    // not unknown (verified on the old app's capture).
    const gate =
      gateRaw.toLowerCase() === 'ready' ? 'ready' : gateRaw === '' && invoiceRef !== null ? 'done' : 'pending';
    const record = baseRow('transaction', [rowNo]);
    record.transaction_ref = ref;
    record.invoice_ref = invoiceRef;
    record.amount = parseMoney(read.get(row, 'AMOUNT (SAR)'));
    record.record_date = parseDate(read.get(row, 'CREATED AT'));
    record.product = read.get(row, 'PRODUCT') || null;
    record.expense_gate = gate;
    record.direct_ref = ref;
    record.direct_url = directUrl(options.directUrlTemplate, ref);
    records.push(record);
  });
  return { records, held, fileProblem: null };
}

function normalisePromo(header: string[], rows: string[][], options: NormaliseOptions): NormaliseResult {
  const read = makeReader(header);
  const held: HeldRow[] = [];
  if (!options.sourcePromo) {
    return {
      records: [],
      held: [],
      fileProblem:
        'This file has no discount-code column, so it cannot be imported until you say which code it belongs to. Nothing was saved.',
    };
  }
  const records: NormalisedRow[] = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2;
    if (blankRow(row)) return;
    const invoiceRef = tenDigitRef(read.get(row, 'Invoice Number'));
    if (invoiceRef === null) {
      held.push({
        row_no: rowNo,
        reason: 'Invoice number is not 10 digits, so it cannot be matched to an invoice',
      });
      return;
    }
    const before = parseMoney(read.get(row, 'Before Discount'));
    const discount = parseMoney(read.get(row, 'Discount'));
    const after = parseMoney(read.get(row, 'After Discount'));
    if (before === null || discount === null || after === null) {
      held.push({ row_no: rowNo, reason: 'Discount amounts cannot be read, so this row is not counted' });
      return;
    }
    const verdict = fullyPaidVerdict(read.get(row, 'Payment Status'), null);
    if (verdict.outcome !== 'counts') {
      held.push({
        row_no: rowNo,
        reason:
          verdict.outcome === 'ignored'
            ? `Not fully paid (${read.get(row, 'Payment Status') || 'no status'}): never counted`
            : verdict.reason,
      });
      return;
    }
    const record = baseRow('promo', [rowNo]);
    record.invoice_ref = invoiceRef;
    record.source_promo = options.sourcePromo ?? null;
    record.promo_before = before;
    record.promo_discount = discount;
    record.promo_after = after;
    record.product = read.get(row, 'Product') || null;
    record.status_text = read.get(row, 'Payment Status') || null;
    record.fully_paid = true;
    record.audit_required = verdict.auditRequired;
    record.direct_ref = invoiceRef;
    record.direct_url = directUrl(options.directUrlTemplate, invoiceRef);
    records.push(record);
  });
  return { records, held, fileProblem: null };
}

/**
 * Normalise one parsed file (header row + data rows, header is row 1). Customer names,
 * emails, phones, VAT and settlement are never copied into a record: no field for them
 * exists on the record, so they cannot leak through.
 */
export function normaliseFile(
  signatureKey: SignatureKey,
  header: string[],
  rows: string[][],
  options: NormaliseOptions = {},
): NormaliseResult {
  switch (signatureKey) {
    case 'invoice_export':
      return normaliseInvoices(header, rows, options);
    case 'transaction_expense_export':
      return normaliseExpenses(header, rows);
    case 'corporate_transaction_list':
      return normaliseTransactionList(header, rows, options);
    case 'promo_code_invoice_export':
      return normalisePromo(header, rows, options);
    default:
      return {
        records: [],
        held: [],
        fileProblem: 'This shape has no captured headers yet, so it cannot be read. Nothing was saved.',
      };
  }
}
