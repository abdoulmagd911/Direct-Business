/**
 * FIX-02, drawn without a browser: the date box names its test attributes after its namespace — `data-date-*`
 * everywhere, `data-due-*` on the task form's Due (testId="due") — and the month box carries its own clear
 * (`data-clear-month`, "Clear month") and says the empty label back as a real text node while no month is set.
 * Made-up values.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { DatePicker } from '../../../src/ui/DatePicker';
import { MonthPicker, parseMonth } from '../../../src/ui/MonthPicker';

const draw = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('a date box names its attributes after its namespace', () => {
  it('says data-date-* by default, with the day read back', () => {
    const html = draw(<DatePicker value="2026-10-20" onChange={() => undefined} />);
    expect(html).toContain('data-date-picker');
    expect(html).toContain('data-date-chip="today"');
    expect(html).toContain('data-date-calendar');
    expect(html).toContain('data-date-clear');
    expect(html).toMatch(/data-date-result[^>]*>Tue, 20 Oct 2026</);
    expect(html).not.toContain('data-due-');
  });
  it('says data-due-* when testId is due, with the three due chips and no data-date-*', () => {
    const html = draw(<DatePicker value="2026-10-20" onChange={() => undefined} chips="due" testId="due" />);
    expect(html).toContain('data-due-picker');
    expect(html).toContain('data-due-chip="today"');
    expect(html).toContain('data-due-chip="tomorrow"');
    expect(html).toContain('data-due-chip="next_week"');
    expect(html).toContain('data-due-calendar');
    expect(html).toContain('data-due-clear');
    expect(html).toMatch(/data-due-result[^>]*>Tue, 20 Oct 2026</);
    expect(html).not.toContain('data-date-');
  });
  it('has no clear and no result while empty', () => {
    const html = draw(<DatePicker value={undefined} onChange={() => undefined} />);
    expect(html).not.toContain('data-date-clear');
    expect(html).not.toContain('data-date-result');
  });
});

describe('a month box clears only itself and says the empty label', () => {
  it('reads 2026-10, Oct 2026 and Arabic-Indic digits as the same month', () => {
    expect(parseMonth('2026-10')).toBe('2026-10');
    expect(parseMonth('Oct 2026')).toBe('2026-10');
    expect(parseMonth('٢٠٢٦-١٠')).toBe('2026-10');
    expect(parseMonth('2026-13')).toBeNull();
  });
  it('says Any month as a real line while empty, and no clear', () => {
    const html = draw(<MonthPicker value={undefined} onChange={() => undefined} emptyLabel="Any month" />);
    expect(html).toMatch(/data-month-result[^>]*>Any month</);
    expect(html).not.toContain('data-clear-month');
  });
  it('says nothing while empty when no empty label is given', () => {
    const html = draw(<MonthPicker value={undefined} onChange={() => undefined} />);
    expect(html).not.toContain('data-month-result');
  });
  it('says the month, never the empty label, once one is set — with a clear named Clear month', () => {
    const html = draw(<MonthPicker value="2026-10" onChange={() => undefined} emptyLabel="Any month" />);
    expect(html).toMatch(/data-month-result[^>]*>October 2026</);
    expect(html).not.toContain('>Any month<');
    expect(html).toContain('data-month-clear');
    expect(html).toContain('data-clear-month');
    expect(html).toContain('aria-label="Clear month"');
  });
});
