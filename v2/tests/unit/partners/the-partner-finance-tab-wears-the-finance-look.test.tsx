// @vitest-environment jsdom
/**
 * Landing 31 (the V21 boards): a partner's Finance tab wears the Finance page's look — its totals are the kit's KPI
 * cards with Revenue in the Revenue green, the imported rows sit behind a one-word switch ("Imported": on shows them,
 * off hides them from the list AND the totals, and the address keeps the same hideImported filter), each row names its
 * source on a pill, and every state is drawn: loading as a skeleton, a failed read with Try again, no access.
 * The figures are the ones the unified-ledger read answers, never a sample. Every value is made up.
 * Sabotage: tests/sabotage/landing-31-finance-tab-codes.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { CompanySummary, PartnerCard } from '../../../src/modules/partners/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushed: string[] = [];
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (to: string) => pushed.push(to), refresh: () => {} }),
}));
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ levels: { finance: 'full' } }) }));
// the saved-views bar reads its own views; here it is only a mark that it is still on the tab
vi.mock('@/ui/SavedViewsBar', () => ({ SavedViewsBar: () => <div data-saved-views-stub /> }));

type Block = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: unknown };
const reads: { ledger: Block; asOf: Block; notCounted: Block; retried: string[] } = {
  ledger: { status: 'loading' },
  asOf: { status: 'loading' },
  notCounted: { status: 'loading' },
  retried: [],
};
vi.mock('@/modules/finance/use-reads', () => ({
  useFinanceRead: (fn: string) => ({
    block:
      fn === 'finance_unified_ledger' ? reads.ledger : fn === 'finance_payments_as_of' ? reads.asOf : reads.notCounted,
    retry: () => reads.retried.push(fn),
  }),
}));

const { FinanceTab } = await import('../../../src/modules/partners/screens/record/CompanyTabs');

const ledgerRow = (over: Record<string, unknown>) => ({
  invoice_id: 'inv',
  unit_kind: 'flight',
  transaction_number: 'TX-MADE-1',
  invoice_number: '9001',
  partner_id: 'p-1',
  created_on: '2026-11-02',
  revenue: 1000,
  cost: 200 as number | null,
  profit: 800 as number | null,
  dpin: null,
  flags: [],
  source: 'manual',
  ...over,
});
/** Two rows recorded here (one with no cost yet) and one imported row. */
const LEDGER = {
  totals: {},
  rows: [
    ledgerRow({ invoice_id: 'a', transaction_number: 'TX-MADE-1' }),
    ledgerRow({ invoice_id: 'b', transaction_number: 'TX-MADE-2', revenue: 500, cost: null, profit: null }),
    ledgerRow({
      invoice_id: 'c',
      transaction_number: 'TX-MADE-3',
      revenue: 1200,
      cost: 100,
      profit: 1100,
      source: 'import',
    }),
  ],
  truncated: false,
};

const card = {
  id: 'p-1',
  trade_name_en: 'Made-up Travel',
  trade_name_ar: 'سفر تجريبي',
  identifiers: [{ id: 'i-1', kind: 'payments_client_id', subkind: 'prepaid', value: '8812345' }],
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
  pushed.length = 0;
  reads.retried.length = 0;
  reads.ledger = { status: 'loading' };
  reads.asOf = { status: 'loading' };
  reads.notCounted = { status: 'loading' };
});

const draw = async (
  over: { locale?: 'en' | 'ar'; hideImported?: boolean; summary?: CompanySummary | null; onRetry?: () => void } = {},
) => {
  const locale = over.locale ?? 'en';
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <FinanceTab
          card={card}
          summary={over.summary === undefined ? summary : over.summary}
          onRetry={over.onRetry ?? (() => {})}
          side="client"
          hideImported={over.hideImported ?? false}
          view=""
        />
      </NextIntlClientProvider>,
    );
  });
};

const ready = () => {
  reads.ledger = { status: 'ready', data: LEDGER };
  reads.asOf = { status: 'ready', data: { as_of: '2026-11-10' } };
  reads.notCounted = { status: 'ready', data: { excluded_units: 0, held_units: 0 } };
};
const tiles = () => [...document.querySelectorAll('[data-partner-finance-totals] [data-kpi-tile]')];
const rows = () => [...document.querySelectorAll('[data-partner-finance-row]')];
const theSwitch = () => document.querySelector('[data-partner-finance-imported] [role="switch"]') as HTMLElement;

describe("a partner's Finance tab wears the Finance page's look", () => {
  it('shows the totals of the rows read as four cards, Revenue in the Revenue green and no other figure coloured', async () => {
    ready();
    await draw();
    expect(tiles().length).toBe(4);
    const [revenue, cost, profit, bookings] = tiles();
    expect(revenue!.getAttribute('data-tone')).toBe('success');
    expect(revenue!.textContent).toContain('Revenue');
    expect(revenue!.textContent, 'the three rows together').toContain('2,700');
    expect(revenue!.textContent).toContain(en.common.sar);
    expect(cost!.getAttribute('data-tone')).toBeNull();
    expect(cost!.textContent, 'only the rows that have a cost').toContain('300');
    expect(profit!.getAttribute('data-tone')).toBeNull();
    expect(profit!.textContent, 'only the rows that have a profit').toContain('1,900');
    expect(bookings!.textContent).toContain('3');
    // every card carries its line icon on the circle
    for (const tile of tiles()) expect(tile.querySelector('[data-kpi-icon] svg')).not.toBeNull();
    expect(document.querySelector('[data-partner-finance-totals]')!.textContent).toContain('1 row still has no cost');
  });

  it('a figure with no source is a dash with the words under it, never 0', async () => {
    reads.ledger = {
      status: 'ready',
      data: { ...LEDGER, rows: [ledgerRow({ invoice_id: 'b', revenue: 700, cost: null, profit: null })] },
    };
    await draw();
    const [, cost, profit] = tiles();
    expect(cost!.textContent).toContain('—');
    expect(cost!.textContent).toContain('Cost not known yet');
    expect(profit!.textContent).toContain('—');
    expect(profit!.textContent).toContain('Not known yet');
    expect(cost!.textContent).not.toMatch(/\b0\b/);
    expect(profit!.textContent).not.toMatch(/\b0\b/);
  });

  it('names each row’s source on a pill and lists every row read', async () => {
    ready();
    await draw();
    expect(rows().length).toBe(3);
    expect(rows().filter((r) => r.textContent!.includes('Recorded here')).length).toBe(2);
    expect(rows().filter((r) => r.textContent!.includes('Imported')).length).toBe(1);
    expect(rows()[0]!.textContent).toContain('TX-MADE-1');
    expect(rows()[0]!.textContent, 'the invoice number is named under the reference').toContain('Invoice no. 9001');
    expect(document.querySelector('[data-finance-stamp]')!.textContent).toContain('Payments · ');
    expect(document.querySelector('[data-saved-views-stub]'), 'the saved views stay on the tab').not.toBeNull();
    expect(document.querySelector('[data-finance-export]'), 'and so does Export').not.toBeNull();
  });

  it('the one-word switch "Imported" is on while the imported rows show, and turning it off asks for the same hideImported filter', async () => {
    ready();
    await draw();
    expect(theSwitch().getAttribute('aria-label')).toBe('Imported');
    expect(theSwitch().getAttribute('aria-checked')).toBe('true');
    await act(async () => theSwitch().click());
    expect(pushed).toEqual(['/partners/p-1?tab=finance&hideImported=1']);
    expect(theSwitch().getAttribute('aria-checked')).toBe('false');
    expect(rows().length, 'the imported row leaves the list').toBe(2);
    expect(tiles()[0]!.textContent, 'and the total with it').toContain('1,500');
    await act(async () => theSwitch().click());
    expect(pushed[1]).toBe('/partners/p-1?tab=finance');
    expect(rows().length).toBe(3);
  });

  it('opens off when the address carries the filter, in Arabic under the board’s word', async () => {
    ready();
    await draw({ locale: 'ar', hideImported: true });
    expect(theSwitch().getAttribute('aria-label')).toBe('المستورد');
    expect(theSwitch().getAttribute('aria-checked')).toBe('false');
    expect(rows().length).toBe(2);
    expect(tiles()[0]!.textContent).toContain(ar.common.sar);
    expect(tiles()[0]!.textContent).not.toContain('SAR');
  });

  it('draws the loading read as a skeleton of the cards, with no figure', async () => {
    await draw();
    expect(document.querySelector('[data-partner-finance-ledger]')!.getAttribute('data-state')).toBe('loading');
    expect(document.querySelector('[data-partner-finance-skeleton]')!.children.length).toBe(4);
    expect(tiles().length).toBe(0);
    expect(rows().length).toBe(0);
  });

  it('a failed ledger read says so with Try again, and draws no figure', async () => {
    reads.ledger = { status: 'failed' };
    await draw();
    const failed = document.querySelector('[data-partner-finance-ledger] [data-state="failed"]')!;
    expect(failed.textContent).toContain('Try again');
    expect(tiles().length).toBe(0);
    await act(async () => (failed.querySelector('button') as HTMLButtonElement).click());
    expect(reads.retried).toEqual(['finance_unified_ledger']);
  });

  it('a partner whose money is not open to the reader says no access, and a summary that failed offers Try again', async () => {
    await draw({ summary: { ...summary, finance_visible: false } as CompanySummary });
    expect(document.querySelector('[data-state="no-access"]')!.textContent).toContain(
      'Money for this partner is not open to you',
    );
    expect(document.querySelector('[data-partner-finance]')).toBeNull();
    act(() => root?.unmount());
    document.body.innerHTML = '';
    let retried = 0;
    await draw({ summary: null, onRetry: () => (retried += 1) });
    const failed = document.querySelector('[data-state="failed"]')!;
    await act(async () => (failed.querySelector('button') as HTMLButtonElement).click());
    expect(retried).toBe(1);
  });

  it('shows the client IDs as tags and an empty wallet in words', async () => {
    ready();
    await draw();
    expect(document.querySelector('[data-client-id="i-1"]')!.textContent).toBe('8812345');
    expect(document.querySelector('[data-partner-finance-wallet]')!.textContent).toContain('Not known yet');
    expect(document.querySelector('[data-partner-finance-not-counted]')!.textContent).toContain(
      'Everything is counted',
    );
  });
});
