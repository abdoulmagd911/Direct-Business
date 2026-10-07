/**
 * QA-514: the achievements list reads the door's first 200 while its header shows the full total; past them, a line
 * says how many it shows of how many, and that a filter narrows them — as Clients does (QA-506). Every value is made up.
 * Sabotage: tests/sabotage/achievements.mjs "capped-achievements-say-nothing".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { AchievementList } from '../../../src/modules/perf/screens/AchievementList';
import type { AchievementPage, AchievementRow } from '../../../src/modules/perf/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const row = (i: number): AchievementRow => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  number: `ACH-2026-${String(i).padStart(4, '0')}`,
  repeat_of: null,
  repeat_of_number: null,
  mou_side: null,
  plan_id: 'made-up-plan',
  year: 2026,
  department_id: 'made-up-department',
  category: 'AWARD',
  category_en: 'Awards',
  category_ar: 'جوائز',
  parent_category: null,
  has_deal_value: false,
  title: `Made-up award ${i}`,
  count: 1,
  deal_value: null,
  value_report_kind: null,
  value_report_period: null,
  partner_id: null,
  owner_id: null,
  happened_on: '2026-09-01',
  logged_at: '2026-09-01T09:00:00Z',
  origin: 'person',
  source_kind: null,
  source_period: null,
  date_from_report: false,
  use_as_example: false,
  version: 1,
  line_en: `Made-up award ${i}`,
  line_ar: `جائزة ${i}`,
  can_edit: false,
  participants: [],
  past_work: false,
  needs_owner: false,
  backfilled: false,
  draft: false,
  no_evidence: false,
  logged_late: false,
  moved: false,
});

const html = (shown: number, total: number) => {
  const page: AchievementPage = {
    rows: Array.from({ length: shown }, (_, i) => row(i + 1)),
    total,
    more: total > shown,
  };
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <AchievementList page={page} filter={{}} categories={[]} people={{}} canLog={false} />
    </NextIntlClientProvider>,
  );
};

describe('the achievements list past its cap', () => {
  it('says it shows 200 of 230, and that a filter narrows them', () => {
    const out = html(200, 230);
    expect(out, 'says it shows 200 of 230').toContain('Showing 200 of 230');
    expect(out).toContain('search or filter');
  });
  it('says nothing when every achievement is shown', () => {
    expect(html(3, 3)).not.toContain('Showing');
  });
});
