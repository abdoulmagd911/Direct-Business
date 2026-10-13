'use client';
import { ChevronRight, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { itemRoute, moreThanShown, partnerName, weekIsEmpty } from '../logic';
import {
  SECTIONS,
  type ReviewItem,
  type ReviewList,
  type ReviewNote,
  type Section,
  type WeeklyReviewAnswer,
} from '../types';

/**
 * The Thursday weekly review (V632 Stage 3): one screen, my own week — Done, Slipped (with how often each was carried),
 * Next week, and a short list of my notes this week. Phone first: one column, whole rows to tap, no second action.
 * A failed read says so with Try again; a week with nothing in it says that once.
 */
export function WeeklyReview({ answer }: { answer: WeeklyReviewAnswer | null }) {
  const t = useTranslations();
  const router = useRouter();
  if (!answer)
    return (
      <DataState
        kind="failed"
        what={t('pages.weeklyReview.title')}
        message={t('state.failed', { what: t('pages.weeklyReview.title') })}
        onRetry={() => router.refresh()}
        retryLabel={t('common.tryAgain')}
      />
    );
  if (weekIsEmpty(answer)) return <DataState kind="empty" message={t('pages.weeklyReview.emptyWeek')} />;
  return (
    <div className="flex flex-col gap-4" data-weekly-review>
      {SECTIONS.map((s) => (
        <ItemSection key={s} section={s} list={answer[s]} />
      ))}
      <NotesSection list={answer.notes} />
    </div>
  );
}

function SectionFrame({
  name,
  title,
  total,
  children,
}: {
  name: string;
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-raised px-4 py-2" data-review-section={name}>
      <h2 className="flex items-baseline gap-2 border-b border-border py-2.5 text-base font-semibold">
        <span>{title}</span>
        <span className="font-data text-sm text-muted" data-review-count>
          {total}
        </span>
      </h2>
      {children}
    </section>
  );
}

function More({ count }: { count: number }) {
  const t = useTranslations();
  return count > 0 ? (
    <p className="py-2 text-sm text-muted" data-review-more>
      {t('pages.weeklyReview.more', { count })}
    </p>
  ) : null;
}

function ItemSection({ section, list }: { section: Section; list: ReviewList<ReviewItem> }) {
  const t = useTranslations();
  return (
    <SectionFrame name={section} title={t(`pages.weeklyReview.${section}.title`)} total={list.total}>
      {list.rows.length === 0 ? (
        <p className="py-3 text-base text-muted" data-review-empty>
          {t(`pages.weeklyReview.${section}.empty`)}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {list.rows.map((r) => (
            <ItemRow key={`${r.kind}:${r.id}`} item={r} section={section} />
          ))}
        </ul>
      )}
      <More count={moreThanShown(list)} />
    </SectionFrame>
  );
}

function ItemRow({ item, section }: { item: ReviewItem; section: Section }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const partner = partnerName(item, locale);
  return (
    <li data-review-item={item.kind} data-review-id={item.id}>
      <Link
        href={itemRoute(item)}
        className="flex min-h-14 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words">{item.title || t('pages.myDay.note.untitled')}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.kind === 'note' ? <StatusChip tone="neutral">{t('pages.weeklyReview.note')}</StatusChip> : null}
            {partner ? <StatusChip tone="neutral">{partner}</StatusChip> : null}
            {item.times > 0 ? (
              <StatusChip tone={section === 'slipped' && item.times > 1 ? 'warning' : 'neutral'}>
                <span data-review-times={item.times}>{t('pages.weeklyReview.carried', { count: item.times })}</span>
              </StatusChip>
            ) : null}
            <span className="font-data text-xs whitespace-nowrap text-muted">
              {formatDate(item.day, locale, { dateStyle: 'medium' })}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}

function NotesSection({ list }: { list: ReviewList<ReviewNote> }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return (
    <SectionFrame name="notes" title={t('pages.weeklyReview.notes.title')} total={list.total}>
      {list.rows.length === 0 ? (
        <p className="py-3 text-base text-muted" data-review-empty>
          {t('pages.weeklyReview.notes.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {list.rows.map((n) => (
            <li key={n.id} data-review-note={n.id}>
              <Link
                href={`/my-day/notes/${n.id}`}
                className="flex min-h-12 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-focus"
              >
                {n.visibility === 'private' ? (
                  <Lock className="size-4 shrink-0 text-muted" aria-label={t('pages.weeklyReview.private')} />
                ) : null}
                <span className={`min-w-0 flex-1 break-words ${n.done ? 'text-muted line-through' : ''}`}>
                  {n.title || t('pages.myDay.note.untitled')}
                </span>
                {n.idea ? <StatusChip tone="neutral">{t('pages.weeklyReview.idea')}</StatusChip> : null}
                <span className="font-data text-xs whitespace-nowrap text-muted">
                  {formatDate(n.day, locale, { weekday: 'short' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <More count={moreThanShown(list)} />
    </SectionFrame>
  );
}
