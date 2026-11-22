// @vitest-environment jsdom
/**
 * Landing 37 (Finance F-C, A6): what a Pending invoice does to an organisation's Finance tab. It is named in the tab's
 * "Not yet counted" card — its number, its status and its amount — and the tab's Revenue, Cost and Profit cards and
 * its list of counted rows are exactly what they are without it. With a document waiting the card never says
 * "Everything is counted". The Imported switch hides an imported waiting row like every other imported row.
 * Every value is made up. Sabotage: tests/sabotage/landing-37-finance.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { CompanySummary, PartnerCard } from '../../../src/modules/partners/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ levels: { finance: 'full' } }) }));
vi.mock('@/ui/SavedViewsBar', () => ({ SavedViewsBar: () => <div data-saved-views-stub /> }));

type Block = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: unknown };
const reads: { ledger: Block } = { ledger: { status: 'loading' } };
vi.mock('@/modules/finance/use-reads', () => ({
  useFinanceRead: (fn: string) => ({
    block:
      fn === 'finance_unified_ledger'
        ? reads.ledger
        : fn === 'finance_payments_as_of'
          ? { status: 'ready', data: { as_of: '2026-11-10' } }
          : { status: 'ready', data: { excluded_units: 0, held_units: 0 } },
    retry: () => {},
  }),
}));

const { FinanceTab } = await import('../../../src/modules/partners/screens/record/CompanyTabs');

const counted = {
  invoice_id: 'a',
  unit_kind: 'transaction',
  transaction_number: '9903700020',
  invoice_number: null,
  partner_id: 'p-1',
  created_on: '2026-11-02',
  revenue: 1000,
  cost: 200,
  profit: 800,
  dpin: null,
  flags: [] as string[],
  source: 'manual',
  counted: true,
};
const waits = (over: Record<string, unknown>) => ({
  invoice_id: 'w',
  unit_kind: 'transaction',
  transaction_number: '9903700012',
  invoice_number: null,
  number: '9903700012',
  partner_id: 'p-1',
  created_on: '2026-11-08',
  amount: 100,
  received: 0,
  remaining: 100,
  status: 'Pending',
  source: 'manual',
  direct_url: null,
  ...over,
});
const LEDGER = {
  totals: { units: 1, revenue: 1000, cost: 200, profit: 800, not_yet_counted_units: 2, not_yet_counted_amount: 400 },
  rows: [counted],
  not_yet_counted: [
    waits({}),
    waits({
      invoice_id: 'import:9903700014',
      number: '9903700014',
      amount: 300,
      status: 'Waiting for Issuing',
      source: 'import',
    }),
  ],
  truncated: false,
};
const NOTHING_WAITS = { ...LEDGER, not_yet_counted: [], totals: { ...LEDGER.totals, not_yet_counted_units: 0 } };

const card = {
  id: 'p-1',
  trade_name_en: 'Made-up Org',
  trade_name_ar: null,
  identifiers: [{ id: 'i-1', kind: 'payments_client_id', subkind: 'prepaid', value: '990001' }],
} as unknown as PartnerCard;
const summary = {
  partner_id: 'p-1',
  finance_visible: true,
  wallet: { topped_up: null, wallet_spent: null, invoiced_total: null, balance: null, held: null, available: null },
  finance: {},
  codes: [],
  tenders: [],
} as unknown as CompanySummary;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  reads.ledger = { status: 'loading' };
});

const draw = async (data: unknown, over: { locale?: 'en' | 'ar'; hideImported?: boolean } = {}) => {
  reads.ledger = { status: 'ready', data };
  const locale = over.locale ?? 'en';
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <FinanceTab
          card={card}
          summary={summary}
          onRetry={() => {}}
          side="client"
          hideImported={over.hideImported ?? false}
          view=""
        />
      </NextIntlClientProvider>,
    );
  });
};

const tiles = () => [...document.querySelectorAll('[data-partner-finance-totals] [data-kpi-tile]')];
const card0 = () => document.querySelector('[data-partner-finance-not-counted]')!;
const waiting = () => [...document.querySelectorAll('[data-partner-finance-waiting-row]')];

describe("a Pending invoice on an organisation's Finance tab", () => {
  it('is named in the Not yet counted card: number, status, amount', async () => {
    await draw(LEDGER);
    expect(waiting().map((r) => r.getAttribute('data-partner-finance-waiting-row'))).toEqual([
      '9903700012',
      '9903700014',
    ]);
    expect(waiting()[0]!.textContent).toContain('Pending');
    expect(waiting()[0]!.textContent, 'its amount, said as not yet counted').toMatch(/Not yet counted\s*100/);
    expect(waiting()[0]!.textContent, 'its day, written the one way').toContain('8 Nov 2026');
  });

  it('moves no card: Revenue, Cost and Profit are the same with it as without it', async () => {
    await draw(LEDGER);
    const withIt = tiles().map((x) => x.textContent);
    expect(withIt[0], 'Revenue is the one counted row').toContain('1,000');
    expect(withIt[0], 'none of the waiting 100 or 300').not.toMatch(/1,100|1,300|1,400/);
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    await draw(NOTHING_WAITS);
    expect(
      tiles().map((x) => x.textContent),
      'the cards without the waiting documents',
    ).toEqual(withIt);
  });

  it('is not among the counted rows', async () => {
    await draw(LEDGER);
    const rows = [...document.querySelectorAll('[data-partner-finance-row]')];
    expect(rows.length, 'one counted row').toBe(1);
    expect(rows[0]!.textContent).not.toContain('9903700012');
  });

  it('with a document waiting the card never says Everything is counted', async () => {
    await draw(LEDGER);
    expect(card0().textContent).not.toContain('Everything is counted');
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    await draw(NOTHING_WAITS);
    expect(card0().textContent, 'and says so when nothing waits').toContain('Everything is counted');
    expect(waiting().length).toBe(0);
  });

  it('the Imported switch hides an imported waiting row', async () => {
    await draw(LEDGER, { hideImported: true });
    expect(waiting().map((r) => r.getAttribute('data-partner-finance-waiting-row'))).toEqual(['9903700012']);
  });

  it('reads in Arabic', async () => {
    await draw(LEDGER, { locale: 'ar' });
    expect(waiting()[0]!.textContent).toContain('لم يُحتسب بعد');
  });
});
