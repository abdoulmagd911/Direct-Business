import { describe, expect, it } from 'vitest';
import { csvCell, groupBy } from '../../../src/modules/perf/screens/ReportSummary';
import type { AchievementRow } from '../../../src/modules/perf/types';

// Reports: the downloaded spreadsheet keeps a title that looks like a formula as text, and the summary counts two
// people with the same name as two lines. Every value is made up (rule 7).
const row = (over: Partial<AchievementRow>): AchievementRow =>
  ({
    id: 'a1',
    number: 'ACH-2026-0001',
    category: 'AWARD',
    category_en: 'Awards',
    category_ar: 'جوائز',
    owner_id: null,
    partner_id: null,
    deal_value: null,
    has_deal_value: false,
    ...over,
  }) as AchievementRow;

describe('a spreadsheet cell', () => {
  it('keeps text that starts like a formula as text', () => {
    for (const bad of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])
      expect(csvCell(bad), bad).toBe(`"'${bad.replaceAll('"', '""')}"`);
  });
  it('quotes plain text and doubles its quotes', () => {
    expect(csvCell('Made-up "deal"')).toBe('"Made-up ""deal"""');
    expect(csvCell('صفقة')).toBe('"صفقة"');
  });
  it('writes a number as the number, rounded to the halala, and nothing as empty', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(0.1 + 0.2)).toBe('0.3');
    expect(csvCell(null)).toBe('""');
  });
});

describe('the summary groups', () => {
  it('keeps two people with the same name apart, and sums deal values', () => {
    const rows = [
      row({ id: 'a', owner_id: 'p1', deal_value: 100 }),
      row({ id: 'b', owner_id: 'p2', deal_value: 50 }),
      row({ id: 'c', owner_id: 'p1' }),
    ];
    const groups = groupBy(rows, (r) => [r.owner_id ?? '', 'Made-up Same Name']);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ key: 'p1', count: 2, deal: 100 });
    expect(groups[1]).toMatchObject({ key: 'p2', count: 1, deal: 50 });
  });
});
