// @vitest-environment jsdom
/**
 * Landing 32 (Finance F-B): the unified-ledger read now also LISTS the rows that do not count. On a partner's Finance
 * tab the cards and the main list are the COUNTED rows only — a row that does not count is never added to a total,
 * with the imported rows shown or hidden — so the tab's totals equal the Finance page's by-organisation totals for
 * that organisation. The rows that do not count are listed apart under "Not counted (N)" with their revenue and the
 * reason (and the list-rule words when a list rule catches the row), following the Imported switch like the main
 * list. Cost and profit stay a dash when no counted row has a cost — never 0. A row whose code is not among the codes
 * carries the pill "Code has not been found". The tab offers no Exclude / Include.
 * Every value is made up. Sabotage: tests/sabotage/landing-32-codes-tab.mjs.
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
  flags: [] as string[],
  source: 'manual',
  counted: true,
  excluded_by: null as string | null,
  not_counted_reason: null as string | null,
  excluded_row_level: false,
  ...over,
});
const out = { counted: false, cost: null, profit: null } as const;
/** Two counted rows (one recorded here, one imported) and three rows that do not count. */
const LEDGER = {
  can_toggle: true,
  totals: { units: 2, revenue: 2200, cost: 300, profit: 1900, excluded_units: 2, excluded_revenue: 7770 },
  rows: [
    ledgerRow({ invoice_id: 'a', transaction_number: 'TX-MADE-1' }),
    ledgerRow({
      invoice_id: 'b',
      transaction_number: 'TX-MADE-2',
      revenue: 1200,
      cost: 100,
      profit: 1100,
      source: 'import',
    }),
    ledgerRow({
      invoice_id: 'x',
      transaction_number: 'TX-MADE-7',
      invoice_number: '9007',
      revenue: 4440,
      ...out,
      excluded_by: 'invoice',
      excluded_row_level: true,
      not_counted_reason: 'made-up reason typed on the row',
    }),
    ledgerRow({
      invoice_id: 'y',
      transaction_number: 'TX-MADE-8',
      revenue: 3330,
      source: 'import',
      ...out,
      excluded_by: 'client_id',
      excluded_row_level: false,
      not_counted_reason: 'made-up list reason',
    }),
    ledgerRow({
      invoice_id: 'z',
      transaction_number: 'TX-MADE-9',
      revenue: 5550,
      source: 'import',
      ...out,
      flags: ['code_not_found'],
    }),
  ],
  truncated: false,
};

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
const rows = () => [...document.querySelectorAll('[data-partner-finance-row]')];
const apart = () => document.querySelector('[data-company-not-counted-rows]');
const apartRows = () => [...document.querySelectorAll('[data-company-not-counted-row]')];
const theSwitch = () => document.querySelector('[data-partner-finance-imported] [role="switch"]') as HTMLElement;

describe("a partner's Finance tab counts only the counted rows", () => {
  it('the cards are the counted rows only — a row that does not count is never added', async () => {
    await draw(LEDGER);
    const [revenue, cost, profit, bookings] = tiles();
    expect(revenue!.textContent, '1,000 + 1,200, none of 4,440 / 3,330 / 5,550').toContain('2,200');
    expect(cost!.textContent).toContain('300');
    expect(profit!.textContent).toContain('1,900');
    expect(bookings!.textContent).toMatch(/Bookings\s*2$/);
    // the client-side sum is the database's own total for the organisation — difference 0
    expect(revenue!.textContent).toContain(LEDGER.totals.revenue.toLocaleString('en-US'));
    expect(document.querySelector('[data-partner-finance-totals]')!.textContent).not.toContain('still has no cost');
  });

  it('with the imported rows hidden the totals are still the counted rows only', async () => {
    await draw(LEDGER, { hideImported: true });
    const [revenue, cost, profit, bookings] = tiles();
    expect(revenue!.textContent, 'the one counted row recorded here, not the 4,440 beside it').toContain('1,000');
    expect(revenue!.textContent).not.toContain('5,440');
    expect(cost!.textContent).toContain('200');
    expect(profit!.textContent).toContain('800');
    expect(bookings!.textContent).toMatch(/Bookings\s*1$/);
  });

  it('the main list shows the counted rows, and its count says so', async () => {
    await draw(LEDGER);
    expect(rows().map((r) => r.querySelector('bdi')!.textContent)).toEqual(['TX-MADE-1', 'TX-MADE-2']);
    expect(document.querySelector('[data-finance-export]')!.closest('div')!.textContent).toContain('Rows2');
  });

  it('lists the rows that do not count apart, under "Not counted (N)", with revenue and the reason', async () => {
    await draw(LEDGER);
    expect(apart()!.querySelector('h3')!.textContent).toBe('Not counted (3)');
    expect(apartRows().length).toBe(3);
    const [byHand, byList, noCode] = apartRows();
    expect(byHand!.textContent).toContain('TX-MADE-7');
    expect(byHand!.textContent).toContain('Invoice no. 9007');
    expect(byHand!.textContent).toContain('4,440');
    expect(byHand!.querySelector('[data-company-not-counted-reason]')!.textContent).toBe(
      'made-up reason typed on the row',
    );
    expect(byList!.textContent).toContain('3,330');
    expect(byList!.querySelector('[data-company-not-counted-reason]')!.textContent).toBe('made-up list reason');
    expect(noCode!.textContent).toContain('5,550');
    expect(noCode!.querySelector('[data-company-not-counted-reason]')).toBeNull();
    // the apart section is its own card, never inside the totals
    expect(document.querySelector('[data-partner-finance-totals]')!.contains(apart())).toBe(false);
  });

  it('a row a list rule catches says so in words; a row excluded by hand does not', async () => {
    await draw(LEDGER);
    const [byHand, byList, noCode] = apartRows();
    expect(byList!.querySelector('[data-company-list-rule]')!.textContent).toBe(
      'Excluded by a list rule — change it in Settings → Finance',
    );
    expect(byHand!.querySelector('[data-company-list-rule]')).toBeNull();
    expect(noCode!.querySelector('[data-company-list-rule]')).toBeNull();
  });

  it('the apart list follows the Imported switch like the main list', async () => {
    await draw(LEDGER);
    await act(async () => theSwitch().click());
    expect(rows().length).toBe(1);
    expect(apart()!.querySelector('h3')!.textContent).toBe('Not counted (1)');
    expect(apartRows().map((r) => r.querySelector('bdi')!.textContent)).toEqual(['TX-MADE-7']);
    await act(async () => theSwitch().click());
    expect(apartRows().length).toBe(3);
  });

  it('draws no apart section when every row counts', async () => {
    await draw({ ...LEDGER, rows: LEDGER.rows.filter((r) => r.counted) });
    expect(apart()).toBeNull();
    expect(rows().length).toBe(2);
  });

  it('cost and profit stay a dash when no counted row has a cost, never 0 — a row that does not count changes nothing', async () => {
    await draw({
      ...LEDGER,
      totals: { units: 1, revenue: 700, cost: null, profit: null },
      rows: [
        ledgerRow({ invoice_id: 'a', revenue: 700, cost: null, profit: null }),
        ledgerRow({ invoice_id: 'x', transaction_number: 'TX-MADE-7', revenue: 4440, ...out, excluded_by: 'invoice' }),
      ],
    });
    const [revenue, cost, profit] = tiles();
    expect(revenue!.textContent).toContain('700');
    expect(cost!.textContent).toContain('—');
    expect(cost!.textContent).toContain('Cost not known yet');
    expect(profit!.textContent).toContain('—');
    expect(profit!.textContent).toContain('Not known yet');
    expect(cost!.textContent).not.toMatch(/\b0\b/);
    expect(profit!.textContent).not.toMatch(/\b0\b/);
    // only the counted row is a row that still waits for its cost
    expect(document.querySelector('[data-partner-finance-totals]')!.textContent).toContain('1 row still has no cost');
  });

  it('a partner whose every row is out shows an empty list, a dash for cost and profit, and the rows apart', async () => {
    await draw({ ...LEDGER, rows: LEDGER.rows.filter((r) => !r.counted) });
    expect(rows().length).toBe(0);
    expect(document.querySelector('[data-partner-finance-empty]')).not.toBeNull();
    const [, cost, profit, bookings] = tiles();
    expect(cost!.textContent).toContain('—');
    expect(profit!.textContent).toContain('—');
    expect(bookings!.textContent).toMatch(/Bookings\s*0$/);
    expect(apartRows().length).toBe(3);
  });

  it('a row whose code is not among the codes carries the pill "Code has not been found", once', async () => {
    await draw({
      ...LEDGER,
      rows: [
        ...LEDGER.rows,
        ledgerRow({ invoice_id: 'c', transaction_number: 'TX-MADE-3', flags: ['code_not_found'] }),
      ],
    });
    const counted = rows()[2]!;
    expect(counted.querySelector('[data-company-code-not-found]')!.textContent).toBe('Code has not been found');
    expect(counted.textContent!.split('Code has not been found').length - 1).toBe(1);
    expect(counted.textContent).not.toContain('code_not_found');
    expect(apartRows()[2]!.querySelector('[data-company-code-not-found]')!.textContent).toBe('Code has not been found');
    expect(rows()[0]!.querySelector('[data-company-code-not-found]')).toBeNull();
  });

  it('offers no Exclude and no Include on this tab, even to an admin', async () => {
    await draw(LEDGER);
    const words = [...document.querySelectorAll('[data-partner-finance-ledger] button')].map((b) => b.textContent);
    expect(words).not.toContain('Exclude');
    expect(words).not.toContain('Include');
  });

  it('reads in Arabic', async () => {
    await draw(LEDGER, { locale: 'ar' });
    expect(apart()!.querySelector('h3')!.textContent).toBe('غير محتسب (3)');
    expect(apartRows()[1]!.querySelector('[data-company-list-rule]')!.textContent).toBe(
      'مستبعد بقاعدة من القوائم — غيّرها من الإعدادات ← المالية',
    );
    expect(apartRows()[2]!.querySelector('[data-company-code-not-found]')!.textContent).toBe('لم يُعثر على الكود');
  });
});
