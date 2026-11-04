import { describe, expect, it } from 'vitest';
import { codeState, filterCodes, sortCodes } from '@/modules/codes/state';
import type { CodeRow } from '@/modules/codes/types';

const row = (over: Partial<CodeRow>): CodeRow => ({
  id: over.id ?? 'id',
  code: over.code ?? 'CODE',
  valid_from: over.valid_from ?? null,
  valid_to: over.valid_to ?? null,
  state: over.state ?? 'active',
  total_discount: over.total_discount ?? null,
  total_collected: over.total_collected ?? null,
  units: over.units ?? 0,
});

describe('discount code state (mirrors finance.code_state)', () => {
  it('is expired once its last day has passed', () => {
    expect(codeState(null, '2026-11-03', '2026-11-04')).toBe('expired');
  });

  it('is active on its last day', () => {
    expect(codeState(null, '2026-11-04', '2026-11-04')).toBe('active');
  });

  it('is inactive before its first day', () => {
    expect(codeState('2026-11-05', null, '2026-11-04')).toBe('inactive');
  });

  it('is active with open ends', () => {
    expect(codeState(null, null, '2026-11-04')).toBe('active');
  });
});

describe('discount codes list order and filter', () => {
  it('sorts by total discount first, highest first, codes with no counted use last', () => {
    const rows = [
      row({ id: 'a', code: 'B', total_discount: null }),
      row({ id: 'b', code: 'A', total_discount: 10 }),
      row({ id: 'c', code: 'C', total_discount: 200 }),
      row({ id: 'd', code: 'D', total_discount: 200 }),
    ];
    expect(sortCodes(rows).map((r) => r.id)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('keeps the same text under different ids as separate rows', () => {
    const rows = [
      row({ id: 'one', code: 'SAME', total_discount: 5 }),
      row({ id: 'two', code: 'SAME', total_discount: 9 }),
    ];
    expect(sortCodes(rows).map((r) => r.id)).toEqual(['two', 'one']);
  });

  it('filters by state and keeps the sort', () => {
    const rows = sortCodes([
      row({ id: 'a', code: 'A', state: 'active', total_discount: 5 }),
      row({ id: 'b', code: 'B', state: 'expired', total_discount: 50 }),
      row({ id: 'c', code: 'C', state: 'active', total_discount: 9 }),
    ]);
    expect(filterCodes(rows, 'active').map((r) => r.id)).toEqual(['c', 'a']);
    expect(filterCodes(rows, 'all').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
