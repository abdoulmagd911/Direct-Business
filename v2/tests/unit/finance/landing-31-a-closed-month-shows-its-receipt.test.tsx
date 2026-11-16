/**
 * Landing 31 — after Close month: a panel that says what was closed, by whom, when, and the month's totals as they
 * were kept, with ONE button. A month that had no row keeps its dashes — never a 0. Every value is made up.
 * Sabotage: tests/sabotage/landing-31-finance.mjs "receipt-forgets-who-closed", "receipt-has-two-buttons",
 * "receipt-draws-a-missing-month-as-zero".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { CloseReceipt, type Closed } from '../../../src/modules/finance/screens/CloseReceipt';

const closed: Closed = {
  month: '2026-10-01',
  monthLabel: 'October 2026',
  by: 'Made Up Closer',
  on: '2026-11-16',
  units: 7,
  figures: { revenue: 59050, cost: 54620, profit: 4430 },
};

const html = (c: Closed, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <CloseReceipt closed={c} onDone={() => {}} />
    </NextIntlClientProvider>,
  );
const fact = (out: string, key: string) => new RegExp(`data-receipt="${key}".*?<dd[^>]*>([^<]*)</dd>`).exec(out)?.[1];

describe('the Close month receipt', () => {
  it('says what was closed, by whom, when, and the totals', () => {
    const out = html(closed);
    expect(out).toContain('data-finance-close-receipt="2026-10-01"');
    expect(out, 'what was closed').toContain('October 2026 closed');
    expect(fact(out, 'by'), 'by whom').toBe('Made Up Closer');
    expect(fact(out, 'on'), 'when, the app’s one date').toBe('16 Nov 2026');
    expect(fact(out, 'rows')).toBe('7');
    expect(fact(out, 'revenue')).toBe('59,050 SAR');
    expect(fact(out, 'cost')).toBe('54,620 SAR');
    expect(fact(out, 'profit')).toBe('4,430 SAR');
  });

  it('has ONE button', () => {
    const out = html(closed);
    expect(out.match(/<button/g)?.length, 'one button').toBe(1);
    expect(out).toContain('data-receipt-done');
    expect(out, 'closing has no Undo (V620)').not.toContain('Undo');
  });

  it('keeps a month that had no row as dashes, never a 0', () => {
    const out = html({ ...closed, figures: null, units: null });
    for (const key of ['rows', 'revenue', 'cost', 'profit']) expect(fact(out, key), key).toBe('—');
  });

  it('leaves the closer out when the page was not told, and reads in Arabic', () => {
    expect(html({ ...closed, by: undefined })).not.toContain('data-receipt="by"');
    const out = html({ ...closed, monthLabel: 'أكتوبر 2026' }, 'ar');
    expect(out).toContain('أُغلق أكتوبر 2026');
    expect(out).toContain('أُغلق بواسطة');
    expect(fact(out, 'revenue'), 'Latin numerals in Arabic').toBe('59,050 ريال');
  });
});
