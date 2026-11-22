// @vitest-environment jsdom
/**
 * Landing 37 (Finance F-C, F185): the New invoice form shows the invoice saved last.
 * Opened (or opened again), the form reads the reader's last saved invoice from the database and shows it at the top:
 * transaction number, status, created, paid and total — the saved record, not a blank page. A paid day or a total
 * that is not recorded is a dash, never today and never 0. A Pending one says it is not counted until it is paid. A
 * reader who has saved nothing sees no such card; a read that fails says so with Try again.
 * The number check: an imported row with the same number refuses nothing (the same document from the other door).
 * Every value is made up. Sabotage: tests/sabotage/landing-37-finance.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { numberIsUsed, savedCounts, savedInvoiceOf } from '../../../src/modules/finance/invoice-form';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));

const { NewInvoice } = await import('../../../src/modules/finance/screens/NewInvoice');

const lists = {
  status: [{ key: 'pending', name_en: 'Pending', name_ar: null }],
  expenseStatus: [{ key: 'approved', name_en: 'Approved', name_ar: null }],
  product: [],
  service: [],
};
const PENDING = {
  invoice_id: 'inv-made-up',
  ref: '9903700012',
  kind: 'transaction',
  status: 'Pending',
  pay_state: 'pending',
  created_on: '2026-11-08',
  paid_on: null,
  total_sar: 100,
  saved_at: '2026-11-08T13:41:30Z',
};

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  rpcMock.mockReset();
});

const open = async (locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <NewInvoice today="2026-11-22" lists={lists as never} />
      </NextIntlClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const record = () => document.querySelector('[data-last-saved-record]');
const fact = (k: string) => document.querySelector(`[data-saved-fact="${k}"] dd`)?.textContent ?? null;

describe('the New invoice form shows the invoice saved last', () => {
  it('opened again, it shows the saved record — number, status, created, paid, total', async () => {
    rpcMock.mockImplementation(async (fn: string) => (fn === 'finance_last_saved' ? PENDING : null));
    await open();
    expect(rpcMock, 'the record is read from the database').toHaveBeenCalledWith('finance_last_saved', {});
    expect(record(), 'the saved record is shown, not a blank form').not.toBeNull();
    expect(record()!.textContent).toContain('Last saved');
    expect(fact('transaction'), 'the transaction number').toBe('9903700012');
    expect(fact('status'), 'the status').toBe('Pending');
    expect(fact('created'), 'the created day, written the one way').toBe('8 Nov 2026');
    expect(fact('paid'), 'no paid day is a dash, never today').toBe('—');
    expect(fact('total'), 'the total').toBe('100.00');
    expect(record()!.textContent, 'a Pending invoice is not counted yet').toContain('Not counted until it is paid');
  });

  it('the record sits above the fields, so a phone shows it first', async () => {
    rpcMock.mockImplementation(async (fn: string) => (fn === 'finance_last_saved' ? PENDING : null));
    await open();
    const ref = document.querySelector('[data-new-ref]')!;
    expect(
      record()!.compareDocumentPosition(ref) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the number box comes after the saved record',
    ).toBeTruthy();
  });

  it('a paid invoice says it is counted, with its paid day; a missing total is a dash, never 0', async () => {
    rpcMock.mockImplementation(async (fn: string) =>
      fn === 'finance_last_saved'
        ? { ...PENDING, status: 'Fully Paid', pay_state: 'paid', paid_on: '2026-11-09', total_sar: null }
        : null,
    );
    await open();
    expect(fact('paid')).toBe('9 Nov 2026');
    expect(fact('total'), 'no total recorded').toBe('—');
    expect(record()!.textContent).toContain('Counted');
    expect(record()!.textContent).not.toContain('Not counted until it is paid');
  });

  it('a reader who has saved nothing sees no such card', async () => {
    rpcMock.mockResolvedValue(null);
    await open();
    expect(record()).toBeNull();
    expect(document.querySelector('[data-new-ref]'), 'the form itself is there').not.toBeNull();
  });

  it('a read that fails says so, with Try again', async () => {
    rpcMock.mockRejectedValue(new Error('made-up failure'));
    await open();
    expect(record()).toBeNull();
    expect(document.body.textContent).toContain('Last saved could not be loaded');
    expect(document.body.textContent).toContain('Try again');
  });

  it('reads in Arabic', async () => {
    rpcMock.mockImplementation(async (fn: string) => (fn === 'finance_last_saved' ? PENDING : null));
    await open('ar');
    expect(record()!.textContent).toContain('آخر ما حُفظ');
    expect(record()!.textContent).toContain('لا تُحتسب حتى تُدفع');
    expect(fact('transaction')).toBe('9903700012');
  });
});

describe('the saved record and the number check, as rules', () => {
  it('the answer is read under the form’s names; nothing saved is nothing', () => {
    expect(savedInvoiceOf(PENDING)).toEqual({
      invoiceId: 'inv-made-up',
      ref: '9903700012',
      kind: 'transaction',
      status: 'Pending',
      payState: 'pending',
      created: '2026-11-08',
      paid: null,
      total: 100,
    });
    expect(savedInvoiceOf(null)).toBeNull();
    expect(savedInvoiceOf({ ref: '', created_on: '2026-11-08' }), 'an answer with no number is no record').toBeNull();
  });

  it('only a fully paid status counts', () => {
    expect(savedCounts({ payState: 'paid' })).toBe(true);
    expect(savedCounts({ payState: 'pending' })).toBe(false);
    expect(savedCounts({ payState: 'draft' })).toBe(false);
    expect(savedCounts({ payState: null }), 'an unknown status is not called counted').toBe(false);
  });

  it('the same number twice is refused; an imported row with that number refuses nothing', () => {
    expect(numberIsUsed([{ ref: '9903700012', source: 'manual' }], ' 9903700012 ')).toBe(true);
    expect(numberIsUsed([{ ref: 'MADEUP-1' }], 'madeup-1'), 'an older answer names no source').toBe(true);
    expect(numberIsUsed([{ ref: '9903700012', source: 'import' }], '9903700012')).toBe(false);
    expect(numberIsUsed([{ ref: '99037000123', source: 'manual' }], '9903700012'), 'a longer number is another').toBe(
      false,
    );
  });
});
