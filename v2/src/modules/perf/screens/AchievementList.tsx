'use client';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { cn } from '@/ui/cn';
import { hrefOf, type AchievementPage, type AchievementRow, type Category, type ListFilter } from '../types';

const ALL = '__all';

/**
 * Achievements under KPIs (GC-4): one lean list — category, mine or all, month, and the Backfilled, Past work and
 * Needs owner switches, all kept in the address. Each row is the achievement's own line, its category, owner, date and
 * marks; it opens the record page. Log achievement is the one primary action.
 */
export function AchievementList({
  page,
  filter,
  categories,
  people,
  canLog,
}: {
  page: AchievementPage | null;
  filter: ListFilter;
  categories: Category[];
  people: Record<string, string>;
  canLog: boolean;
}) {
  const t = useTranslations('pages.achievements');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const go = (next: ListFilter) => router.push(hrefOf(next));
  const toggle = (k: 'backfilled' | 'past' | 'needsOwner') => go({ ...filter, [k]: filter[k] ? undefined : true });
  const filtered = Object.values(filter).some(Boolean);
  const top = categories.filter((c) => !c.parent_id);
  const options = [
    { value: ALL, label: t('filters.all') },
    ...categories.map((c) => ({
      value: c.code,
      label: (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en),
    })),
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ label: tc('nav.kpis'), href: '/kpis' }]}
        title={t('title')}
        meta={page ? String(page.total) : undefined}
        actions={
          canLog ? (
            <Link href="/kpis/achievements/new" className={buttonVariants({ variant: 'primary' })} data-log-achievement>
              <Plus aria-hidden="true" />
              {t('log')}
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2" data-achievement-filters>
        <Select
          aria-label={t('filters.category')}
          className="w-48"
          value={filter.category ?? ALL}
          options={options}
          onValueChange={(v) => go({ ...filter, category: v === ALL ? undefined : v })}
        />
        <div role="group" aria-label={t('filters.mine')} className="inline-flex rounded-md border border-border-strong">
          {[false, true].map((m) => (
            <button
              key={String(m)}
              type="button"
              aria-pressed={!!filter.mine === m}
              onClick={() => go({ ...filter, mine: m || undefined })}
              className={cn(
                'h-[var(--control-h-sm)] px-3 text-sm first:rounded-s-md last:rounded-e-md',
                !!filter.mine === m ? 'bg-accent-soft text-text' : 'text-muted hover:bg-surface',
              )}
            >
              {m ? t('filters.mine') : t('filters.all')}
            </button>
          ))}
        </div>
        <Input
          type="month"
          aria-label={t('filters.month')}
          className="w-44"
          value={filter.month ?? ''}
          onChange={(e) => go({ ...filter, month: e.target.value || undefined })}
        />
        {(['backfilled', 'past', 'needsOwner'] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter[k] ? 'primary' : 'secondary'}
            aria-pressed={!!filter[k]}
            onClick={() => toggle(k)}
          >
            {t(`filters.${k}`)}
          </Button>
        ))}
        {filtered ? (
          <Button size="sm" variant="ghost" onClick={() => go({})}>
            {t('filters.clear')}
          </Button>
        ) : null}
      </div>
      {!page ? (
        <DataState
          kind="failed"
          what={t('title')}
          message={tc('state.failed', { what: t('title') })}
          onRetry={() => router.refresh()}
          retryLabel={tc('common.tryAgain')}
        />
      ) : page.rows.length === 0 ? (
        <DataState kind="empty" message={filtered ? t('noMatch') : t('empty')} />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised"
          data-achievement-list
        >
          {page.rows.map((r) => (
            <Row key={r.id} row={r} owner={r.owner_id ? (people[r.owner_id] ?? '') : null} top={top} />
          ))}
        </ul>
      )}
    </>
  );
}

function Row({ row, owner, top }: { row: AchievementRow; owner: string | null; top: Category[] }) {
  const t = useTranslations('pages.achievements');
  const locale = useLocale() as 'en' | 'ar';
  const category = locale === 'ar' ? row.category_ar : row.category_en;
  const parent = row.parent_category ? top.find((c) => c.code === row.parent_category) : undefined;
  return (
    <li data-achievement-row={row.id}>
      <Link
        href={`/kpis/achievements/${row.id}`}
        className="flex flex-col gap-1 px-4 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text">{locale === 'ar' ? row.line_ar : row.line_en}</span>
          <span className="block truncate text-sm text-muted">
            {parent ? `${locale === 'ar' ? parent.name_ar : parent.name_en} · ` : ''}
            {category}
            {' · '}
            {owner ?? t('marks.unknown')}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {row.deal_value !== null ? (
            <span className="font-data tabular text-sm">{formatMoney(row.deal_value, locale)}</span>
          ) : null}
          <Marks row={row} />
          <span className="text-sm text-muted tabular">
            {row.happened_on ? formatDate(row.happened_on, locale) : t('noDate')}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** The marks an achievement carries (V68, V99, V400, V491): each a word, never a colour alone. */
export function Marks({ row }: { row: AchievementRow }) {
  const t = useTranslations('pages.achievements.marks');
  return (
    <>
      {row.draft ? <StatusChip tone="warning">{t('draft')}</StatusChip> : null}
      {row.backfilled ? <StatusChip tone="neutral">{t('backfilled')}</StatusChip> : null}
      {row.needs_owner ? <StatusChip tone="warning">{t('unknown')}</StatusChip> : null}
      {row.no_evidence ? <StatusChip tone="info">{t('noEvidence')}</StatusChip> : null}
      {row.moved ? <StatusChip tone="info">{t('moved')}</StatusChip> : null}
      {row.logged_late ? <StatusChip tone="warning">{t('late')}</StatusChip> : null}
    </>
  );
}
