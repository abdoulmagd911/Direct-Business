/**
 * V643 (4): a time is written 24-hour (09:00, 21:30) from one shared function and one time box, in English and Arabic —
 * never AM/PM in one place and 24-hour in another.
 * Sabotages: tests/sabotage/screens.mjs "arabic-times-print-12-hour", "time-box-follows-the-device".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { formatDate } from '../../../src/core/i18n/format';
import { Input } from '../../../src/ui/Input';

describe('a time is written 24-hour', () => {
  it('writes an Arabic time 24-hour, with Latin digits and no ص or م', () => {
    const at = '2026-10-19T18:30:00Z'; // 21:30 Riyadh
    expect(formatDate(at, 'ar', { dateStyle: 'medium', timeStyle: 'short' })).toMatch(/21:30/);
    expect(formatDate(at, 'ar', { dateStyle: 'medium', timeStyle: 'short' })).not.toMatch(/[صم]/);
    expect(formatDate(at, 'en', { dateStyle: 'medium', timeStyle: 'short' })).toMatch(/21:30/);
  });
  it('writes a morning hour with its leading zero in both languages', () => {
    const at = '2026-10-19T06:00:00Z'; // 09:00 Riyadh
    expect(formatDate(at, 'ar', { timeStyle: 'short' })).toBe('09:00');
    expect(formatDate(at, 'en', { timeStyle: 'short' })).toBe('09:00');
  });
  it('a time box writes the time 24-hour, whatever the device says', () => {
    for (const [locale, messages] of [
      ['en', en],
      ['ar', ar],
    ] as const) {
      const out = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Input type="time" value="21:30" onChange={() => undefined} />
        </NextIntlClientProvider>,
      );
      expect(out).toMatch(/data-date-text[^>]*>21:30</);
    }
  });
});
