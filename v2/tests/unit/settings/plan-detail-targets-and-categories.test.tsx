/**
 * Settings → Performance → one plan: the targets screen lists the plan's targets — the month, the category, the count
 * and deal-value total expected, and what the month has achieved so far — and the plan's achievement categories with
 * their codes, names and parents; the month picker offers the plan year's twelve months, picked, never typed. Made-up
 * values. Sabotages: tests/sabotage/targets.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { monthOptionsOf, PlanDetailScreen } from '../../../src/modules/perf/screens/PlanDetailScreen';
import type { Category } from '../../../src/modules/perf/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const dept = {
  id: 'd1',
  code: 'x',
  name_en: 'Made-up sales',
  name_ar: 'مبيعات تجريبية',
  head_person_id: null,
  active: true,
  version: 1,
};
const plan = { id: 'p1', department_id: 'd1', year: 2026, name: 'Made-up sales 2026', status: 'active', categories: 2 };
const categories = [
  {
    id: 'c1',
    plan_id: 'p1',
    code: 'SIGNED',
    name_en: 'Signed',
    name_ar: 'تم التوقيع',
    parent_id: null,
    parent_code: null,
    is_money_link: false,
    has_deal_value: true,
    sets_prospect: false,
    required_ref_system: null,
    line_template_en: 'Signed: {title}',
    line_template_ar: 'تم التوقيع: {title}',
    sort: 10,
    active: true,
    version: 1,
  },
  {
    id: 'c2',
    plan_id: 'p1',
    code: 'VISIT',
    name_en: 'Visit',
    name_ar: 'زيارة',
    parent_id: 'c1',
    parent_code: 'SIGNED',
    is_money_link: false,
    has_deal_value: false,
    sets_prospect: false,
    required_ref_system: null,
    line_template_en: 'Visit: {title}',
    line_template_ar: 'زيارة: {title}',
    sort: 20,
    active: true,
    version: 1,
  },
];
const targets = [
  {
    id: 't1',
    plan_id: 'p1',
    category_id: 'c1',
    category_code: 'SIGNED',
    category_name_en: 'Signed',
    category_name_ar: 'تم التوقيع',
    month: '2026-09-01',
    target_count: 5,
    target_value: 12000,
    achieved_count: 3,
    achieved_value: 7500,
    version: 1,
  },
];
const draw = (locale: 'en' | 'ar') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={(locale === 'en' ? en : ar) as never} timeZone="Asia/Riyadh">
      <PlanDetailScreen plan={plan} departments={[dept]} categories={categories} targets={targets} refSystems={[]} />
    </NextIntlClientProvider>,
  );

describe('Plan targets', () => {
  it('lists a target with its month, category, expected count and value, and what it achieved', () => {
    const html = draw('en');
    expect(html).toContain('data-plan-targets');
    expect(html).toContain('September 2026');
    expect(html).toContain('Signed');
    expect(html).toContain('12,000.00');
    expect(html).toContain('7,500.00');
    expect(html).toContain('Back to plans');
  });
  it('lists the plan categories with their codes and parents', () => {
    const html = draw('en');
    expect(html).toContain('data-plan-categories');
    expect(html).toContain('SIGNED');
    expect(html).toContain('VISIT');
    expect(html).toContain('Top level');
  });
  it('offers the plan year\u2019s twelve months, picked, never typed', () => {
    const months = monthOptionsOf(2026, 'en');
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ value: '2026-01-01', label: 'January 2026' });
    expect(months[11]).toEqual({ value: '2026-12-01', label: 'December 2026' });
    expect(monthOptionsOf(2026, 'ar')[0]).toEqual({ value: '2026-01-01', label: 'يناير 2026' });
  });
  it('counts active categories only in the header, and offers Delete on every target (F-B5-12)', () => {
    // an archived category sits in the list (shown only with "Show archived") but the header counts the live ones
    const archived: Category = {
      id: 'c3',
      plan_id: 'p1',
      code: 'TESTCAT',
      name_en: 'Test category',
      name_ar: 'فئة تجريبية',
      parent_id: null,
      parent_code: null,
      is_money_link: false,
      has_deal_value: false,
      sets_prospect: false,
      required_ref_system: null,
      line_template_en: 'Test category: {title}',
      line_template_ar: 'فئة تجريبية: {title}',
      sort: 30,
      active: false,
      version: 1,
    };
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en as never} timeZone="Asia/Riyadh">
        <PlanDetailScreen
          plan={plan}
          departments={[dept]}
          categories={[...categories, archived]}
          targets={targets}
          refSystems={[]}
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Categories: 2');
    expect(html).not.toContain('Categories: 3');
    expect(html).toContain('data-target-delete="t1"');
    expect(html).toContain('Delete target');
  });
});
