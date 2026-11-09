import { describe, expect, it } from 'vitest';
import { filterOf, hrefOf, sortAchievements } from '../../../src/modules/perf/types';
import type { AchievementRow } from '../../../src/modules/perf/types';

// FIX-01: the achievements list sorts — newest or oldest logged, title, or the achievement's own date — with the
// stable tie-break (added-at, then id), and the sort lives in the address. Every value is made up (rule 7).
const achievement = (over: Partial<AchievementRow>): AchievementRow => ({
  id: 'a1',
  number: 'ACH-2026-0001',
  repeat_of: null,
  repeat_of_number: null,
  mou_side: null,
  plan_id: 'p',
  year: 2026,
  department_id: 'd',
  category: 'CONTRACT',
  category_en: 'Contract',
  category_ar: 'عقد',
  parent_category: null,
  has_deal_value: false,
  title: 'Made-up achievement',
  count: 1,
  deal_value: null,
  value_report_kind: null,
  value_report_period: null,
  partner_id: null,
  owner_id: null,
  happened_on: null,
  logged_at: '2026-10-01T06:00:00Z',
  origin: 'person',
  source_kind: null,
  source_period: null,
  source_task_id: null,
  source_task_number: null,
  date_from_report: false,
  use_as_example: false,
  version: 1,
  line_en: 'Made-up achievement',
  line_ar: 'إنجاز مختلق',
  can_edit: true,
  participants: [],
  past_work: false,
  needs_owner: false,
  backfilled: false,
  draft: false,
  no_evidence: false,
  logged_late: false,
  moved: false,
  ...over,
});

const rows = [
  achievement({ id: 'a1', line_en: 'Beta', happened_on: '2026-09-20', logged_at: '2026-10-01T06:00:00Z' }),
  achievement({ id: 'a2', line_en: 'Alpha', happened_on: '2026-09-25', logged_at: '2026-10-02T06:00:00Z' }),
  achievement({ id: 'a3', line_en: 'Gamma', happened_on: null, logged_at: '2026-10-03T06:00:00Z' }),
  achievement({ id: 'a4', line_en: 'Alpha', happened_on: '2026-09-25', logged_at: '2026-10-02T06:00:00Z' }),
];

describe('the achievements list sorts (FIX-01)', () => {
  it('reads the sort from the address, and drops what is not one', () => {
    const f = filterOf({ sort: 'title' });
    expect(f.sort).toBe('title');
    expect(filterOf({ sort: 'random' }).sort).toBeUndefined();
    expect(hrefOf({ sort: 'date' })).toBe('/kpis/achievements?sort=date');
    const back = filterOf(Object.fromEntries(new URL(`http://x${hrefOf({ sort: 'date' })}`).searchParams));
    expect(back.sort).toBe('date');
  });

  it('newest is added-at, newest first; oldest is the reverse', () => {
    expect(sortAchievements(rows, 'newest', 'en').map((r) => r.id)).toEqual(['a3', 'a2', 'a4', 'a1']);
    expect(sortAchievements(rows, 'oldest', 'en').map((r) => r.id)).toEqual(['a1', 'a2', 'a4', 'a3']);
  });

  it('title breaks ties by added-at, then id; date puts the undated last', () => {
    expect(sortAchievements(rows, 'title', 'en').map((r) => r.id)).toEqual(['a2', 'a4', 'a1', 'a3']);
    expect(sortAchievements(rows, 'date', 'en').map((r) => r.id)).toEqual(['a2', 'a4', 'a1', 'a3']);
  });

  it('no sort keeps the server order', () => {
    expect(sortAchievements(rows, undefined, 'en').map((r) => r.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });
});
