/**
 * Landing 47 (Finance Part B) — three smaller promises.
 * A7:  a commission typed by hand names which provider commission it is and carries its proof: with a commission
 *      chosen and no proof the form says so and sends nothing; a monthly invoice or a wallet top-up names none.
 * A13: a contract's payments are drawn by month or by quarter — each period's total with its invoices under it — and
 *      a document not yet counted is listed, marked, in no total.
 * A12: a postpaid organisation shows no wallet top-up; one that also holds a prepaid client ID keeps its wallet.
 * Every value is made up. Sabotage: tests/sabotage/landing-47-finance.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contractPaymentsOf, periodLabel } from '../../../src/modules/finance/checks';
import { COMMISSION_TYPES } from '../../../src/modules/finance/deal-type';
import { blankInvoice, commissionOf, problemsOf, type Lists } from '../../../src/modules/finance/invoice-form';
import { ContractPaymentsView } from '../../../src/modules/finance/screens/ContractPayments';
import { isPostpaidOnly } from '../../../src/modules/partners/postpaid';
import { inWords, parts } from './landing-32-fixtures';

const LISTS: Lists = { status: [], expenseStatus: [], product: [], service: [] };
const typed = (over: Partial<ReturnType<typeof blankInvoice>> = {}) => ({
  ...blankInvoice('2026-10-12'),
  ref: 'MADE-UP-1',
  status: 'paid',
  ...over,
});

describe('A7 — a hand-typed commission names itself and carries its proof', () => {
  it('offers exactly the five commissions', () => {
    expect([...COMMISSION_TYPES]).toEqual(['airlines', 'provider', 'cashback', 'study_abroad', 'other']);
  });

  it('an invoice that is not a commission asks for nothing more', () => {
    expect(problemsOf(typed(), LISTS)).toEqual([]);
    expect(commissionOf(typed())).toBeNull();
  });

  it('a commission with no proof is told so, on the proof field', () => {
    expect(problemsOf(typed({ commissionType: 'airlines' }), LISTS)).toEqual([
      { field: 'commissionProof', key: 'required' },
    ]);
    expect(problemsOf(typed({ commissionType: 'airlines', commissionProof: '   ' }), LISTS)).toEqual([
      { field: 'commissionProof', key: 'required' },
    ]);
  });

  it('with its proof it is ready, and the form names the commission', () => {
    const d = typed({ commissionType: 'cashback', commissionProof: 'Made-up statement, October' });
    expect(problemsOf(d, LISTS)).toEqual([]);
    expect(commissionOf(d)).toBe('cashback');
  });

  it('a proof longer than the field keeps is refused before anything is sent', () => {
    const d = typed({ commissionType: 'other', commissionProof: 'x'.repeat(501) });
    expect(problemsOf(d, LISTS)).toEqual([{ field: 'commissionProof', key: 'too_long' }]);
  });

  it('a monthly invoice or a wallet top-up names no commission, whatever the box still holds', () => {
    expect(commissionOf(typed({ kind: 'billing', commissionType: 'airlines' }))).toBeNull();
    expect(commissionOf(typed({ kind: 'wallet_topup', commissionType: 'airlines' }))).toBeNull();
    expect(problemsOf(typed({ kind: 'billing', commissionType: 'airlines' }), LISTS)).toEqual([]);
    expect(commissionOf(typed({ kind: 'standalone', commissionType: 'provider' }))).toBe('provider');
  });
});

const PAYMENTS = {
  grain: 'month',
  from: '2026-03-01',
  to: '2026-06-30',
  units: 4,
  total: 1000,
  not_yet_counted: 60,
  truncated: false,
  periods: [
    {
      period_start: '2026-03-01',
      units: 2,
      total: 500,
      not_yet_counted: 0,
      invoices: [
        { number: 'CPY-MAR-1', source: 'manual', created_on: '2026-03-05', amount: 300, counted: true, status: null },
        { number: 'CPY-MAR-2', source: 'import', created_on: '2026-03-20', amount: 200, counted: true, status: null },
      ],
    },
    {
      period_start: '2026-05-01',
      units: 2,
      total: 100,
      not_yet_counted: 60,
      invoices: [
        { number: 'CPY-MAY-1', source: 'manual', created_on: '2026-05-10', amount: 100, counted: true, status: null },
        {
          number: 'CPY-MAY-P',
          source: 'manual',
          created_on: '2026-05-20',
          amount: 60,
          counted: false,
          status: 'Pending',
        },
      ],
    },
  ],
};

describe('A13 — a contract’s payments, by month or by quarter', () => {
  const draw = (answer: unknown, grain: 'month' | 'quarter' = 'month', locale: 'en' | 'ar' = 'en') =>
    renderToStaticMarkup(
      inWords(
        <ContractPaymentsView
          data={contractPaymentsOf(answer)}
          grain={grain}
          loading={false}
          failed={false}
          onRetry={() => {}}
        />,
        locale,
      ),
    );

  it('each period is named, carries its own total, and lists its invoices under it', () => {
    const out = draw(PAYMENTS);
    // March only: up to the next period
    const march = parts(out, 'data-contract-period="2026-03-01"')[0]!.split('data-contract-period="2026-05-01"')[0]!;
    expect(march).toContain('March 2026');
    expect(parts(march, 'data-contract-period-total')[0]).toContain('500');
    expect(parts(march, 'data-contract-invoice').map((v) => /data-contract-invoice="([^"]+)"/.exec(v)?.[1])).toEqual([
      'CPY-MAR-1',
      'CPY-MAR-2',
    ]);
    expect(parts(march, 'data-contract-invoice')[1]).toContain('Imported');
  });

  it('a document not yet counted is listed under its period, marked, and is not in the period’s total', () => {
    const may = parts(draw(PAYMENTS), 'data-contract-period="2026-05-01"')[0]!;
    expect(parts(may, 'data-contract-period-total')[0]).toContain('100');
    const pending = parts(may, 'data-contract-invoice="CPY-MAY-P"')[0]!;
    expect(pending).toContain('Not counted yet');
    // the counted invoice's own line only: up to the next invoice of the period
    const counted = parts(may, 'data-contract-invoice="CPY-MAY-1"')[0]!.split('data-contract-invoice="CPY-MAY-P"')[0]!;
    expect(counted).not.toContain('Not counted yet');
  });

  it('says the contract’s counted total, and what is not yet counted apart', () => {
    const out = draw(PAYMENTS);
    expect(parts(out, 'data-contract-total')[0]).toContain('1,000');
    expect(parts(out, 'data-contract-not-yet-counted')[0]).toContain('60');
  });

  it('a quarter is named by its number and year, in both languages; a month by its own name', () => {
    const q = (n: number, year: number) => `Q${n} ${year}`;
    expect(periodLabel('2026-01-01', 'quarter', 'en', q)).toBe('Q1 2026');
    expect(periodLabel('2026-04-01', 'quarter', 'en', q)).toBe('Q2 2026');
    expect(periodLabel('2026-10-01', 'quarter', 'en', q)).toBe('Q4 2026');
    expect(periodLabel('2026-05-01', 'month', 'en', q)).toBe('May 2026');
    const quarterly = draw(
      { ...PAYMENTS, grain: 'quarter', periods: [{ ...PAYMENTS.periods[1]!, period_start: '2026-04-01' }] },
      'quarter',
      'ar',
    );
    expect(quarterly).toContain('الربع 2 · 2026');
  });

  it('no invoice in the term says so; an answer that is not the card’s shape is a failed read', () => {
    const none = draw({ ...PAYMENTS, total: 0, periods: [] });
    expect(none).toContain('data-contract-payments-empty');
    expect(contractPaymentsOf({ periods: [] })).toBeNull();
    expect(contractPaymentsOf({ total: 5, periods: [{ total: 5 }] })).toBeNull();
    expect(contractPaymentsOf(null)).toBeNull();
  });
});

describe('A12 — a postpaid organisation shows no wallet top-up', () => {
  const id = (subkind: string | null, kind = 'payments_client_id') => ({ kind, subkind });

  it('is postpaid when it holds a postpaid client ID and no prepaid one', () => {
    expect(isPostpaidOnly([id('postpaid')])).toBe(true);
    expect(isPostpaidOnly([id('postpaid'), id('tender')])).toBe(true);
    expect(isPostpaidOnly([id('postpaid'), id(null)])).toBe(true);
  });

  it('keeps its wallet when it also holds a prepaid client ID, or holds no postpaid one', () => {
    expect(isPostpaidOnly([id('postpaid'), id('prepaid')])).toBe(false);
    expect(isPostpaidOnly([id('prepaid')])).toBe(false);
    expect(isPostpaidOnly([id('tender')])).toBe(false);
    expect(isPostpaidOnly([])).toBe(false);
  });

  it('reads client IDs only: another identifier named postpaid changes nothing', () => {
    expect(isPostpaidOnly([id('postpaid', 'discount_code')])).toBe(false);
  });
});
