/**
 * Settings → Targets: a plan still named the way it was opened ("Department Year", in English) reads in the page's
 * language — the Arabic department name on the Arabic page — while a plan someone renamed keeps its name; and a greyed
 * button says why. Made-up values. Sabotages: tests/sabotage/targets.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { freeYearsOf, startingChoice, TargetsScreen } from '../../../src/modules/perf/screens/TargetsScreen';

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
const plans = [
  { id: 'p1', department_id: 'd1', year: 2026, name: 'Made-up sales 2026', categories: 7 },
  { id: 'p2', department_id: 'd1', year: 2025, name: 'Our own name', categories: 3 },
];
const draw = (locale: 'en' | 'ar', departments = [dept]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={(locale === 'en' ? en : ar) as never} timeZone="Asia/Riyadh">
      <TargetsScreen plans={plans} departments={departments} year={2026} />
    </NextIntlClientProvider>,
  );

describe('Targets', () => {
  it('reads an unrenamed plan in the page language, and keeps a renamed plan as it is', () => {
    const html = draw('ar');
    expect(html).toContain('مبيعات تجريبية 2026');
    expect(html).not.toContain('Made-up sales 2026');
    expect(html).toContain('Our own name');
    expect(draw('en')).toContain('Made-up sales 2026');
  });
  it('says why Open is grey when there is no department to open a plan for', () => {
    const html = draw('en', []);
    expect(html).toMatch(/data-plan-open-why[^>]*>Add a department first\./);
    expect(draw('ar', [])).toMatch(/data-plan-open-why[^>]*>أضف إدارة أولًا\./);
  });
});

const full = ['2025', '2026', '2027'].map((y, i) => ({
  id: `f${i}`,
  department_id: 'd1',
  year: Number(y),
  name: `Plan ${y}`,
  categories: 1,
}));
const buttonOf = (html: string) => /<button[^>]*data-plan-open[^>]*>/.exec(html)![0];

describe('when every department has a plan for every year', () => {
  it('greys Open a plan and says why, in both languages', () => {
    const draw2 = (locale: 'en' | 'ar') =>
      renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={(locale === 'en' ? en : ar) as never} timeZone="Asia/Riyadh">
          <TargetsScreen plans={full} departments={[dept]} year={2026} />
        </NextIntlClientProvider>,
      );
    expect(buttonOf(draw2('en'))).toContain(' disabled=""');
    expect(draw2('en')).toMatch(/data-plan-open-why[^>]*>Every department already has a plan for every year\./);
    expect(draw2('ar')).toMatch(/data-plan-open-why[^>]*>لكل إدارة خطة لكل سنة بالفعل\./);
  });
  it('leaves Open a plan clickable while a year is free', () => {
    expect(buttonOf(draw('en'))).not.toContain(' disabled=""');
  });
});

describe('the plan dialog starts on a year that can be opened', () => {
  it('offers the years a department has no plan for, newest first, from next year down to 2025', () => {
    expect(freeYearsOf(plans, 'd1', 2026)).toEqual([2027]);
    expect(freeYearsOf(full, 'd1', 2026)).toEqual([]);
  });
  it('starts on this year when it is free, else the newest free year, and on no year when none is free', () => {
    expect(startingChoice([], [dept], 2026)).toEqual({ dept: 'd1', year: '2026' });
    expect(startingChoice(plans, [dept], 2026)).toEqual({ dept: 'd1', year: '2027' });
    expect(startingChoice(full, [dept], 2026), 'starts with no year, never a taken one').toEqual({
      dept: 'd1',
      year: '',
    });
  });
});

describe('a refusal of opening a plan is said in words, never as a code or an id', () => {
  const words = (c: typeof en) => c.errors.plan;
  it('words both refusals of plan_open in English and in Arabic', () => {
    for (const c of [en, ar] as (typeof en)[]) {
      expect(words(c).year_taken).toBeTruthy();
      expect(words(c).year_invalid).toBeTruthy();
      expect(Object.values(words(c)).join(' '), 'no placeholder that would print a raw id').not.toContain('{');
    }
  });
  it('words the generic refusals in Arabic too, so no raw key is ever shown', () => {
    for (const k of ['PermissionDenied', 'Conflict', 'RuleBroken', 'NotFound', 'Unavailable'])
      expect((ar as unknown as typeof en).errors.kind[k as keyof typeof en.errors.kind], k).toBeTruthy();
  });
});
