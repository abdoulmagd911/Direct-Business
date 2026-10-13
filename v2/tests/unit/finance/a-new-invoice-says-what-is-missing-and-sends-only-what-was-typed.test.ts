import { describe, expect, it } from 'vitest';
import {
  amountOf,
  blankExpense,
  blankInvoice,
  blankLine,
  expenseFields,
  invoiceFields,
  lineFields,
  lineTotal,
  problemsOf,
  serviceOfProduct,
  type InvoiceDraft,
  type Lists,
} from '@/modules/finance/invoice-form';

const lists: Lists = {
  status: [
    { key: 'fully_paid', name_en: 'Fully Paid', word: 'Fully Paid', maps_to: 'paid' },
    { key: 'draft', name_en: 'Draft', word: 'Draft', maps_to: 'draft' },
  ],
  expenseStatus: [
    { key: 'approved', name_en: 'Approved', word: 'Approved', maps_to: 'approved' },
    { key: 'pending', name_en: 'Pending', word: 'Pending', maps_to: 'pending' },
    { key: 'cancelled', name_en: 'Cancelled', word: 'Cancelled', maps_to: 'cancelled' },
  ],
  product: [
    { id: 'p1', key: 'hotels', name_en: 'Hotels', word: 'Hotels', service_id: 's1' },
    { id: 'p2', key: 'wallet_topup', name_en: 'Wallet top-up', word: null, service_id: null, no_supplier_cost: true },
  ],
  service: [{ id: 's1', key: 'hotels', name_en: 'Hotels' }],
};

const draft = (over: Partial<InvoiceDraft> = {}): InvoiceDraft => ({
  ...blankInvoice('2026-09-10'),
  ref: 'TX-1',
  status: 'fully_paid',
  total: '1000',
  ...over,
});
const expense = (status: string, amount: string) => ({ ...blankExpense(), type: 'Hotel', status, amount });

describe('typed amounts', () => {
  it('reads plain numbers, treats blank as nothing and refuses the rest', () => {
    expect(amountOf('1,250.50')).toBe(1250.5);
    expect(amountOf('  ')).toBeNull();
    expect(amountOf('12abc')).toBe('invalid');
    expect(amountOf('1.234')).toBe('invalid');
    expect(lineTotal({ qty: '3', price: '19.99' })).toBe(59.97);
    expect(lineTotal({ qty: '', price: '5' })).toBeNull();
  });
});

describe('what is missing', () => {
  it('asks for the number, the status and the created day, in that order', () => {
    const none = problemsOf({ ...blankInvoice(''), created: '' }, lists);
    expect(none.map((p) => p.field)).toEqual(['ref', 'status', 'created']);
  });

  it('asks an approved expense for its amount (the database refuses one without)', () => {
    const p = problemsOf(draft({ expenses: [expense('approved', '')] }), lists);
    expect(p).toEqual([{ field: 'expense.0.amount', key: 'required' }]);
    expect(problemsOf(draft({ expenses: [expense('pending', '')] }), lists)).toEqual([]);
  });

  it('refuses a line with no name or an amount that is not a number', () => {
    const p = problemsOf(draft({ lines: [{ ...blankLine(), qty: 'x', price: '1' }] }), lists);
    expect(p.map((x) => x.field)).toEqual(['line.0.name', 'line.0.price']);
  });
});

describe('what is sent', () => {
  it('sends Payments’ own word for the status and leaves out whatever was not typed', () => {
    const f = invoiceFields(draft({ customerName: ' Made Up Co ' }), lists);
    expect(f).toMatchObject({
      ref: 'TX-1',
      kind: 'transaction',
      status: 'Fully Paid',
      created_on: '2026-09-10',
      total_sar: 1000,
      customer_name: 'Made Up Co',
    });
    expect(f).not.toHaveProperty('paid_on');
    expect(f).not.toHaveProperty('client_id');
    // the channel is set after the save, never as a field of the invoice
    expect(f).not.toHaveProperty('channel');
  });

  it('sends a line by its product word and leaves the service to the database unless one was picked', () => {
    const l = { ...blankLine(), product: 'hotels', name: 'Rooms', qty: '2', price: '500' };
    expect(lineFields(l, 'inv', lists)).toEqual({
      invoice_id: 'inv',
      name: 'Rooms',
      qty: 2,
      unit_price: 500,
      total_sar: 1000,
      product: 'Hotels',
    });
    expect(lineFields({ ...l, service: 'hotels' }, 'inv', lists)).toMatchObject({ service: 'hotels' });
    expect(serviceOfProduct('hotels', lists)).toBe('hotels');
    expect(serviceOfProduct('wallet_topup', lists)).toBe('');
  });

  it('sends an expense by its status word, and no amount when none was typed', () => {
    expect(expenseFields(expense('pending', ''), 'inv', lists)).toEqual({
      invoice_id: 'inv',
      expense_type: 'Hotel',
      status: 'Pending',
    });
  });
});
