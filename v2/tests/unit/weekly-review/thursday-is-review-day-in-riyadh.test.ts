import { describe, expect, it } from 'vitest';
import { isReviewDay, weekStartOf } from '@/modules/weekly-review/logic';

describe('the week door (QA-557)', () => {
  it('marks Thursday — the Riyadh day the database names — as review day, and no other day', () => {
    expect(isReviewDay('2026-10-15')).toBe(true);
    expect(isReviewDay('2026-10-22')).toBe(true);
    for (const d of ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16', '2026-10-17'])
      expect(isReviewDay(d), d).toBe(false);
  });
  // FIX-29: the dismiss key is the Sunday the week starts on — every day of one week shares it.
  it('names the Sunday the week starts on, for any day of that week', () => {
    for (const d of ['2026-11-08', '2026-11-09', '2026-11-12', '2026-11-14'])
      expect(weekStartOf(d), d).toBe('2026-11-08');
    expect(weekStartOf('2026-11-15')).toBe('2026-11-15');
  });
});
