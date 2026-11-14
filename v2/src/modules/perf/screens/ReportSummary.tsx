'use client';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { CappedNote } from '@/modules/partners/screens/CappedNote';
import { Button, buttonVariants } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { MonthPicker } from '@/ui/MonthPicker';
import { PageHeader } from '@/ui/PageHeader';
import type { AchievementPage, AchievementRow } from '../types';
import { displayLine } from '../types';

type Group = { key: string; label: string; count: number; deal: number };

/**
 * The rows counted under each key, with their deal values summed. A group is keyed by the person's or the
 * organisation's id, not by the name it shows: two people with the same name are two lines, never one.
 */
export function groupBy(rows: readonly AchievementRow[], keyOf: (r: AchievementRow) => [string, string]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const [key, label] = keyOf(r);
    const g = map.get(key) ?? { key, label, count: 0, deal: 0 };
    g.count += 1;
    if (r.deal_value !== null) g.deal += Number(r.deal_value);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * One spreadsheet cell. Text that starts with = + - @ (or a tab or a return) would be read as a formula when the
 * file is opened in a spreadsheet — a title "=1+1" became a sum — so such text is kept as text with a leading
 * apostrophe. A number goes in as the number it is, rounded to the halala.
 */
export function csvCell(v: string | number | null): string {
  if (v === null) return '""';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${s.replaceAll('"', '""')}"`;
}

/**
 * Reports, first version: a read-only monthly summary over the same achievements
 * list the Achievements page reads — month picker, totals by category, owner and
 * organisation, plus deal-value totals. No report editor, no new module. The
 * summary covers every dated achievement the page read (drafts never count, V68);
 * past the read cap, the capped line says how many it shows of how many.
 */
export function ReportSummary({
  page,
  month,
  drafts = 0,
  people,
  partners,
}: {
  page: AchievementPage | null;
  month: string | undefined;
  /** Achievements with no date yet, left out of the summary (any month only: a month holds none). */
  drafts?: number;
  people: Record<string, string>;
  partners: Record<string, string>;
}) {
  const t = useTranslations('pages.reports');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const goMonth = (m: string | undefined) => router.push(m ? `/reports?month=${encodeURIComponent(m)}` : '/reports');
  const rows = page?.rows ?? [];
  const categoryName = (r: AchievementRow) => (locale === 'ar' ? r.category_ar : r.category_en);
  const ownerName = (r: AchievementRow) => (r.owner_id ? (people[r.owner_id] ?? t('unknownOwner')) : t('unknownOwner'));
  const partnerName = (r: AchievementRow) =>
    r.partner_id ? (partners[r.partner_id] ?? t('hiddenPartner')) : t('unknownPartner');
  const byCategory = groupBy(rows, (r) => [r.category, categoryName(r)]);
  const byOwner = groupBy(rows, (r) => [r.owner_id ?? '', ownerName(r)]);
  const byPartner = groupBy(rows, (r) => [r.partner_id ?? '', partnerName(r)]);
  const dealRows = rows.filter((r) => r.deal_value !== null);
  const dealTotal = dealRows.reduce((sum, r) => sum + Number(r.deal_value ?? 0), 0);
  const download = () => {
    const lines: (string | number | null)[][] = [
      [t('month'), month ?? t('anyMonth')],
      [t('total'), rows.length],
      [t('dealValue'), dealTotal],
      [],
      [t('byCategory'), t('total'), t('dealValue')],
      ...byCategory.map((g) => [g.label, g.count, g.deal]),
      [],
      [t('byOwner'), t('total'), t('dealValue')],
      ...byOwner.map((g) => [g.label, g.count, g.deal]),
      [],
      [t('byPartner'), t('total'), t('dealValue')],
      ...byPartner.map((g) => [g.label, g.count, g.deal]),
      [],
      // the column names in the page's language, as every other line of the file
      [
        tc('pages.achievements.cols.achievement'),
        tc('pages.achievements.cols.category'),
        tc('pages.achievements.cols.owner'),
        tc('pages.achievements.fields.organisation'),
        tc('pages.achievements.cols.date'),
        t('dealValue'),
        tc('pages.achievements.fields.number'),
      ],
      ...rows.map((r) => [
        displayLine(locale === 'ar' ? r.line_ar : r.line_en),
        categoryName(r),
        ownerName(r),
        partnerName(r),
        r.happened_on ? formatDate(r.happened_on, locale) : '',
        r.deal_value !== null ? Number(r.deal_value) : null,
        r.number,
      ]),
    ];
    // a byte-order mark first, so a spreadsheet opens the file as UTF-8 and the Arabic reads as Arabic
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = month ? `reports-${month}.csv` : 'reports.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title={tc('nav.reports')}
        meta={
          page ? (
            <span className="font-data" data-report-count>
              {tc('pages.achievements.count', { count: page.total })}
            </span>
          ) : undefined
        }
        actions={
          <Button size="sm" variant="secondary" onClick={download} disabled={!page || rows.length === 0}>
            <Download aria-hidden="true" />
            {t('download')}
          </Button>
        }
      />
      <h2 className="text-lg font-semibold">{t('summary')}</h2>
      {/* The month row aligns on the boxes' tops, its label beside the box (as the Achievements filters): aligned on
          the bottom, the chosen month's name under the box pushed the link below the box. */}
      <div className="flex flex-wrap items-start gap-2">
        <label className="flex w-full max-w-[28rem] items-start gap-2 text-sm text-muted" data-report-month>
          <span className="flex h-[var(--control-h)] shrink-0 items-center">{t('month')}</span>
          {/* FIX-28 (F-B1-09): the month box is wide enough for its placeholder ("For example, Oct 2026") in
              either language — at w-44 the placeholder was cut to "For example, C…". Full width on a phone, capped
              on a PC. */}
          <MonthPicker id="report-month" value={month} onChange={goMonth} className="min-w-0 max-w-96 flex-1" />
        </label>
        <Link
          href={month ? `/kpis/achievements?month=${encodeURIComponent(month)}` : '/kpis/achievements'}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-[var(--control-h)]')}
        >
          {t('seeList')}
        </Link>
      </div>
      {!page ? (
        <DataState
          kind="failed"
          what={t('summary')}
          message={tc('state.failed', { what: t('summary') })}
          onRetry={() => router.refresh()}
          retryLabel={tc('common.tryAgain')}
        />
      ) : rows.length === 0 ? (
        // "in this month" only when a month is chosen: with none, the summary covers every month
        <DataState kind="empty" message={month ? t('empty') : t('emptyAny')} />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted" data-report-totals>
            {t('total')}: {rows.length} · {t('dealValue')}: {formatMoney(dealTotal, locale)}
            {dealRows.length ? ` · ${dealRows.length} ${t('withDealValue')}` : ''}
          </p>
          <GroupList title={t('byCategory')} groups={byCategory} locale={locale} />
          <GroupList title={t('byOwner')} groups={byOwner} locale={locale} />
          <GroupList title={t('byPartner')} groups={byPartner} locale={locale} />
          <CappedNote shown={rows.length} total={page.total} />
        </div>
      )}
      {drafts > 0 ? (
        <p className="text-sm text-muted" data-report-drafts>
          {t('draftsLeftOut', { count: drafts })}
        </p>
      ) : null}
    </>
  );
}

function GroupList({ title, groups, locale }: { title: string; groups: Group[]; locale: 'en' | 'ar' }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-medium">{title}</h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
        {groups.map((g) => (
          <li key={g.key} className="flex min-w-0 items-center gap-4 px-4 py-3">
            <bdi className="min-w-0 flex-1 truncate font-medium">{g.label}</bdi>
            <span className="font-data text-sm text-muted tabular">{g.count}</span>
            {g.deal !== 0 ? <span className="font-data text-sm tabular">{formatMoney(g.deal, locale)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
