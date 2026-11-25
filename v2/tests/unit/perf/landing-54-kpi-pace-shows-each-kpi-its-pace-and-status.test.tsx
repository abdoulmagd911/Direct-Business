/**
 * Landing 54 — Reports → KPI pace (the design session's Batch 3, boards 5–8), on the screen.
 * Each KPI shows its name, who is Responsible ("Not set" when nobody is), its monthly target, its actual to date,
 * its pace with a bar filled to the pace (never past the whole bar) in its status's colour, its status in words,
 * and its initiatives with their count and "View them"; the three counts stand above the list; the year selector
 * offers the three years; the pencil shows only to a person who may edit targets; a month with no KPI says so; and
 * the page reads in Arabic with the design's words. The pace and the status are the database's (PCE-01…03): the
 * screen draws what it was given. Every name and figure is made up.
 * Sabotage: tests/sabotage/landing-54-kpi-pace.mjs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { barFill, curveOf, inYear, shiftMonth, type PaceAnswer, type PaceRow } from '../../../src/modules/perf/pace';
import { inWords, parts } from '../finance/landing-32-fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { KpiPace } = await import('../../../src/modules/perf/screens/KpiPace');

const person = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  full_name_en: `Test Person ${n}`,
  full_name_ar: `شخص تجريبي ${n}`,
  nickname_en: null,
  display_name_en: null,
  display_name_ar: null,
});
const kpi = (n: number, over: Partial<PaceRow> = {}): PaceRow => ({
  id: `t${n}:count`,
  target_id: `t${n}`,
  plan_id: 'plan-made-up',
  category_id: `c${n}`,
  code: `MADE${n}`,
  name_en: `Made-up KPI ${n}`,
  name_ar: `مؤشر تجريبي ${n}`,
  measure: 'count',
  department_id: 'd1',
  department_en: 'Test Department',
  department_ar: 'قسم تجريبي',
  target: 22,
  actual: 18,
  pace: 95,
  status: 'on_track',
  responsible: person(1),
  daily: [],
  initiatives: [],
  ...over,
});
const days = Array.from({ length: 30 }, (_, i) => {
  const dow = i % 7; // 1 Nov 2026 is a Sunday
  const working = dow < 5;
  const before = Array.from({ length: i + 1 }, (_, j) => j % 7 < 5).filter(Boolean).length;
  return {
    day: `2026-11-${String(i + 1).padStart(2, '0')}`,
    working,
    share: Math.round((before / 22) * 10000) / 10000,
  };
});
const answer = (rows: PaceRow[], over: Partial<PaceAnswer> = {}): PaceAnswer => ({
  month: '2026-11-01',
  today: '2026-11-25',
  working_days: 22,
  days_passed: 19,
  share: 0.8636,
  bands: { on_track: 90, at_risk: 70 },
  years: [2024, 2025, 2026],
  can_edit: false,
  can_see_projects: true,
  days,
  counts: {
    on_track: rows.filter((r) => r.status === 'on_track').length,
    at_risk: rows.filter((r) => r.status === 'at_risk').length,
    behind: rows.filter((r) => r.status === 'behind').length,
  },
  rows,
  ...over,
});
const FIVE = [
  kpi(1, { measure: 'value', id: 't1:value', target: 2400000, actual: 1950000, pace: 94, status: 'on_track' }),
  kpi(2, { target: 1200, actual: 790, pace: 76, status: 'at_risk', responsible: person(2) }),
  kpi(3, { target: 20, actual: 9, pace: 52, status: 'behind', responsible: null }),
  kpi(4, {
    target: 4500,
    actual: 3780,
    pace: 97,
    status: 'on_track',
    initiatives: [
      { id: 'p1', name: 'Made-up project one', count: 3 },
      { id: 'p2', name: 'Made-up project two', count: 1 },
    ],
  }),
  kpi(5, { target: 10, actual: 12, pace: 139, status: 'on_track' }),
  kpi(6, { target: 92, actual: 69, pace: 87, status: 'at_risk' }),
];
const html = (a: PaceAnswer | null, locale: 'en' | 'ar' = 'en', month = '2026-11') =>
  renderToStaticMarkup(inWords(<KpiPace answer={a} month={month} />, locale));
const cards = (out: string) => parts(out, 'data-pace-kpi');
const card = (out: string, code: string) => cards(out).find((c) => c.includes(`data-pace-kpi="${code}"`)) ?? '';
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('each KPI on the page', () => {
  const out = html(answer(FIVE));
  it('shows its name, Responsible, monthly target, actual to date, pace and status', () => {
    const c = text(card(out, 'MADE2'));
    expect(c).toContain('Made-up KPI 2');
    expect(c).toContain('Responsible Test Person 2');
    expect(c).toContain('Monthly target 1,200');
    expect(c).toContain('Actual to date 790');
    expect(c).toContain('76%');
    expect(c).toContain('At risk');
  });
  it('a KPI by deal value says so and shows its figures as money', () => {
    const c = text(card(out, 'MADE1'));
    expect(c).toContain('Made-up KPI 1 — deal value (SAR)');
    expect(c).toContain('Monthly target 2,400,000');
    expect(c).toContain('Actual to date 1,950,000');
  });
  it('a KPI with nobody Responsible says Not set', () => {
    expect(text(card(out, 'MADE3'))).toContain('Responsible Not set');
  });
  it('the status is in words, in its own colour: On track green, At risk amber, Behind red', () => {
    expect(card(out, 'MADE4')).toMatch(
      /bg-success-soft text-success[^>]*>\s*<span data-pace-status="on_track">On track</,
    );
    expect(card(out, 'MADE2')).toMatch(
      /bg-warning-soft text-warning[^>]*>\s*<span data-pace-status="at_risk">At risk</,
    );
    expect(card(out, 'MADE3')).toMatch(/bg-danger-soft text-danger[^>]*>\s*<span data-pace-status="behind">Behind</);
  });
  it('the bar is filled to the pace, in the status colour, and never past the whole bar', () => {
    expect(card(out, 'MADE2')).toMatch(/class="h-full rounded-pill bg-warning" style="inline-size:76%"/);
    expect(card(out, 'MADE3')).toMatch(/class="h-full rounded-pill bg-danger" style="inline-size:52%"/);
    expect(card(out, 'MADE5')).toMatch(/class="h-full rounded-pill bg-success" style="inline-size:100%"/);
    expect(text(card(out, 'MADE5'))).toContain('139%');
  });
  it('the initiatives line gives their count, each with how many, and View them', () => {
    const c = card(out, 'MADE4');
    expect(c).toMatch(/data-pace-initiative-count="true">2</);
    expect(text(c)).toContain('Made-up project one (3)');
    expect(text(c)).toContain('Made-up project two (1)');
    expect(c).toMatch(/<a[^>]*href="\/projects"[^>]*>View them<\/a>/);
  });
  it('a KPI with no initiative says none is linked, with nothing to view', () => {
    const c = card(out, 'MADE2');
    expect(text(c)).toContain('Initiatives None linked yet');
    expect(c).not.toContain('View them');
  });
  it('View them is only for a person who may open Projects', () => {
    expect(card(html(answer(FIVE, { can_see_projects: false })), 'MADE4')).not.toContain('View them');
  });
});

describe('above the list', () => {
  const out = html(answer(FIVE));
  it('the three counts: On track, At risk, Behind', () => {
    expect(out).toMatch(/On track <span[^>]*data-pace-count="on_track">3</);
    expect(out).toMatch(/At risk <span[^>]*data-pace-count="at_risk">2</);
    expect(out).toMatch(/Behind <span[^>]*data-pace-count="behind">1</);
  });
  it('the title, the month under it and the way back to Reports', () => {
    expect(out).toMatch(/<h1[^>]*>KPI pace<\/h1>/);
    expect(out).toMatch(/<span data-pace-month="true">November 2026<\/span>/);
    expect(out).toMatch(/<a[^>]*href="\/reports"[^>]*>Reports<\/a>/);
  });
  it('the year selector offers the three years, the shown one marked, each keeping the month', () => {
    const years = parts(out, 'data-pace-years')[0] ?? '';
    expect(text(years)).toContain('Year 2024 2025 2026');
    expect(years).toMatch(/<a[^>]*aria-current="true"[^>]*href="\/reports\/kpi-pace\?month=2026-11"/);
    expect(years).toMatch(/href="\/reports\/kpi-pace\?month=2024-11"/);
    expect(years).not.toMatch(/aria-current="true"[^>]*href="\/reports\/kpi-pace\?month=2025-11"/);
  });
  it('the curve is of the first KPI, with its target and actual lines and today marked', () => {
    const chart = parts(out, 'data-pace-chart')[0] ?? '';
    expect(chart).toContain('data-pace-chart="t1:value"');
    expect(chart).toContain('data-pace-line="target"');
    expect(chart).toContain('data-pace-line="actual"');
    expect(text(chart)).toContain('Today · 25 Nov 2026');
    expect(text(chart)).toContain('19 of 22 working days passed · 86% of the target due');
  });
});

describe('the pencil marks where editing starts', () => {
  it('only for a person who may edit targets, and it leads to the plan in Settings → Targets', () => {
    expect(html(answer(FIVE))).not.toContain('data-pace-edit');
    const out = html(answer(FIVE, { can_edit: true }));
    const pencil = /<a[^>]*data-pace-edit[^>]*>/.exec(card(out, 'MADE2'))?.[0] ?? '';
    expect(pencil).toContain('href="/settings/performance/plan-made-up"');
    expect(pencil).toContain('aria-label="Edit Made-up KPI 2"');
  });
});

describe('a month with nothing, and a read that failed', () => {
  it('no KPI: the page says so, draws no list, and offers Set targets only to who may edit them', () => {
    const out = html(answer([]));
    expect(out).toContain('No KPI has a target for this month yet');
    expect(out).not.toContain('data-pace-kpi');
    expect(out).not.toContain('data-pace-counts');
    expect(out).not.toContain('Set targets');
    expect(html(answer([], { can_edit: true }))).toMatch(/<a[^>]*href="\/settings\/performance"[^>]*>Set targets<\/a>/);
  });
  it('a failed read says it failed and never draws a zero', () => {
    const out = html(null);
    expect(out).toContain('data-state="failed"');
    expect(out).not.toContain('data-pace-kpi');
  });
});

describe('in Arabic', () => {
  const out = html(answer(FIVE), 'ar');
  it('the design’s words', () => {
    expect(out).toMatch(/<h1[^>]*>وتيرة مؤشرات الأداء<\/h1>/);
    const c = text(card(out, 'MADE2'));
    expect(c).toContain('مؤشر تجريبي 2');
    expect(c).toContain('المسؤول شخص تجريبي 2');
    expect(c).toContain('الهدف الشهري 1,200');
    expect(c).toContain('المحقق حتى الآن 790');
    expect(text(out)).toContain('السنة 2024 2025 2026');
    expect(text(out)).toContain('اليوم ·');
    expect(card(out, 'MADE4')).toMatch(/>عرضها<\/a>/);
  });
  it('the drawing is mirrored and the arrows turn', () => {
    expect(out).toMatch(/<svg[^>]*class="[^"]*rtl:-scale-x-100/);
    expect(out).toMatch(/lucide-chevron-left[^"]*rtl:rotate-180|rtl:rotate-180[^"]*lucide-chevron-left/);
  });
});

describe('placing what was read', () => {
  it('the bar: the pace, held between empty and full', () => {
    expect(barFill(76)).toBe(76);
    expect(barFill(139)).toBe(100);
    expect(barFill(-5)).toBe(0);
    expect(barFill(null)).toBe(0);
  });
  it('months: one back from January is last December; the same month in another year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
    expect(inYear('2026-11', 2024)).toBe('2024-11');
  });
  it('the curve: the target follows each day’s share; the actual runs to today and stops', () => {
    const row = kpi(1, {
      target: 22,
      daily: [
        { day: '2026-11-10', value: 4 },
        { day: '2026-11-20', value: 7 },
      ],
    });
    const c = curveOf(row, answer([row]));
    expect(c.max).toBe(22);
    expect(c.target).toHaveLength(30);
    expect(c.target[29]!.y).toBeCloseTo(1, 3);
    expect(c.target[24]!.y).toBeCloseTo(19 / 22, 3);
    expect(c.target[5]!.y).toBeCloseTo(c.target[6]!.y, 6); // a Friday and a Saturday add nothing
    expect(c.actual).toHaveLength(25);
    expect(c.actual[8]!.y).toBe(0);
    expect(c.actual[9]!.y).toBeCloseTo(4 / 22, 6);
    expect(c.actual[24]!.y).toBeCloseTo(11 / 22, 6);
    expect(c.today).toBeCloseTo(24 / 29, 6);
  });
  it('a finished month runs to its end with no today; a month not begun has no actual line', () => {
    const row = kpi(1, { daily: [{ day: '2026-11-10', value: 4 }] });
    const past = curveOf(row, { days, today: '2026-12-03' });
    expect(past.actual).toHaveLength(30);
    expect(past.today).toBeNull();
    const ahead = curveOf(row, { days, today: '2026-10-20' });
    expect(ahead.actual).toHaveLength(0);
    expect(ahead.today).toBeNull();
  });
});
