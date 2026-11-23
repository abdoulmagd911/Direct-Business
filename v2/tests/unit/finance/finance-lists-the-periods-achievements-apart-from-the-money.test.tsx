/**
 * Landing 41 — the Finance page lists the achievements of the period, apart from the money (the owner, 22 Nov:
 * "achievements show on Finance as a separate, non-money list"). Each row is its number, title, category,
 * organisation, owner and day; the title opens the achievement's own record; no amount is ever drawn — not even one
 * the answer were to carry — and the card says it is not money. Empty, loading and failed each say so.
 * The database decides what is listed (FAC-01). Every value is made up.
 * Sabotages: tests/sabotage/landing-41.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import {
  FinanceAchievementsView,
  financeAchievementsOf,
} from '../../../src/modules/finance/screens/FinanceAchievements';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ANSWER = {
  from: '2026-09-01',
  to: '2026-09-30',
  total: 2,
  more: false,
  rows: [
    {
      id: '00000000-0000-4000-8000-0000000000a2',
      number: 'ACH-2026-0042',
      title: 'Made-up later fix',
      category_en: 'Problem solved',
      category_ar: 'حل مشكلة',
      happened_on: '2026-09-21',
      partner_id: '00000000-0000-4000-8000-0000000000b1',
      partner_en: 'Made Up Award Org',
      partner_ar: 'منظمة مختلقة',
      owner_en: 'Test Owner',
      owner_ar: 'مالك تجريبي',
      // an answer never carries an amount (FAC-01); were one to, the screen must still not draw it
      deal_value: 987654,
    },
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      number: 'ACH-2026-0041',
      title: 'Made-up earlier fix',
      category_en: 'Problem solved',
      category_ar: 'حل مشكلة',
      happened_on: '2026-09-14',
      partner_id: null,
      partner_en: null,
      partner_ar: null,
      owner_en: null,
      owner_ar: null,
    },
  ],
};

const draw = (el: ReactElement, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      {el}
    </NextIntlClientProvider>,
  );
const view = (data: unknown, extra: { loading?: boolean; failed?: boolean } = {}, locale: 'en' | 'ar' = 'en') =>
  draw(
    <FinanceAchievementsView
      data={financeAchievementsOf(data)}
      loading={extra.loading ?? false}
      failed={extra.failed ?? false}
      onRetry={() => {}}
    />,
    locale,
  );

describe('the answer as the list reads it', () => {
  it('keeps each row’s number, title, category, organisation, owner and day', () => {
    const a = financeAchievementsOf(ANSWER);
    expect(a?.rows.map((r) => r.number)).toEqual(['ACH-2026-0042', 'ACH-2026-0041']);
    expect(a?.rows[0]).toMatchObject({
      title: 'Made-up later fix',
      partner_en: 'Made Up Award Org',
      owner_en: 'Test Owner',
    });
    expect(a?.total).toBe(2);
  });
  it('keeps no amount, whatever the answer carries', () => {
    expect(Object.keys(financeAchievementsOf(ANSWER)?.rows[0] ?? {})).not.toContain('deal_value');
  });
  it('is not an answer when it has no rows: a failed read, never an empty list', () => {
    for (const bad of [null, 'x', [], { total: 0 }]) expect(financeAchievementsOf(bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('the card on Finance', () => {
  it('is titled for the period and says it is not money', () => {
    const html = view(ANSWER);
    expect(html).toContain('Achievements in this period');
    expect(html).toContain('Not money — counted in no total');
  });
  it('draws each achievement: number, title, category, organisation, owner and day, in the order answered', () => {
    const html = view(ANSWER);
    expect(html.indexOf('ACH-2026-0042')).toBeLessThan(html.indexOf('ACH-2026-0041'));
    for (const words of ['Made-up later fix', 'Problem solved', 'Made Up Award Org', 'Test Owner', '21 Sep 2026'])
      expect(html, words).toContain(words);
  });
  it('the title opens the achievement’s own record', () => {
    expect(view(ANSWER)).toContain('href="/kpis/achievements/00000000-0000-4000-8000-0000000000a2"');
  });
  it('draws no amount at all — no figure, no SAR', () => {
    const html = view(ANSWER);
    expect(html).not.toContain('987');
    expect(html).not.toMatch(/SAR|ر\.س/);
  });
  it('a row with no organisation or owner draws neither', () => {
    const html = view({ ...ANSWER, rows: [ANSWER.rows[1]] });
    expect(html).not.toContain('data-finance-achievement-partner');
    expect(html).not.toContain('data-finance-achievement-owner');
  });
  it('says when the list is cut at fifty', () => {
    expect(view({ ...ANSWER, total: 73, more: true })).toContain('Showing the newest 2 of 73');
  });
  it('an empty period says so', () => {
    const html = view({ rows: [], total: 0, more: false });
    expect(html).toContain('No achievements in this period.');
    expect(html).not.toContain('data-finance-achievement=');
  });
  it('loading and failed each say so, the failed one with Try again', () => {
    expect(view(null, { loading: true })).toContain('data-state="loading"');
    const failed = view(null, { failed: true });
    expect(failed).toContain('data-state="failed"');
    expect(failed).toContain('Try again');
  });
  it('reads in Arabic, with the Arabic names', () => {
    const html = view(ANSWER, {}, 'ar');
    for (const words of ['الإنجازات في هذه الفترة', 'ليست مالًا', 'منظمة مختلقة', 'مالك تجريبي', 'حل مشكلة'])
      expect(html, words).toContain(words);
  });
});
