'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatNumber } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { useFinanceRead } from '../use-reads';
import { FinanceCard } from './parts';

type Locale = 'en' | 'ar';

/** One achievement of the period, as api.finance_achievements answers it: never an amount. */
export type FinanceAchievement = {
  id: string;
  number: string;
  title: string;
  category_en: string;
  category_ar: string;
  happened_on: string;
  partner_id: string | null;
  partner_en: string | null;
  partner_ar: string | null;
  owner_en: string | null;
  owner_ar: string | null;
};
export type FinanceAchievementsAnswer = { rows: FinanceAchievement[]; total: number; more: boolean };

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * api.finance_achievements as the list draws it. Only the fields named here are kept, so nothing else the answer
 * might carry — an amount above all — can reach the screen. Anything that is not such an answer is null (a failed read).
 */
export function financeAchievementsOf(answer: unknown): FinanceAchievementsAnswer | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const a = answer as Record<string, unknown>;
  if (!Array.isArray(a.rows)) return null;
  const rows = (a.rows as Record<string, unknown>[])
    .filter((r) => text(r?.id) && text(r?.number) && text(r?.title) && text(r?.happened_on))
    .map((r) => ({
      id: r.id as string,
      number: r.number as string,
      title: r.title as string,
      category_en: text(r.category_en) ?? '',
      category_ar: text(r.category_ar) ?? '',
      happened_on: r.happened_on as string,
      partner_id: text(r.partner_id),
      partner_en: text(r.partner_en),
      partner_ar: text(r.partner_ar),
      owner_en: text(r.owner_en),
      owner_ar: text(r.owner_ar),
    }));
  const total = typeof a.total === 'number' && Number.isFinite(a.total) ? a.total : rows.length;
  return { rows, total, more: a.more === true };
}

/**
 * The achievements of the period on screen (Landing 41 — the owner, 22 Nov: "achievements show on Finance as a
 * separate, non-money list"): one read, in the page's read queue, as a card of its own under "Is it counted?".
 */
export function FinanceAchievements({ from, to, ready }: { from: string; to: string; ready: boolean }) {
  const read = useFinanceRead<unknown, 'finance_achievements'>(
    'finance_achievements',
    { p_from: from, p_to: to },
    `achievements|${from}|${to}`,
    ready,
  );
  const data = read.block.status === 'ready' ? financeAchievementsOf(read.block.data) : null;
  return (
    <FinanceAchievementsView
      data={data}
      loading={read.block.status === 'loading'}
      // an answer that is not the list's shape is a failed read, said so — never an empty list
      failed={read.block.status === 'failed' || (read.block.status === 'ready' && data === null)}
      onRetry={read.retry}
    />
  );
}

/**
 * The list itself: newest first — the number, the title (it opens the achievement's own record), the category, the
 * organisation, who owns it and the day. It is not money: no amount is drawn, ever, and the card says so — an
 * achievement's value is not revenue (FIX-06 / D29), and a figure here would be read as the period's money.
 * Loading, failed and empty each have their own state, like the page's other cards.
 */
export function FinanceAchievementsView({
  data,
  loading,
  failed,
  onRetry,
}: {
  data: FinanceAchievementsAnswer | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pick = (en: string | null, ar: string | null) => (locale === 'ar' && ar ? ar : en);
  const card = (children: React.ReactNode) => (
    <FinanceCard
      id="finance-achievements"
      title={t('finance.achievements.title')}
      source={t('finance.achievements.notMoney')}
      data-finance-achievements
    >
      {children}
    </FinanceCard>
  );
  if (loading || failed || !data)
    return card(
      <div className="px-4 pb-4 sm:px-5">
        <DataState
          kind={loading ? 'loading' : 'failed'}
          message={t(loading ? 'state.loading' : 'state.failed', { what: t('finance.achievements.failed') })}
          onRetry={loading ? undefined : onRetry}
          retryLabel={loading ? undefined : t('common.tryAgain')}
        />
      </div>,
    );
  if (data.rows.length === 0)
    return card(
      <p className="px-4 pb-4 text-base text-muted sm:px-5" data-finance-achievements-empty>
        {t('finance.achievements.empty')}
      </p>,
    );
  return card(
    <div className="px-4 pb-4 sm:px-5">
      <ul className="divide-y divide-border text-sm">
        {data.rows.map((a) => {
          const partner = pick(a.partner_en, a.partner_ar);
          const owner = pick(a.owner_en, a.owner_ar);
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
              data-finance-achievement={a.number}
            >
              <span className="font-data text-xs text-muted">{a.number}</span>
              <Link
                href={`/kpis/achievements/${a.id}`}
                className="inline-flex min-h-11 min-w-0 items-center font-medium text-link hover:underline sm:min-h-0"
              >
                <bdi className="truncate">{a.title}</bdi>
              </Link>
              <StatusChip tone="neutral">{pick(a.category_en, a.category_ar)}</StatusChip>
              {partner ? (
                <bdi className="min-w-0 truncate text-sm text-text" data-finance-achievement-partner>
                  {partner}
                </bdi>
              ) : null}
              {owner ? (
                <bdi className="text-xs text-muted" data-finance-achievement-owner>
                  {owner}
                </bdi>
              ) : null}
              <span className="font-data text-xs text-muted" data-finance-achievement-day>
                {formatDate(a.happened_on, locale, { dateStyle: 'medium' })}
              </span>
            </li>
          );
        })}
      </ul>
      {data.more ? (
        <p className="mt-2 text-xs text-muted" data-finance-achievements-more>
          {t('finance.achievements.more', {
            shown: formatNumber(data.rows.length, locale),
            total: formatNumber(data.total, locale),
          })}
        </p>
      ) : null}
    </div>,
  );
}
