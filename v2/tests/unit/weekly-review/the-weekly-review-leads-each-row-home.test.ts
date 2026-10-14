import { describe, expect, it } from 'vitest';
import { itemRoute, moreThanShown, partnerName, weekIsEmpty } from '@/modules/weekly-review/logic';
import type { WeeklyReviewAnswer } from '@/modules/weekly-review/types';

const none = { total: 0, rows: [] };
const answer = (over: Partial<WeeklyReviewAnswer> = {}): WeeklyReviewAnswer => ({
  today: '2026-10-22',
  week: { from: '2026-10-18', to: '2026-10-24' },
  next_week: { from: '2026-10-25', to: '2026-10-31' },
  done: none,
  slipped: none,
  next: none,
  notes: none,
  ...over,
});

describe('the weekly review (V632 Stage 3)', () => {
  it('opens a task by its number and a note on its own page', () => {
    expect(itemRoute({ kind: 'task', id: 'a', number: 'T-0001' })).toBe('/tasks/T-0001');
    expect(itemRoute({ kind: 'note', id: 'n1', number: null })).toBe('/my-day/notes/n1');
  });

  it('names the client in the reader’s language, falling back to English', () => {
    const p = { partner_name_en: 'Made-up Travel', partner_name_ar: null };
    expect(partnerName(p, 'ar')).toBe('Made-up Travel');
    expect(partnerName({ ...p, partner_name_ar: 'سفر تجريبي' }, 'ar')).toBe('سفر تجريبي');
    expect(partnerName({ partner_name_en: null, partner_name_ar: null }, 'en')).toBeNull();
  });

  it('says an empty week once, and only when every list is empty', () => {
    expect(weekIsEmpty(answer())).toBe(true);
    expect(weekIsEmpty(answer({ notes: { total: 1, rows: [] } }))).toBe(false);
  });

  it('counts the rows beyond those drawn', () => {
    expect(moreThanShown({ total: 12, rows: [1, 2, 3, 4, 5, 6, 7] })).toBe(5);
    expect(moreThanShown({ total: 2, rows: [1, 2] })).toBe(0);
  });
});
