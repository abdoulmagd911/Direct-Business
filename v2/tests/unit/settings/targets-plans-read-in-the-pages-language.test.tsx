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
import { TargetsScreen } from '../../../src/modules/perf/screens/TargetsScreen';

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
