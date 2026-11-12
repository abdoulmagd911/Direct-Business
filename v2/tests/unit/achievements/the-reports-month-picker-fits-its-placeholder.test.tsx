/**
 * F-B1-09 (ReportSummary leg): /reports' Month picker is wide enough for its placeholder ("For example, Oct 2026").
 * Before, it was w-44 and the placeholder was cut to "For example, C…". Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ReportSummary } from '../../../src/modules/perf/screens/ReportSummary';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const draw = () =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ReportSummary page={null} month={undefined} people={{}} partners={{}} />
    </NextIntlClientProvider>,
  );

describe('the reports Month picker (F-B1-09)', () => {
  it('is wide enough for its placeholder instead of w-44', () => {
    const html = draw();
    expect(html).toContain('data-month-picker');
    expect(html).toContain('max-w-96');
    expect(html).not.toMatch(/data-month-picker"[^>]*\bw-44\b/);
  });
});
