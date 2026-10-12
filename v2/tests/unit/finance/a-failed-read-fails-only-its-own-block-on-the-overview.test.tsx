/**
 * V231's rule, QA-542 and QA-543: each read of the Overview fails in its own block and is never drawn as a value. A
 * failed read of the Payments date is a failed read (not "as of —", which means no file yet); the Needs attention strip
 * keeps Checks failing and No client when the months or the closed months fail, and only Late changes is a dash.
 * Every value is made up.
 * Sabotage: tests/sabotage/finance.mjs "failed-payments-date-reads-as-no-file", "attention-strip-hides-when-closed-months-fail".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { FinanceOverview } from '../../../src/modules/finance/screens/FinanceOverview';
import type { OverviewData } from '../../../src/modules/finance/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const whole: OverviewData = {
  period: {
    from: '2026-01-01',
    to: '2026-10-11',
    units: 2,
    revenue: 1500,
    cost: 600,
    profit: 900,
    provisional: { units: 1, revenue: 500, cost: 0, profit: 500 },
    losses: 0,
    months: [],
  },
  closed: [],
  health: [
    { key: 'checks_failed', count: 2, amount_sar: null },
    { key: 'no_organisation', count: 3, amount_sar: null },
  ],
  notInvoiced: { ready: { units: 1, amount_sar: 10 }, pending: { units: 2, amount_sar: 20 } },
  asOf: { as_of: null, files: {} },
  service: { from: '2026-01-01', to: '2026-10-11', revenue: 1500, rows: [], gap: 0 },
};

const html = (data: OverviewData) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <FinanceOverview
        ask={{ key: 'ytd', from: '2026-01-01', to: '2026-10-11' }}
        today="2026-10-11"
        full={false}
        data={data}
      />
    </NextIntlClientProvider>,
  );

describe('the Payments date', () => {
  it('reads "as of —" only when the read worked and there is no file yet', () => {
    const out = html(whole);
    expect(out).toContain('data-finance-stamp');
    expect(out).toContain('Payments · as of —');
  });

  it('is a failed read, with Try again, when the read failed — never the same dash (QA-542)', () => {
    const out = html({ ...whole, asOf: null });
    expect(out).not.toContain('Payments · as of —');
    expect(out).not.toContain('data-finance-stamp');
    expect(out).toContain('Payments date');
    expect(out).toContain('Try again');
  });
});

describe('the Needs attention strip', () => {
  const flag = (out: string, kind: string) =>
    out.match(new RegExp(`data-finance-flag="${kind}" data-count="([^"]*)"`))?.[1];

  it('shows all three counts when every read worked', () => {
    const out = html(whole);
    expect([flag(out, 'checks'), flag(out, 'no-client'), flag(out, 'late')]).toEqual(['2', '3', '0']);
  });

  it('keeps Checks failing and No client when the closed months failed, and says Late changes is unknown (QA-543)', () => {
    const out = html({ ...whole, closed: null });
    expect([flag(out, 'checks'), flag(out, 'no-client'), flag(out, 'late')]).toEqual(['2', '3', 'unknown']);
  });

  it('keeps them when the months failed too', () => {
    const out = html({ ...whole, closed: null, period: null });
    expect([flag(out, 'checks'), flag(out, 'no-client')]).toEqual(['2', '3']);
  });

  it('is a failed read of its own when the health read failed', () => {
    const out = html({ ...whole, health: null });
    expect(out).not.toContain('data-finance-attention');
    expect(out).toContain('What needs attention');
  });
});
