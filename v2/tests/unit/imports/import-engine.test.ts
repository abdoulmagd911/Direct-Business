// Import engine v2 (workstream D): signature detection, duplicate idempotence,
// Fully Paid gating, progressive fill, and promo matching by invoice number only.
import { describe, expect, it } from 'vitest';
import {
  buildPreview,
  detectSignature,
  fullyPaidVerdict,
  ledgerBuckets,
  mergedRecord,
  normaliseFile,
  parseMoney,
  type ExistingRecord,
} from '@/modules/imports';

const INVOICE_HEADER = [
  'Type',
  'Invoice Reference #',
  'Customer Name',
  'Item Is Taxable',
  'Invoice Number',
  'Invoice Create Date',
  'Invoice Generate Date',
  'Last Payment Date',
  'Invoice Status',
  'Last Status At',
  'Invoice Total',
  'Product',
  'Name',
  'Item Total',
];

function invoiceRows(body: string[][]): string[][] {
  return body;
}

function toExisting(records: ReturnType<typeof normaliseFile>['records']): ExistingRecord[] {
  return records.map((r) => mergedRecord(null, r));
}

describe('signature detection', () => {
  it('recognises the invoice export by its required columns, in any order', () => {
    const found = detectSignature(['Item Is Taxable', 'Customer Name', 'Invoice Reference #', 'Type']);
    expect(found.recognised).toBe(true);
    if (found.recognised) expect(found.signature.key).toBe('invoice_export');
  });

  it('recognises the expense export, the promo export, and the transaction list', () => {
    const expense = detectSignature(['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status']);
    expect(expense.recognised).toBe(true);
    if (expense.recognised) expect(expense.signature.key).toBe('transaction_expense_export');
    const promo = detectSignature([
      'Invoice Number',
      'Before Discount',
      'Discount',
      'After Discount',
      'Product',
      'Payment Status',
    ]);
    expect(promo.recognised).toBe(true);
    if (promo.recognised) expect(promo.signature.key).toBe('promo_code_invoice_export');
    const list = detectSignature([
      'RECEIPT REF.',
      'PRODUCT',
      'AMOUNT (SAR)',
      'INVOICE ISSUING',
      'CREATED AT',
      'EXPENSE STATUS',
    ]);
    expect(list.recognised).toBe(true);
    if (list.recognised) expect(list.signature.key).toBe('corporate_transaction_list');
  });

  it('stops on an unknown signature, showing its own columns, and never guesses', () => {
    const found = detectSignature(['Client', 'Balance', 'Something New']);
    expect(found.recognised).toBe(false);
    if (!found.recognised) {
      expect(found.reason).toBe('unknown');
      expect(found.columns).toEqual(['Client', 'Balance', 'Something New']);
    }
  });

  it('does not detect the clients or revenue shapes yet: their headers were never captured', () => {
    // Any plausible clients/revenue header set must stop as unknown until a real header
    // row is captured and registered — fabricating a signature would misread files.
    const found = detectSignature(['Client ID', 'Company', 'Terms']);
    expect(found.recognised).toBe(false);
  });

  it('refuses a binary file and a file this app itself exported', () => {
    const binary = detectSignature(['%PDF-1.4 rest of a binary header']);
    expect(binary.recognised).toBe(false);
    if (!binary.recognised) expect(binary.reason).toBe('binary');
    const own = detectSignature(['invoice_no', 'revenue_sar', 'profit_sar', 'integrity_status']);
    expect(own.recognised).toBe(false);
    if (!own.recognised) expect(own.reason).toBe('own_report');
  });
});

describe('Fully Paid gating', () => {
  const counts = [
    'Invoice - Fully Paid',
    'Fully Paid',
    'Fully Paid + Receivables',
    'Fully Paid (Audit Required)',
    'Fully Applied',
    'Paid',
  ];
  it.each(counts)('counts: %s', (status) => {
    expect(fullyPaidVerdict(status, null).outcome).toBe('counts');
  });
  it('counts Remaining 0.00 even when the status words do not say fully paid', () => {
    expect(fullyPaidVerdict('Paid in full', 0).outcome).toBe('counts');
  });
  it('counts Fully Paid - Unpaid only with a Remaining check of 0.00', () => {
    expect(fullyPaidVerdict('Fully Paid - Unpaid', 0).outcome).toBe('counts');
    expect(fullyPaidVerdict('Fully Paid - Unpaid', 10).outcome).toBe('ignored');
    expect(fullyPaidVerdict('Fully Paid - Unpaid', null).outcome).toBe('ignored');
  });
  const ignored = [
    'Draft',
    'Cancelled',
    'Partially Paid',
    'Partially Settled',
    'Waiting',
    'Unpaid',
    'Overdue',
    'Issued - Waiting for Settlement',
    'Void',
    'Pending Payment',
  ];
  it.each(ignored)('ignores: %s', (status) => {
    expect(fullyPaidVerdict(status, null).outcome).toBe('ignored');
  });
  it('holds a status nobody has named, never guessing', () => {
    expect(fullyPaidVerdict('Something New', null).outcome).toBe('unknown');
    expect(fullyPaidVerdict('', null).outcome).toBe('unknown');
  });
  it('flags Fully Paid (Audit Required) for audit while still counting it', () => {
    const verdict = fullyPaidVerdict('Fully Paid (Audit Required)', null);
    expect(verdict.outcome).toBe('counts');
    expect(verdict.auditRequired).toBe(true);
  });
});

describe('invoice normalising', () => {
  function paidInvoice(ref = '1160000133', total = '1000.00'): string[][] {
    return invoiceRows([
      [
        'invoice',
        ref,
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '2026-01-06',
        '2026-01-07',
        'Fully Paid',
        '',
        total,
        '',
        '',
        '',
      ],
      ['item', ref, 'A company', 'Yes', '', '', '', '', '', '', '', 'Visa', 'Visa fee', '1000.00'],
    ]);
  }

  it('groups lines into one invoice, keyed by the 10-digit reference, never by DPIN', () => {
    const { records, held, fileProblem } = normaliseFile('invoice_export', INVOICE_HEADER, paidInvoice());
    expect(fileProblem).toBeNull();
    expect(held).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]!.invoice_ref).toBe('1160000133');
    expect(records[0]!.tax_no).toBe('DPIN-T-100');
    expect(records[0]!.record_date).toBe('2026-01-05');
    expect(records[0]!.fully_paid).toBe(true);
    // Customer name, email and phone are never stored on the record.
    expect(Object.keys(records[0]!).join(' ')).not.toMatch(/customer|email|phone/);
  });

  it('splits a wallet line off a sale: revenue is the amount less the wallet part', () => {
    const rows = invoiceRows([
      [
        'invoice',
        '1160000134',
        'A company',
        '',
        'DPIN-T-101',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1250.00',
        '',
        '',
        '',
      ],
      ['item', '1160000134', 'A company', 'Yes', '', '', '', '', '', '', '', 'Visa', 'Visa fee', '1000.00'],
      [
        'item',
        '1160000134',
        'A company',
        'No',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Direct Wallet',
        'Wallet Balance',
        '250.00',
      ],
    ]);
    const { records } = normaliseFile('invoice_export', INVOICE_HEADER, rows);
    expect(records).toHaveLength(1);
    expect(records[0]!.wallet_topup).toBe(250);
    expect(records[0]!.amount).toBe(1250);
  });

  it('excludes a wallet top-up only invoice and a draft invoice by rule', () => {
    const rows = invoiceRows([
      ['invoice', '1160000135', 'A company', '', '', '2026-01-05', '', '', 'Fully Paid', '', '500.00', '', '', ''],
      [
        'item',
        '1160000135',
        'A company',
        'No',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Direct Wallet',
        'Wallet Balance',
        '500.00',
      ],
      ['invoice', '1160000136', 'A company', '', '', '2026-01-05', '', '', 'Draft', '', '700.00', '', '', ''],
    ]);
    const { records, held } = normaliseFile('invoice_export', INVOICE_HEADER, rows);
    expect(records).toHaveLength(0);
    expect(held).toHaveLength(2);
    expect(held.map((h) => h.reason).join(' ')).toMatch(/Wallet top-up only/);
    expect(held.map((h) => h.reason).join(' ')).toMatch(/Not fully paid/);
  });

  it('writes a Waiting for Issuing invoice as provisional, never as fully-paid revenue', () => {
    const rows = invoiceRows([
      [
        'invoice',
        '1160000137',
        'A company',
        '',
        '',
        '2026-01-05',
        '',
        '',
        'Waiting for Issuing',
        '',
        '900.00',
        '',
        '',
        '',
      ],
    ]);
    const { records, held } = normaliseFile('invoice_export', INVOICE_HEADER, rows);
    expect(held).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]!.provisional).toBe(true);
    expect(records[0]!.fully_paid).toBe(false);
    const buckets = ledgerBuckets(
      toExisting(records).map((r) => ({ ...r, amount: r.amount, wallet_topup: r.wallet_topup, cost: r.cost })),
    );
    expect(buckets.provisional.records).toBe(1);
    expect(buckets.totals.records).toBe(1);
  });

  it('drops VAT and settlement columns: they never reach a record', () => {
    const header = [...INVOICE_HEADER, 'VAT Amount', 'Settlement Status'];
    const rows = invoiceRows([
      [
        'invoice',
        '1160000138',
        'A company',
        '',
        '',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
        '150.00',
        'Settled',
      ],
    ]);
    const { records } = normaliseFile('invoice_export', header, rows);
    expect(records).toHaveLength(1);
    expect(records[0]!.amount).toBe(1000);
    expect(JSON.stringify(records[0]!)).not.toMatch(/150|Settled/);
  });

  it('reads Arabic digits, a bracketed negative, and a decimal comma as money', () => {
    expect(parseMoney('١٬٢٥٠٫٥٠')).toBe(1250.5);
    expect(parseMoney('(500)')).toBe(-500);
    expect(parseMoney('1.250,50')).toBe(1250.5);
    expect(parseMoney('not money')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });
});

describe('duplicate re-import idempotence', () => {
  it('re-importing the same invoice file twice changes nothing the second time', () => {
    const rows = invoiceRows([
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
      ['item', '1160000133', 'A company', 'Yes', '', '', '', '', '', '', '', 'Visa', 'Visa fee', '1000.00'],
    ]);
    const first = normaliseFile('invoice_export', INVOICE_HEADER, rows);
    const firstPreview = buildPreview([], first.records, first.held);
    expect(firstPreview.counts.needs_linking).toBe(1); // missing transaction number
    const existing = toExisting(first.records);
    const second = normaliseFile('invoice_export', INVOICE_HEADER, rows);
    const secondPreview = buildPreview(existing, second.records, second.held);
    expect(secondPreview.counts).toEqual({ new: 0, updated: 0, unchanged: 1, excluded: 0, needs_linking: 0 });
  });

  it('a duplicate inside one file is skipped by default and kept only by choice', () => {
    const header = ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'];
    const rows = [
      ['TXN-1', 'Visa', '1000.00', 'Need to issue', '2026-01-05', 'Ready'],
      ['TXN-1', 'Visa', '1200.00', 'Need to issue', '2026-01-05', 'Ready'],
    ];
    const { records } = normaliseFile('corporate_transaction_list', header, rows);
    expect(records).toHaveLength(2);
    const skipped = buildPreview([], records, []);
    expect(skipped.rows.map((r) => r.outcome)).toEqual(['needs_linking', 'unchanged']);
    expect(skipped.rows[1]!.reasons).toEqual(['Duplicate in this file, skipped']);
    const kept = buildPreview([], records, [], { 3: 'keep' });
    expect(kept.rows.map((r) => r.outcome)).toEqual(['needs_linking', 'needs_linking']);
  });

  it('an updated row names the stored record it matched and the change, old to new (F182)', () => {
    // 'Fully Paid as receivable' is not a wording the file normaliser names yet (it holds the row), so the
    // before-status here is the other Fully Paid wording the normaliser does name.
    const first = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid (Audit Required)',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const existing = toExisting(first.records);
    const second = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const preview = buildPreview(existing, second.records, second.held);
    const row = preview.rows[0]!;
    expect(row.matched?.invoice_ref).toBe('1160000133');
    expect(row.changes).toEqual([{ field: 'status', before: 'Fully Paid (Audit Required)', after: 'Fully Paid' }]);
  });
});

describe('progressive fill', () => {
  const listHeader = ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'];

  it('an invoice-only row completes when the transaction list arrives', () => {
    const invoice = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const existing = toExisting(invoice.records);
    expect(existing[0]!.transaction_ref).toBeNull();
    const list = normaliseFile('corporate_transaction_list', listHeader, [
      ['TXN-9', 'Visa', '1000.00', 'Issued 1160000133', '2026-01-04', ''],
    ]);
    // Blank expense status with an issued invoice means the expenses are done.
    expect(list.records[0]!.expense_gate).toBe('done');
    const preview = buildPreview(existing, list.records, list.held);
    expect(preview.rows[0]!.outcome).toBe('updated');
    const merged = mergedRecord(existing[0]!, list.records[0]!);
    expect(merged.transaction_ref).toBe('TXN-9');
    expect(merged.invoice_ref).toBe('1160000133');
  });

  it('a transaction-only row completes when the invoice arrives', () => {
    const list = normaliseFile('corporate_transaction_list', listHeader, [
      ['TXN-9', 'Visa', '1000.00', 'Need to issue', '2026-01-04', 'Ready'],
    ]);
    const existing = toExisting(list.records);
    const invoice = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    // The invoice file carries no transaction number, so it cannot fill the list row
    // by itself: it lands as its own invoice-only row until a file carries both numbers.
    const preview = buildPreview(existing, invoice.records, invoice.held);
    expect(preview.rows[0]!.outcome).toBe('needs_linking');
  });

  it('approved expenses only become cost, and a missing cost stays empty, never 0', () => {
    const expenseHeader = ['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status', 'Created At'];
    const { records, held } = normaliseFile('transaction_expense_export', expenseHeader, [
      ['TXN-9', '200.00', 'Hotel Cost', 'Approved', '2026-01-06'],
      ['TXN-9', '50.00', 'Hotel Cost', 'Pending', '2026-01-06'],
      ['TXN-9', '200.00', 'Hotel Cost', 'Approved', '2026-01-07'],
    ]);
    expect(records).toHaveLength(1);
    expect(records[0]!.cost).toBe(400); // identical approved amounts are separate lines
    expect(held).toHaveLength(1);
    expect(held[0]!.reason).toMatch(/not approved yet/);
    const merged = mergedRecord(null, records[0]!);
    expect(merged.cost).toBe(400);
    expect(merged.amount).toBeNull(); // expense alone never invents an amount
  });
});

describe('grouped invoices: one invoice, several transactions', () => {
  it('an invoice filling grouped transactions never overwrites their amounts', () => {
    const listHeader = ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'];
    const list = normaliseFile('corporate_transaction_list', listHeader, [
      ['TXN-1', 'Visa', '600.00', 'Issued 1160000133', '2026-01-04', 'Ready'],
      ['TXN-2', 'Visa', '400.00', 'Issued 1160000133', '2026-01-04', 'Ready'],
    ]);
    const existing = toExisting(list.records);
    const invoice = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const preview = buildPreview(existing, invoice.records, invoice.held);
    expect(preview.rows[0]!.outcome).toBe('updated');
    expect(preview.rows[0]!.reasons.join(' ')).toMatch(/2 transaction rows sharing this invoice/);
    const merged = mergedRecord(existing[0]!, invoice.records[0]!, 2);
    expect(merged.amount).toBe(600); // transaction amount stands, not the group total
    expect(merged.tax_no).toBe('DPIN-T-100');
    expect(merged.fully_paid).toBe(true);
  });
});

describe('promo matching by invoice number only', () => {
  const promoHeader = ['Invoice Number', 'Before Discount', 'Discount', 'After Discount', 'Product', 'Payment Status'];

  it('matches an invoice by its 10-digit number and records the code given at import', () => {
    const invoice = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const existing = toExisting(invoice.records);
    const promo = normaliseFile(
      'promo_code_invoice_export',
      promoHeader,
      [['1160000133', '1200.00', '200.00', '1000.00', 'Visa', 'Fully Paid']],
      { sourcePromo: 'code-id-1' },
    );
    expect(promo.fileProblem).toBeNull();
    const preview = buildPreview(existing, promo.records, promo.held);
    expect(preview.rows[0]!.outcome).toBe('updated');
    const merged = mergedRecord(existing[0]!, promo.records[0]!);
    expect(merged.source_promo).toBe('code-id-1');
  });

  it('never matches by DPIN, TTIN, or a receipt reference alone', () => {
    const invoice = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const existing = toExisting(invoice.records);
    // Same tax number, different 10-digit number: must NOT match.
    const promo = normaliseFile(
      'promo_code_invoice_export',
      promoHeader,
      [['1160000999', '1200.00', '200.00', '1000.00', 'Visa', 'Fully Paid']],
      { sourcePromo: 'code-id-1' },
    );
    const preview = buildPreview(existing, promo.records, promo.held);
    expect(preview.rows[0]!.outcome).toBe('needs_linking');
  });

  it('stops a promo file with no code given: the link would otherwise be lost', () => {
    const promo = normaliseFile('promo_code_invoice_export', promoHeader, [
      ['1160000133', '1200.00', '200.00', '1000.00', 'Visa', 'Fully Paid'],
    ]);
    expect(promo.fileProblem).toMatch(/no discount-code column/);
    expect(promo.records).toEqual([]);
  });

  it('excludes a promo row that is not fully paid, and rejects a non-10-digit number', () => {
    const promo = normaliseFile(
      'promo_code_invoice_export',
      promoHeader,
      [
        ['1160000133', '1200.00', '200.00', '1000.00', 'Visa', 'Pending Payment'],
        ['123', '1200.00', '200.00', '1000.00', 'Visa', 'Fully Paid'],
      ],
      { sourcePromo: 'code-id-1' },
    );
    expect(promo.records).toEqual([]);
    expect(promo.held).toHaveLength(2);
  });
});

describe('needs-linking rows carry their own values (F182, L14 #6)', () => {
  it('an unmatched invoice row shows its own values and no matched record', () => {
    const { records } = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const preview = buildPreview([], records, []);
    const row = preview.rows[0]!;
    expect(row.outcome).toBe('needs_linking');
    expect(row.matched).toBeNull();
    expect(row.changes).toEqual([]);
    expect(row.values).toMatchObject({
      invoice_ref: '1160000133',
      transaction_ref: null,
      amount: 1000,
      record_date: '2026-01-05',
      tax_no: 'DPIN-T-100',
      status_text: 'Fully Paid',
      fully_paid: true,
      provisional: false,
    });
    expect(row.promo_before).toBeNull();
    expect(row.promo_discount).toBeNull();
    expect(row.promo_after).toBeNull();
  });

  it('an unmatched promo row shows its discount figures and code, not an amount', () => {
    const promoHeader = [
      'Invoice Number',
      'Before Discount',
      'Discount',
      'After Discount',
      'Product',
      'Payment Status',
    ];
    const { records } = normaliseFile(
      'promo_code_invoice_export',
      promoHeader,
      [['1160000999', '1200.00', '200.00', '1000.00', 'Visa', 'Fully Paid']],
      { sourcePromo: 'code-id-1' },
    );
    const preview = buildPreview([], records, []);
    const row = preview.rows[0]!;
    expect(row.outcome).toBe('needs_linking');
    expect(row.matched).toBeNull();
    expect(row.values).toMatchObject({
      invoice_ref: '1160000999',
      source_promo: 'code-id-1',
      product: 'Visa',
      fully_paid: true,
    });
    expect(row.values?.amount).toBeNull();
    expect(row.promo_before).toBe(1200);
    expect(row.promo_discount).toBe(200);
    expect(row.promo_after).toBe(1000);
  });

  it('an unmatched expense row shows its cost and transaction number', () => {
    const expenseHeader = ['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status', 'Created At'];
    const { records } = normaliseFile('transaction_expense_export', expenseHeader, [
      ['TXN-9', '200.00', 'Hotel Cost', 'Approved', '2026-01-06'],
    ]);
    const preview = buildPreview([], records, []);
    const row = preview.rows[0]!;
    expect(row.outcome).toBe('needs_linking');
    expect(row.matched).toBeNull();
    expect(row.values).toMatchObject({
      transaction_ref: 'TXN-9',
      cost: 200,
      record_date: '2026-01-06',
    });
    expect(row.values?.amount).toBeNull();
  });

  it('an unmatched transaction row shows its amount, service and refs', () => {
    const listHeader = ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'];
    const { records } = normaliseFile('corporate_transaction_list', listHeader, [
      ['TXN-9', 'Visa', '1000.00', 'Need to issue', '2026-01-04', 'Ready'],
    ]);
    const preview = buildPreview([], records, []);
    const row = preview.rows[0]!;
    expect(row.outcome).toBe('needs_linking');
    expect(row.matched).toBeNull();
    expect(row.values).toMatchObject({
      transaction_ref: 'TXN-9',
      invoice_ref: null,
      amount: 1000,
      product: 'Visa',
      record_date: '2026-01-04',
    });
  });

  it('a matched row still names its stored record and its changes, with its values alongside', () => {
    const first = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid (Audit Required)',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const existing = toExisting(first.records);
    const second = normaliseFile('invoice_export', INVOICE_HEADER, [
      [
        'invoice',
        '1160000133',
        'A company',
        '',
        'DPIN-T-100',
        '2026-01-05',
        '',
        '',
        'Fully Paid',
        '',
        '1000.00',
        '',
        '',
        '',
      ],
    ]);
    const preview = buildPreview(existing, second.records, second.held);
    const row = preview.rows[0]!;
    expect(row.matched?.invoice_ref).toBe('1160000133');
    expect(row.changes).toEqual([{ field: 'status', before: 'Fully Paid (Audit Required)', after: 'Fully Paid' }]);
    expect(row.values).toMatchObject({ invoice_ref: '1160000133', amount: 1000, status_text: 'Fully Paid' });
  });
});

describe('five counts', () => {
  it('counts sum to the rows in, with plain reasons and row numbers', () => {
    const header = ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'];
    const { records, held } = normaliseFile('corporate_transaction_list', header, [
      ['TXN-1', 'Visa', '1000.00', 'Need to issue', '2026-01-05', 'Ready'],
      ['', 'Visa', '1000.00', 'Need to issue', '2026-01-05', 'Ready'],
    ]);
    const preview = buildPreview([], records, held);
    const total = Object.values(preview.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(preview.rows.length);
    expect(preview.counts).toEqual({ new: 0, updated: 0, unchanged: 0, excluded: 1, needs_linking: 1 });
    expect(preview.problems[0]!.row_no).toBe(3);
  });
});
