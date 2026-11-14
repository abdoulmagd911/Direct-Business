/**
 * The preview says what Confirm will do (13 Nov sweep). An expense line brings a cost to a transaction that is already
 * stored; the apply step keeps that transaction's own date (work.import_apply changes its cost only). The preview used
 * to say "Changed: date" — the expense's day over the transaction's — so the same expense file, imported twice, read
 * "Updated" every time and never "Unchanged". A new expense row, with no transaction yet, still keeps its own day.
 */
import { describe, expect, it } from 'vitest';
import { buildPreview, normaliseFile, type ExistingRecord } from '@/modules/imports';

const EXPENSE_HEADER = ['Invoice#', 'Amount (SAR)', 'Expense Type', 'Status', 'Created At'];
const stored = (patch: Partial<ExistingRecord>): ExistingRecord => ({
  transaction_ref: 'TXN-7',
  invoice_ref: '9990000007',
  tax_no: null,
  record_date: '2026-10-05',
  amount: 1500,
  wallet_topup: 0,
  cost: null,
  status_text: 'Fully Paid',
  fully_paid: true,
  provisional: false,
  source_promo: null,
  product: 'Made Up Flights',
  ...patch,
});

describe('an expense never moves a stored transaction date', () => {
  const file = normaliseFile('transaction_expense_export', EXPENSE_HEADER, [
    ['TXN-7', '600.00', 'Flight cost', 'Approved', '2026-10-06'],
  ]);

  it('says only the cost changes, and keeps the transaction day', () => {
    const preview = buildPreview([stored({})], file.records, file.held);
    const row = preview.rows[0]!;
    expect(row.outcome).toBe('updated');
    expect(row.changes).toEqual([{ field: 'cost', before: null, after: 600 }]);
    expect(row.values?.record_date).toBe('2026-10-05');
  });

  it('reads the same file again as unchanged', () => {
    const preview = buildPreview([stored({ cost: 600 })], file.records, file.held);
    expect(preview.rows[0]!.outcome).toBe('unchanged');
    expect(preview.counts.unchanged).toBe(1);
  });

  it('an expense with no transaction yet keeps its own day', () => {
    const preview = buildPreview([], file.records, file.held);
    expect(preview.rows[0]!.values?.record_date).toBe('2026-10-06');
  });
});
