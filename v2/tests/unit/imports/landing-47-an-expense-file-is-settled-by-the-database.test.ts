/**
 * Landing 47 (Finance Part B, A3 + A4) — the expense file on its way to the preview.
 * A3: an expense whose reference is a tax invoice number (DPIN… / TTIN…) is held in the file itself, with its reason;
 *     one the database holds (the reference is the tax number a stored row carries) leaves the rows and joins the held
 *     rows with the database's own sentence.
 * A4: every Approved line travels with its amount, approval time and expense type — the database tells one expense
 *     from another by those and the transaction number (CKY-01), so nothing is deduplicated here; the preview shows
 *     the cost the database answers (what is stored + what is new), never the file's own sum, and the Confirm call
 *     carries the lines.
 * Every value is made up. Sabotage: tests/sabotage/landing-47-imports.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  applySettled,
  buildPreview,
  expenseRowsToSettle,
  isTaxInvoiceRef,
  normaliseFile,
  settledOf,
  toApplyPayload,
  whyOf,
} from '@/modules/imports';

const HEADER = ['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status', 'Created At', 'Approval/Rejection Date'];
const file = () =>
  normaliseFile('transaction_expense_export', HEADER, [
    ['TXN-MADE-1', '100.00', 'Hotel', 'Approved', '2026-03-01', '2026-03-01 10:00'],
    ['TXN-MADE-1', '100.00', 'Hotel', 'Approved', '2026-03-01', '2026-03-01 10:00'],
    ['TXN-MADE-1', '50.00', 'Visa', 'Approved', '2026-03-02', '2026-03-02 09:30'],
    ['TXN-MADE-1', '70.00', 'Visa', 'Pending', '2026-03-02', ''],
    ['DPIN-T-4400', '80.00', 'Hotel', 'Approved', '2026-03-03', '2026-03-03 10:00'],
    ['ttin-t-9', '80.00', 'Hotel', 'Approved', '2026-03-03', '2026-03-03 10:00'],
    ['TXN-MADE-2', '-25.00', 'Hotel', 'Approved', '2026-03-04', '2026-03-04 10:00'],
  ]);

describe('A3 — an expense is keyed to a transaction number, never to a tax invoice number', () => {
  it('knows a tax invoice number by its shape, whatever its letter case', () => {
    expect(isTaxInvoiceRef('DPIN-T-4400')).toBe(true);
    expect(isTaxInvoiceRef(' ttin-t-9')).toBe(true);
    expect(isTaxInvoiceRef('TXN-MADE-1')).toBe(false);
    expect(isTaxInvoiceRef('9911000001')).toBe(false);
  });

  it('holds a line whose reference is a DPIN or a TTIN, with the reason and the reference', () => {
    const { records, held } = file();
    expect(records.map((r) => r.transaction_ref)).toEqual(['TXN-MADE-1', 'TXN-MADE-2']);
    const tax = held.filter((h) => h.why?.code === 'expense_tax_ref');
    expect(tax.map((h) => h.row_no)).toEqual([6, 7]);
    expect(tax[0]!.reason).toContain('DPIN-T-4400');
    expect(tax[0]!.reason).toMatch(/never matched to a tax invoice/);
    expect(whyOf(tax[0]!.reason)?.code, 'the stored sentence reads back into its code').toBe('expense_tax_ref');
  });
});

describe('A4 — every Approved line travels; the database counts each expense once', () => {
  it('carries each Approved line with its amount, approval time and expense type — repeats included', () => {
    const { records } = file();
    const one = records[0]!;
    expect(one.lines).toEqual([
      { amount: 100, approved_at: '2026-03-01 10:00', expense_type: 'Hotel' },
      { amount: 100, approved_at: '2026-03-01 10:00', expense_type: 'Hotel' },
      { amount: 50, approved_at: '2026-03-02 09:30', expense_type: 'Visa' },
    ]);
    expect(one.expense_lines, 'the line that is not approved is held, never a line').toBe(3);
    expect(records[1]!.lines, 'a credit is a line with a negative amount').toEqual([
      { amount: -25, approved_at: '2026-03-04 10:00', expense_type: 'Hotel' },
    ]);
  });

  it('asks the database with each expense row’s number, transaction and lines', () => {
    const { records } = file();
    expect(expenseRowsToSettle(records)).toEqual([
      { row_no: 2, transaction_ref: 'TXN-MADE-1', lines: records[0]!.lines },
      { row_no: 8, transaction_ref: 'TXN-MADE-2', lines: records[1]!.lines },
    ]);
  });

  it('shows the cost the database answers — stored plus new, a repeat once — never the file’s own sum', () => {
    const { records, held } = file();
    expect(records[0]!.cost, 'the file’s own sum counts the repeat twice').toBe(250);
    const settled = settledOf([
      { row_no: 2, transaction_ref: 'TXN-MADE-1', held: false, cost: 430, keys: [], added: 2, repeated: 1 },
      { row_no: 8, transaction_ref: 'TXN-MADE-2', held: false, cost: 175, keys: [], added: 1, repeated: 0 },
    ])!;
    const out = applySettled(records, held, settled);
    expect(out.records[0]!.cost, 'what Confirm will store').toBe(430);
    expect(out.records[0]!.expense_repeats).toBe(1);
    expect(out.records[1]!.cost).toBe(175);
    expect(out.held).toEqual(held);
    // and the preview diffs that cost against what is stored
    const preview = buildPreview(
      [
        {
          transaction_ref: 'TXN-MADE-1',
          invoice_ref: '9911000001',
          tax_no: null,
          record_date: '2026-03-01',
          amount: 1000,
          wallet_topup: 0,
          cost: 280,
          status_text: 'Fully Paid',
          fully_paid: true,
          provisional: false,
          source_promo: null,
          product: null,
        },
      ],
      out.records,
      out.held,
    );
    const row = preview.rows.find((r) => r.transaction_ref === 'TXN-MADE-1')!;
    expect(row.changes).toEqual([{ field: 'cost', before: 280, after: 430 }]);
  });

  it('moves a row the database holds out of the rows and into the held rows, with the database’s sentence', () => {
    const { records, held } = file();
    const out = applySettled(records, held, settledOf([{ row_no: 2, transaction_ref: 'TXN-MADE-1', held: true }])!);
    expect(out.records.map((r) => r.transaction_ref)).toEqual(['TXN-MADE-2']);
    const added = out.held.filter((h) => h.why?.code === 'db_expense_tax_ref');
    expect(
      added.map((h) => h.row_no),
      'every file row of that expense is held',
    ).toEqual([2, 3, 4]);
    expect(added[0]!.reason).toBe(
      'An expense is keyed to a transaction number, never to a tax invoice number: held for a person',
    );
  });

  it('is not an answer when it is not a list of rows: a failed read, never a guessed cost', () => {
    expect(settledOf(null)).toBeNull();
    expect(settledOf({ rows: [] })).toBeNull();
    expect(settledOf([{ transaction_ref: 'TXN-MADE-1' }])).toBeNull();
    expect(settledOf([])).toEqual([]);
  });

  it('sends the lines on Confirm for an expense row, and for no other kind', () => {
    const { records, held } = file();
    const payload = toApplyPayload(buildPreview([], records, held), records, {});
    expect(payload.rows.map((r) => r.lines)).toEqual([records[0]!.lines, records[1]!.lines]);
    const list = normaliseFile(
      'corporate_transaction_list',
      ['RECEIPT REF.', 'PRODUCT', 'AMOUNT (SAR)', 'INVOICE ISSUING', 'CREATED AT', 'EXPENSE STATUS'],
      [['TXN-MADE-9', 'Visa', '600.00', 'Need to issue', '2026-01-04', 'Ready']],
    );
    const other = toApplyPayload(buildPreview([], list.records, list.held), list.records, {});
    expect('lines' in other.rows[0]!, 'a transaction row carries no lines').toBe(false);
  });
});
