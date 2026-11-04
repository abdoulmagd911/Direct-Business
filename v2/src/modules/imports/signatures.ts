// Import engine, workstream D (4 Nov 2026): which Direct file is which, by its columns.
//
// A file is recognised by its COLUMN SIGNATURE: the exact set of header names it must
// carry. Matching is order-independent and case-insensitive, because Direct's own column
// order is not stable run to run. Nothing here is guessed: a shape whose real headers have
// never been captured is registered as `headersCaptured: false` and is NEVER matched, so a
// file of that shape stops on the unknown path instead of being misread.
//
// Sources for the header sets below (no header name here is invented):
// - invoice_export and transaction_expense_export: the v2 import map seeded in
//   20261011080555_finance_import_map.sql, ported from the old app.
// - promo_code_invoice_export: the promo export columns confirmed 4 Nov 2026
//   (Invoice Number | Before Discount | Discount | After Discount | Product | Payment Status).
// - corporate_transaction_list: the old app's expense-gate capture columns
//   (RECEIPT REF. | PRODUCT | AMOUNT (SAR) | INVOICE ISSUING | CREATED AT | EXPENSE STATUS).
//   This is the list-shaped file, not a hub export: the Corporate Transactions list page
//   has no download button, so a person copies or saves that list by hand. It carries no
//   client column, so the company it lands under is the one chosen at upload, never a
//   client value read from the file.
// - corporate_clients_export and revenue_report_export: known by name only. Their real
//   header rows have not been captured in any evidence available to this workstream, so
//   they are registered here with headersCaptured: false and a plain note. The moment one
//   real header row is captured, its required columns are added here and detection starts
//   working; until then such a file stops on the unknown path, showing its own columns.

export type SignatureKey =
  | 'invoice_export'
  | 'transaction_expense_export'
  | 'promo_code_invoice_export'
  | 'corporate_transaction_list'
  | 'corporate_clients_export'
  | 'revenue_report_export';

export type Signature = {
  key: SignatureKey;
  /** Plain words, shown on the review screen. */
  label: string;
  /** What kind of record this file feeds. */
  kind: 'invoice' | 'expense' | 'promo' | 'transaction' | 'client' | 'revenue';
  /** False when no real header row has ever been captured for this shape. Never matched. */
  headersCaptured: boolean;
  /** Columns the file must carry (all of them) for detection. Empty when not captured. */
  requiredColumns: string[];
  /** Other columns the normaliser knows how to read when they are present. */
  knownColumns: string[];
  /** The natural key rows are matched on. Null when the shape has no usable key yet. */
  naturalKey: string | null;
  /** Plain note for the review screen and for NOTES.md. */
  note: string;
};

export const SIGNATURES: Signature[] = [
  {
    key: 'invoice_export',
    label: 'Invoice export (non-simplified, the spine)',
    kind: 'invoice',
    headersCaptured: true,
    requiredColumns: ['Type', 'Invoice Reference #', 'Customer Name', 'Item Is Taxable'],
    knownColumns: [
      'Invoice Number',
      'Customer Email',
      'Email',
      'Invoice Create Date',
      'Invoice Generate Date',
      'Last Payment Date',
      'Invoice Status',
      'Last Status At',
      'Invoice Total',
      'Sale Branch',
      'Salesman',
      'Product',
      'Name',
      'Qty',
      'Quantity',
      'Item Quantity',
      'Unit Price',
      'Item Unit Price',
      'Item Price',
      'Item Discount',
      'Item Total',
      'Payment Method',
      'Allocation',
      'Allocated Amount',
      'Amount',
      'Ref # At Payment Method',
      'Payment By',
      'Paid By',
      'Notes',
      'Payment Date',
      'Receipt Date',
      'Paid At',
    ],
    naturalKey: 'Invoice Reference # (the 10-digit number)',
    note: 'One row per invoice line; rows sharing one Invoice Reference # belong to one invoice. Invoice Number holds the tax number (DPIN or TTIN): it is stored, never used as a key. Customer name, email and phone are read for detection only and are never stored.',
  },
  {
    key: 'transaction_expense_export',
    label: 'Transaction Expense Export (the only cost source)',
    kind: 'expense',
    headersCaptured: true,
    requiredColumns: ['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status'],
    knownColumns: [
      'Created At',
      'Submission Date',
      'Approval/Rejection Date',
      'Merchant',
      'ID Reference',
      'Submitter',
      'Approver/Rejector',
    ],
    naturalKey: 'Invoice# (the transaction number, not an invoice number)',
    note: 'Trap, verified on a real record: the Invoice# column here is the TRANSACTION reference. Expense lines join to a transaction, never straight to an invoice. Only lines whose Status is Approved count as cost; every Approved line is summed, none deduplicated, even identical amounts.',
  },
  {
    key: 'promo_code_invoice_export',
    label: 'Promo Code Invoice Export',
    kind: 'promo',
    headersCaptured: true,
    requiredColumns: ['Invoice Number', 'Before Discount', 'Discount', 'After Discount', 'Product', 'Payment Status'],
    knownColumns: [],
    naturalKey: 'Invoice Number (the 10-digit number)',
    note: 'This file has NO code column, so the discount code it belongs to must be recorded at import time (the person uploading says which code it is) or the link is lost. Code text is not unique, so rows are keyed by the code id given at import, never by the code text. Matching to an invoice is by the 10-digit Invoice Number only, never by DPIN, TTIN, or a receipt reference.',
  },
  {
    key: 'corporate_transaction_list',
    label: 'Corporate Transactions list (saved by hand, no export button)',
    kind: 'transaction',
    headersCaptured: true,
    requiredColumns: ['RECEIPT REF.', 'INVOICE ISSUING', 'EXPENSE STATUS'],
    knownColumns: ['PRODUCT', 'AMOUNT (SAR)', 'CREATED AT'],
    naturalKey: 'RECEIPT REF. (the transaction number)',
    note: 'There is no literal Corporate Transactions export and the list page has no download button, so this shape is the list saved by hand. It carries no client column: the company is the one chosen at upload. INVOICE ISSUING says "Issued <number>" or "Need to issue"; a blank EXPENSE STATUS together with "Issued <number>" means the expenses are done, not unknown.',
  },
  {
    key: 'corporate_clients_export',
    label: 'Corporate Clients export',
    kind: 'client',
    headersCaptured: false,
    requiredColumns: [],
    knownColumns: [],
    naturalKey: null,
    note: 'Known by name only: no real header row has been captured, so this shape is not detected yet. A file that looks like it stops on the unknown path, showing its own columns, until its headers are captured and added here.',
  },
  {
    key: 'revenue_report_export',
    label: 'Revenue Report export',
    kind: 'revenue',
    headersCaptured: false,
    requiredColumns: [],
    knownColumns: [],
    naturalKey: null,
    note: 'Known by name only: no real header row has been captured, so this shape is not detected yet. When it is captured, remember its labels are Direct labels, not workspace figures: its "Total Revenue" is workspace PROFIT (amount less expenses), its Invoice Amount is workspace revenue, its Invoice Expenses are a fallback cost only, and its VAT column is dropped at import.',
  },
];

export function signatureByKey(key: SignatureKey): Signature {
  return SIGNATURES.find((s) => s.key === key) as Signature;
}

/** One header as it is compared: trimmed, with a bracketed raw key taken when present. */
export function headerKey(header: string): string {
  const trimmed = String(header ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  const bracketed = trimmed.match(/\(([A-Za-z0-9_ #]+)\)\s*$/);
  return (bracketed ? (bracketed[1] ?? trimmed) : trimmed).toLowerCase();
}

function looksBinary(headers: string[]): boolean {
  const joined = headers.join('');
  return /^(%PDF|PK\x03\x04)/.test(String(headers[0] ?? '')) || /[\u0000-\u0008\u000e-\u001f]/.test(joined);
}

/** A file this app itself exported (its worked-out figures), not a Direct export. */
function looksLikeOwnReport(headers: string[]): boolean {
  const keys = headers.map(headerKey);
  return keys.includes('revenue_sar') && keys.includes('profit_sar');
}

export type Detection =
  | { recognised: true; signature: Signature }
  | { recognised: false; columns: string[]; reason: 'unknown' | 'binary' | 'own_report' };

/**
 * Detect a file from its header row. Never guesses: an unrecognised signature returns
 * the file's own columns so the review screen can show them and stop, with nothing saved.
 */
export function detectSignature(rawHeaders: string[]): Detection {
  const headers = (rawHeaders ?? []).map((h) =>
    String(h ?? '')
      .replace(/^\uFEFF/, '')
      .trim(),
  );
  if (looksBinary(headers)) return { recognised: false, columns: headers, reason: 'binary' };
  if (looksLikeOwnReport(headers)) return { recognised: false, columns: headers, reason: 'own_report' };
  const keys = new Set(headers.map(headerKey));
  for (const signature of SIGNATURES) {
    if (!signature.headersCaptured) continue;
    if (signature.requiredColumns.every((c) => keys.has(headerKey(c)))) {
      return { recognised: true, signature };
    }
  }
  return { recognised: false, columns: headers, reason: 'unknown' };
}

/** The headers a Download-template file carries for one signature. Empty when uncaptured. */
export function templateHeaders(key: SignatureKey): string[] {
  const signature = signatureByKey(key);
  if (!signature.headersCaptured) return [];
  return [...signature.requiredColumns, ...signature.knownColumns];
}
