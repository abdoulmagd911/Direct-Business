/**
 * Landing 34 (the 19 Nov test round, items 16/35, 19, 18 and 15) — the Finance Overview.
 * One Provisional amount: the page said 4,200 on the Provisional card, 3,500 in the months and a dash under Cost for
 * one thing. The card read `provisional.revenue`; the months read `provisional_profit` / `provisional.profit`, which
 * leaves the imported rows out (a row with no cost has no profit); Cost read `provisional.cost`, always empty. Now
 * every place reads the revenue of the rows whose cost is not known yet, and no profit is printed for them.
 * An honest stamp: a Payments date more than two days old is said as "not refreshed since", in the warning tone.
 * Income by company has a name and an address. Words and figures never run together.
 * Every value is made up.
 * Sabotage: tests/sabotage/landing-34-finance.mjs "months-total-reads-the-provisional-profit",
 * "month-row-reads-the-provisional-profit", "cost-card-reads-the-empty-provisional-cost",
 * "provisional-row-prints-a-profit", "stale-stamp-reads-as-current", "stamp-hides-the-newest-file",
 * "income-by-company-loses-its-name", "income-by-company-loses-its-address", "provisional-words-run-together",
 * "not-invoiced-words-run-together", "screen-words-lets-any-company-through".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import check from '../../../scripts/checks/screen-words.mjs';
import { stampOf } from '../../../src/modules/finance/figures';
import { FinanceOverview } from '../../../src/modules/finance/screens/FinanceOverview';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import type { LedgerReport, OverviewData } from '../../../src/modules/finance/types';
import { findings, fixture } from '../checks/helpers';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

// three rows whose cost is not known yet: two typed here (3,500) and one imported (700). The read's provisional
// PROFIT leaves the imported row out (3,500); its provisional REVENUE is the whole 4,200.
const whole: OverviewData = {
  period: {
    from: '2026-01-01',
    to: '2026-11-19',
    units: 5,
    revenue: 9200,
    cost: 2000,
    profit: 3000,
    provisional: { units: 3, revenue: 4200, cost: null as unknown as number, profit: 3500 },
    losses: 0,
    months: [
      {
        month_on: '2026-11-01',
        units: 5,
        revenue: 9200,
        cost: 2000,
        profit: 3000,
        provisional_units: 3,
        provisional_revenue: 4200,
        provisional_profit: 3500,
        losses: 0,
      },
    ],
  },
  closed: [],
  health: [],
  notInvoiced: { ready: { units: 1, amount_sar: 10 }, pending: { units: 1, amount_sar: 20 } },
  asOf: { as_of: '2026-11-08', files: { made_up_a: '2026-11-08', made_up_b: '2026-11-15' } },
  service: { from: '2026-01-01', to: '2026-11-19', revenue: 9200, rows: [], gap: 0 },
};

const html = (data: OverviewData, today = '2026-11-19', locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <FinanceOverview
        ask={{ key: 'ytd', from: '2026-01-01', to: '2026-11-19' }}
        today={today}
        full={false}
        data={data}
      />
    </NextIntlClientProvider>,
  );
/** What a person reads: the tags gone, the spaces as they are in the page. */
const words = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
/** The element that carries `hook`, up to the end of the page (enough to read what follows the hook). */
const from = (out: string, hook: string) => out.slice(out.indexOf(hook));
const tile = (out: string, kind: string) => {
  const at = out.indexOf(`data-finance-tile="${kind}"`);
  const next = out.indexOf('data-finance-tile="', at + 1);
  return out.slice(at, next < 0 ? out.indexOf('data-finance-lines') : next);
};

describe('one Provisional amount on the whole page (items 16/35)', () => {
  const out = html(whole);

  it('the Provisional card is the revenue of the rows whose cost is not known yet', () => {
    expect(words(tile(out, 'provisional'))).toContain('4,200');
  });

  it('the months’ total says the same amount, never the provisional profit', () => {
    const total = words(from(out, 'data-finance-total-provisional').slice(0, 120));
    expect(total).toContain('4,200');
    expect(total).not.toContain('3,500');
  });

  it('the month’s own row says the same amount', () => {
    const row = from(out, 'data-finance-month="2026-11-01"');
    expect(words(row.slice(0, row.indexOf('data-finance-month-provisional')))).toContain('4,200');
  });

  it('the Revenue card holds it, and the Cost and Profit cards name the same amount as left out — never a dash', () => {
    expect(words(tile(out, 'revenue'))).toContain('of which Provisional 4,200 · 3 units');
    expect(words(tile(out, 'cost'))).toContain('not counting Provisional 4,200 · 3 units');
    expect(words(tile(out, 'profit'))).toContain('not counting Provisional 4,200 · 3 units');
    expect(words(from(tile(out, 'cost'), 'data-finance-provisional"'))).not.toContain('—');
  });

  it('the provisional profit, which leaves the imported rows out, is printed nowhere', () => {
    expect(words(out)).not.toContain('3,500');
  });

  it('a Provisional row has no cost and so no profit: both are empty, never a figure', () => {
    const row = from(out, 'data-finance-month-provisional="2026-11-01"');
    const cells = words(row.slice(0, row.indexOf('data-finance-total')));
    expect(cells).toContain('4,200');
    expect(cells.match(/—/g)?.length ?? 0, 'cost, profit and provisional are dashes').toBeGreaterThanOrEqual(3);
  });

  it('reads the same in Arabic', () => {
    const arabic = html(whole, '2026-11-19', 'ar');
    expect(words(tile(arabic, 'cost'))).toContain(`${ar.finance.provisionalLeft} 4,200`);
    expect(words(arabic)).not.toContain('3,500');
  });
});

describe('the Payments stamp never sits silently stale (item 19)', () => {
  it('is "as of" while it is at most two days old', () => {
    const out = html(whole, '2026-11-10');
    expect(words(from(out, 'data-finance-stamp').slice(0, 200))).toContain('Payments · as of 8 Nov 2026');
    expect(out).not.toContain('data-stale');
  });

  it('is "not refreshed since", in the warning tone, once it is more than two days old', () => {
    const out = html(whole, '2026-11-19');
    expect(words(out)).toContain('Payments · not refreshed since 8 Nov 2026');
    expect(words(out)).not.toContain('Payments · as of');
    const stamp = out.slice(
      out.lastIndexOf('<span', out.indexOf('data-finance-stamp')),
      out.indexOf('data-finance-stamp'),
    );
    expect(stamp).toContain('text-warning');
    expect(out).toContain('data-stale');
  });

  it('says the newest file’s day too, when another file was read later than the oldest', () => {
    expect(words(html(whole))).toContain('Newest file read 15 Nov 2026');
    const one = html({ ...whole, asOf: { as_of: '2026-11-08', files: { made_up_a: '2026-11-08' } } });
    expect(one).not.toContain('data-finance-stamp-newest');
  });

  it('counts the days in whole days, and a stamp with no day is never stale', () => {
    expect(stampOf({ as_of: '2026-11-08', files: {} }, '2026-11-10')).toEqual({
      day: '2026-11-08',
      stale: false,
      newest: null,
    });
    expect(stampOf({ as_of: '2026-11-08', files: {} }, '2026-11-11').stale).toBe(true);
    expect(stampOf({ as_of: null, files: {} }, '2026-11-19')).toEqual({ day: null, stale: false, newest: null });
  });
});

describe('words and figures never run together (item 15)', () => {
  const out = html(whole);

  it('Not yet invoiced: each word and figure apart, by the row’s own gap', () => {
    const line = from(out, 'data-finance-not-invoiced');
    expect(words(line.slice(0, line.indexOf('</p>')))).toContain('Not yet invoiced Ready 1 · Pending 1');
    const p = out.slice(
      out.lastIndexOf('<p', out.indexOf('data-finance-not-invoiced')),
      out.indexOf('data-finance-not-invoiced'),
    );
    expect(p).toContain('flex-wrap');
    expect(p).toContain('gap-x-');
  });

  it('of which Provisional: the words, the amount and the rows apart, by the line’s own gap', () => {
    const t = tile(out, 'revenue');
    const span = t.slice(
      t.lastIndexOf('<span', t.indexOf('data-finance-provisional')),
      t.indexOf('data-finance-provisional'),
    );
    expect(span).toContain('flex-wrap');
    expect(span).toContain('gap-x-');
  });
});

describe('Income by company (item 18)', () => {
  const report: LedgerReport = {
    from: '2026-01-01',
    to: '2026-11-19',
    partner: null,
    client_id: null,
    kind: null,
    code: null,
    project: null,
    totals: { units: 1, revenue: 1000, cost: 600, profit: 400, without_cost: 0, received: 1000, remaining: 0 },
    companies: [
      {
        partner_id: 'p-made-up',
        partner_number: '990001',
        trade_name_en: 'Made-up Org',
        trade_name_ar: null,
        units: 1,
      },
    ],
    by_company: [
      {
        partner_id: 'p-made-up',
        units: 1,
        revenue: 1000,
        cost: 600,
        profit: 400,
        without_cost: 0,
        received: 1000,
        remaining: 0,
      },
    ],
    invoices: [],
    rows: [],
    truncated: false,
  };
  const ledger = (locale: 'en' | 'ar') =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <FinanceReport report={report} loading={false} failed={false} onRetry={() => {}} />
      </NextIntlClientProvider>,
    );

  it('the ledger’s table by partner is named Income by company, in both languages', () => {
    expect(words(from(ledger('en'), 'data-finance-by-company').slice(0, 400))).toContain('Income by company');
    expect(words(from(ledger('ar'), 'data-finance-by-company').slice(0, 400))).toContain('الدخل حسب الجهة');
  });

  it('has an address of its own, like Income by service, and a link to it beside Income by service', () => {
    expect(ledger('en')).toContain('id="finance-company"');
    const out = html(whole);
    const link = out.slice(
      out.lastIndexOf('<a', out.indexOf('data-finance-company-link')),
      out.indexOf('data-finance-company-link'),
    );
    expect(link).toContain('href="#finance-company"');
  });

  it('the screen-words check lets that one label through, and still refuses the word anywhere else', async () => {
    const root = fixture({
      'messages/en.json': JSON.stringify(
        { finance: { ledger: { byCompany: 'Income by company', other: 'Income by company', by: 'By company' } } },
        null,
        2,
      ),
    });
    const got = await findings(check, root);
    // line 4 is the owner's label under its own key; the same words under another key, and another wording, are refused
    expect(got.filter((f) => f.file === 'messages/en.json').map((f) => f.line)).toEqual([5, 6]);
    expect(en.finance.ledger.byCompany).toBe('Income by company');
  });
});
