'use client';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { CappedNote } from '@/modules/partners/screens/CappedNote';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { MonthPicker } from '@/ui/MonthPicker';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { cn } from '@/ui/cn';
import {
  ACHIEVEMENT_SORTS,
  hrefOf,
  sortAchievements,
  type AchievementPage,
  type AchievementRow,
  type AchievementSortKey,
  type Category,
  type ListFilter,
} from '../types';
import { displayLine } from '../types';

const ALL = '__all';

/**
 * Achievements under KPIs (GC-4): one lean list — category, mine or all, month, and the Backfilled, Past work and
 * Needs owner switches, all kept in the address. Each row is the achievement's own line, its category, owner, date and
 * marks; it opens the record page. Log achievement is the one primary action. The list reads the door's first 200;
 * past them, a line says how many it shows of how many (QA-514, as Clients does, QA-506).
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
  // the sort only orders the list — it filters nothing out, so it never brings up Clear filters, and Clear filters
  // keeps it
  const filtered = Object.entries(filter).some(([k, v]) => k !== 'sort' && !!v);
  const clear = () => go({ sort: filter.sort });
  const rows = sortAchievements(page?.rows ?? [], filter.sort, locale);
  const top = categories.filter((c) => !c.parent_id);
  const options = [
    { value: ALL, label: t('filters.allCategories') },
    ...categories.map((c) => ({
      value: c.code,
      label: (c.parent_id ? '— ' : '') + (locale === 'ar' ? c.name_ar : c.name_en),
    })),
  ];
  return (
    <>
      <PageHeader
        title={t('title')}
        // the count in words, as Clients says its own ("6 organisations") — a bare "0" read as nothing
        meta={
          page ? (
            <span className="font-data" data-achievements-total>
              {t('count', { count: page.total })}
            </span>
          ) : undefined
        }
        actions={
          canLog ? (
            <Link href="/kpis/achievements/new" className={buttonVariants({ variant: 'primary' })} data-log-achievement>
              <Plus aria-hidden="true" />
              {t('log')}
            </Link>
          ) : null
        }
      />
      {/* One line of filters, every control at the same height and top: the month's "Any month" line sits under
          its own box, so the row aligns on the boxes' tops (aligned on the bottom, the month box rode higher than
          the rest). Its label stands beside its box. On a phone the two menus take the full width. */}
      <div className="flex flex-wrap items-start gap-2" data-achievement-filters>
        <Select
          aria-label={t('filters.category')}
          className="w-full sm:w-48"
          value={filter.category ?? ALL}
          options={options}
          onValueChange={(v) => go({ ...filter, category: v === ALL ? undefined : v })}
        />
        {/* FIX-01: the sort menu — the columns are not sortable, so the order is a menu, kept in the address. */}
        <Select
          aria-label={t('filters.sort')}
          className="w-full sm:w-44"
          value={filter.sort ?? ''}
          placeholder={t('filters.sort')}
          options={ACHIEVEMENT_SORTS.map((k) => ({ value: k, label: t(`filters.sort_${k}`) }))}
          onValueChange={(v) => go({ ...filter, sort: (v as AchievementSortKey) || undefined })}
        />
        <div
          role="group"
          aria-label={t('filters.mine')}
          className="inline-flex h-[var(--control-h)] rounded-md border border-border-strong"
        >
          {[false, true].map((m) => (
            <button
              key={String(m)}
              type="button"
              aria-pressed={!!filter.mine === m}
              onClick={() => go({ ...filter, mine: m || undefined })}
              className={cn(
                'h-full px-3 text-sm first:rounded-s-md last:rounded-e-md',
                !!filter.mine === m ? 'bg-accent-soft text-text' : 'text-muted hover:bg-surface',
              )}
            >
              {m ? t('filters.mine') : t('filters.all')}
            </button>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm text-muted" data-month-filter>
          <span className="flex h-[var(--control-h)] shrink-0 items-center">{t('filters.month')}</span>
          <MonthPicker
            id="month-filter"
            value={filter.month}
            onChange={(v) => go({ ...filter, month: v })}
            emptyLabel={t('filters.anyMonth')}
            className="w-64"
          />
        </label>
        {filtered && page?.rows.length !== 0 ? (
          <Button size="sm" variant="ghost" className="h-[var(--control-h)]" onClick={clear} data-clear-filters-row>
            {t('filters.clear')}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1" data-achievement-switches>
        {(['backfilled', 'past', 'needsOwner'] as const).map((k) => (
          <div key={k} className="flex items-center gap-3" data-achievement-switch={k}>
            <Switch checked={!!filter[k]} onCheckedChange={() => toggle(k)} label={t(`filters.${k}`)} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">{t(`filters.${k}`)}</span>
              <span className="block text-sm text-muted">{t(`filters.meaning.${k}`)}</span>
            </span>
          </div>
        ))}
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
        <DataState
          kind="empty"
          message={filtered ? t('noMatch') : t('empty')}
          action={
            filtered ? (
              <Button size="sm" variant="secondary" onClick={clear} data-clear-filters>
                {t('filters.clear')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised"
          data-achievement-list
        >
          {rows.map((r) => (
            <Row key={r.id} row={r} owner={r.owner_id ? (people[r.owner_id] ?? '') : null} top={top} />
          ))}
        </ul>
      )}
      {page ? <CappedNote shown={page.rows.length} total={page.total} /> : null}
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
        className="flex min-w-0 flex-col items-stretch gap-1 px-4 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-3 break-words font-medium text-text" data-achievement-title>
            <bdi>{displayLine(locale === 'ar' ? row.line_ar : row.line_en)}</bdi>
          </span>
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
          <span className="font-data text-sm text-muted tabular" data-achievement-number>
            {row.number}
          </span>
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
