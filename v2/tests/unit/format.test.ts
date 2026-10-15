import { describe, expect, it } from 'vitest';
import { clip, formatDate, formatMoney, formatNumber } from '@/core/i18n/format';

describe('formats: Riyadh time, Gregorian, Latin digits in both languages (V40)', () => {
  const d = new Date('2026-09-28T22:30:00Z'); // 01:30 on 29 Sep in Riyadh

  it('dates are Riyadh dates', () => {
    expect(formatDate(d, 'en')).toBe('29 Sept 2026');
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
