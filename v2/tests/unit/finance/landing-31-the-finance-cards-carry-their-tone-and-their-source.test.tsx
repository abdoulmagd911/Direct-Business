/**
 * Landing 31 — the Finance page's figure cards in the V21 look. Revenue is the one green figure (the kit's `success`
 * tone), a loss is red, every other card stays neutral; each card names where it is read from ("— Recorded here");
 * Profit is the read's own profit — a row with no cost is never in it — and those rows' revenue sits on the
 * Provisional card with its one line; the months and By service cards say "· Recorded here". A phone gets the
 * Months / Services / Ledger switch only when the page hands it one. Every value is made up.
 * Sabotage: tests/sabotage/landing-31-finance.mjs "revenue-card-loses-its-green", "a-loss-is-not-red",
 * "profit-card-takes-the-provisional-rows", "provisional-card-loses-its-line", "cards-lose-their-source",
 * "by-service-stays-over-the-months-on-a-phone".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { FinanceOverview } from '../../../src/modules/finance/screens/FinanceOverview';
import type { FinanceTab } from '../../../src/modules/finance/tabs';
import type { OverviewData } from '../../../src/modules/finance/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

// two paid rows: 1,000 with a cost of 600, and 500 whose cost is not known yet — Profit is 400, never 900
const whole: OverviewData = {
  period: {
    from: '2026-10-01',
    to: '2026-10-31',
    units: 2,
    revenue: 1500,
    cost: 600,
    profit: 400,
    provisional: { units: 1, revenue: 500, cost: 0, profit: 500 },
    losses: 0,
    months: [
      {
        month_on: '2026-10-01',
        units: 2,
        revenue: 1500,
        cost: 600,
        profit: 400,
        provisional_units: 1,
        provisional_revenue: 500,
        provisional_profit: 500,
        losses: 0,
      },
    ],
  },
  closed: [],
  health: [],
  notInvoiced: { ready: { units: 0, amount_sar: 0 }, pending: { units: 0, amount_sar: 0 } },
  asOf: { as_of: '2026-11-01', files: {} },
  service: { from: '2026-10-01', to: '2026-10-31', revenue: 1500, rows: [], gap: 0 },
};

const html = (
  data: OverviewData,
  opts: { locale?: 'en' | 'ar'; onTab?: (v: FinanceTab) => void; tab?: FinanceTab; mayImport?: boolean } = {},
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={opts.locale ?? 'en'}
      messages={opts.locale === 'ar' ? ar : en}
      timeZone="Asia/Riyadh"
    >
      <FinanceOverview
        ask={{ key: 'custom', from: '2026-10-01', to: '2026-10-31' }}
        today="2026-11-16"
        full
        data={data}
        tab={opts.onTab ? (opts.tab ?? 'overview') : undefined}
        onTab={opts.onTab}
        mayImport={opts.mayImport}
      />
    </NextIntlClientProvider>,
  );

/** One card's own markup: from its mark to the next card's (or the end of the cards). */
const card = (out: string, kind: string) => {
  const from = out.indexOf(`data-finance-tile="${kind}"`);
  expect(from, `the ${kind} card is on the page`).toBeGreaterThan(-1);
  const next = out.indexOf('data-finance-tile="', from + 1);
  return out.slice(from, next === -1 ? out.indexOf('data-finance-lines') : next);
};
const figure = (cardHtml: string) => /data-finance-figure="true">([^<]*)</.exec(cardHtml)?.[1];

describe('the figure cards', () => {
  it('Revenue carries the success tone — the Revenue green — and Cost carries none', () => {
    const out = html(whole);
    expect(card(out, 'revenue'), 'Revenue is the green card').toContain('data-tone="success"');
    expect(card(out, 'revenue')).toContain('text-success');
    expect(card(out, 'cost'), 'Cost stays neutral').not.toContain('data-tone=');
    expect(card(out, 'provisional'), 'Provisional stays neutral').not.toContain('data-tone=');
  });

  it('a loss is red, a profit stays neutral', () => {
    expect(card(html(whole), 'profit'), 'a profit carries no tone').not.toContain('data-tone=');
    const loss = html({ ...whole, period: { ...whole.period!, profit: -350 } });
    expect(card(loss, 'profit'), 'a loss is the danger tone').toContain('data-tone="danger"');
  });

  it('each card says where it is read from, in both languages', () => {
    const out = html(whole);
    for (const label of ['Revenue — Recorded here', 'Cost — Recorded here', 'Profit — Recorded here'])
      expect(out, label).toContain(label);
    const arabic = html(whole, { locale: 'ar' });
    for (const label of ['الإيرادات — المسجّلة هنا', 'التكلفة — المسجّلة هنا', 'الربح — المسجّل هنا'])
      expect(arabic, label).toContain(label);
    expect(out, 'Months and By service say their source').toContain('· Recorded here');
  });

  it('Profit is the rows that have a cost; a row with no cost is on the Provisional card, never in Profit', () => {
    const out = html(whole);
    expect(figure(card(out, 'profit')), 'Profit is the read’s own profit').toBe('400');
    expect(figure(card(out, 'profit')), 'never revenue less cost over every row').not.toBe('900');
    expect(figure(card(out, 'provisional')), 'the no-cost rows’ revenue is Provisional').toBe('500');
    expect(card(out, 'provisional'), 'the Provisional card has its one line').toContain('1 row · cost not known yet');
    // the three cards keep the Provisional part directly under the figure, as before
    for (const kind of ['revenue', 'cost', 'profit'])
      expect(card(out, kind), `${kind} keeps its Provisional part`).toContain('data-finance-provisional');
  });

  it('keeps the money as whole riyals with a thousands comma, the short form over its exact figure', () => {
    const out = html({ ...whole, period: { ...whole.period!, revenue: 1_234_567 } });
    expect(figure(card(out, 'revenue'))).toBe('1.23M');
    expect(card(out, 'revenue'), 'the exact figure, whole riyals').toContain('1,234,567 SAR');
    expect(card(out, 'revenue'), 'never decimals').not.toContain('1,234,567.00');
  });
});

// Landing 58: the phone's Months / Services / Ledger switch became one row of tabs on every screen.
describe('the Finance tabs', () => {
  it('are only there when the page hands them one, and put nothing away without them', () => {
    const plain = html(whole);
    expect(plain, 'no tabs on their own').not.toContain('role="tablist"');
    expect(plain, 'nothing is put away').not.toMatch(
      /data-finance-tab-panel="overview"[^>]*hidden|hidden[^"]*"[^>]*data-finance-tab-panel/,
    );
  });

  it('name the four sections on every screen, with Import only for a person who imports', () => {
    const tabs = html(whole, { onTab: () => {} });
    expect(tabs).toContain('role="tablist"');
    for (const word of ['Overview', 'Ledger', 'Owed', 'Checks']) expect(tabs, word).toContain(`>${word}<`);
    expect(tabs, 'no Import tab for a person who does not import').not.toContain('>Import<');
    expect(html(whole, { onTab: () => {}, mayImport: true }), 'Import for a person who imports').toContain('>Import<');
    expect(tabs, 'never a phone-only row').not.toMatch(/role="tablist"[^>]*sm:hidden/);
  });

  it('show the months and income by service under Overview, and put them away under another tab', () => {
    const overview = html(whole, { onTab: () => {} });
    expect(overview).toMatch(/<div class="(?![^"]*\bhidden\b)[^"]*" data-finance-tab-panel="overview">/);
    expect(overview).toContain('data-finance-months');
    expect(overview).toContain('data-finance-service');
    const ledger = html(whole, { onTab: () => {}, tab: 'ledger' });
    expect(ledger, 'put away while Ledger is open').toMatch(
      /<div class="[^"]*\bhidden\b[^"]*" data-finance-tab-panel="overview">/,
    );
    expect(ledger, 'the figures stay on top under every tab').toContain('data-finance-tile="revenue"');
  });
});
