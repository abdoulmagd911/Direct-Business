import { describe, expect, it } from 'vitest';
import { clip, formatDate, formatMoney, formatNumber } from '@/core/i18n/format';

describe('formats: Riyadh time, Gregorian, Latin digits in both languages (V40)', () => {
  const d = new Date('2026-09-28T22:30:00Z'); // 01:30 on 29 Sep in Riyadh

  it('dates are Riyadh dates', () => {
    expect(formatDate(d, 'en')).toBe('29 Sep 2026');
  });

  // W-daily 13: one format everywhere — `14 Oct 2026`, a three-letter month, never "Sept"
  it('every month is three letters, whichever way the date is asked for', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((m, i) => {
      const day = new Date(Date.UTC(2026, i, 14, 9));
      const want = `14 ${m} 2026`;
      expect(formatDate(day, 'en'), m).toBe(want);
      expect(formatDate(day, 'en', { dateStyle: 'medium' }), m).toBe(want);
      expect(formatDate(day, 'en', { dateStyle: 'long' }), m).toBe(want);
      expect(formatDate(day, 'en', { day: 'numeric', month: 'long' }), m).toBe(want);
      expect(formatDate(day, 'en', { day: 'numeric', month: 'short' }), m).toBe(want);
    });
  });

  it('a date with a time, and a weekday, keep the same date', () => {
    const day = new Date('2026-10-14T06:30:00Z');
    expect(formatDate(day, 'en', { dateStyle: 'medium', timeStyle: 'short' })).toBe('14 Oct 2026, 09:30');
    expect(formatDate(day, 'en', { weekday: 'long', day: 'numeric', month: 'long' })).toBe('Wednesday, 14 Oct 2026');
  });

  it('a month on its own is a label and stays as asked', () => {
    const day = new Date('2026-09-14T09:00:00Z');
    expect(formatDate(day, 'en', { day: undefined, month: 'long', year: 'numeric' })).toBe('September 2026');
  });

  it('Arabic writes the same date with its own short month, Latin digits', () => {
    const ar = formatDate(new Date('2026-10-14T09:00:00Z'), 'ar', { dateStyle: 'medium' });
    expect(ar).toMatch(/^14 \S+ 2026$/);
    expect(ar).not.toMatch(/\//);
  });

  it('Arabic dates stay Gregorian with Latin digits (ar-SA would default to Hijri)', () => {
    const ar = formatDate(d, 'ar');
    expect(ar).toMatch(/2026/);
    expect(ar).toMatch(/29/);
    expect(ar).not.toMatch(/[٠-٩]/);
    expect(ar).not.toMatch(/14[0-9]{2}/);
  });

  it('money and numbers use Latin digits and grouping, no currency inside the figure', () => {
    expect(formatMoney(1234567.891)).toBe('1,234,568');
    expect(formatMoney(1234.5, 'ar', 2)).not.toMatch(/[٠-٩]/);
    expect(formatNumber(80.25, 'en', { maximumFractionDigits: 1 })).toBe('80.3');
  });
});

describe('clip: a title in a toast is whole when it fits, else cut with an ellipsis', () => {
  it('keeps a short title, tidying its spaces', () => {
    expect(clip('  Call   the hotel ')).toBe('Call the hotel');
  });
  it('cuts a long title at the limit with an ellipsis', () => {
    const long = 'Made-up task title that goes on far longer than any toast should ever show';
    const cut = clip(long, 30);
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut.endsWith('…')).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
  });
});
