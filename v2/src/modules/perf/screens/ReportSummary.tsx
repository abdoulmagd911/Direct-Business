'use client';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { CappedNote } from '@/modules/partners/screens/CappedNote';
import { Button, buttonVariants } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { MonthPicker } from '@/ui/MonthPicker';
import { PageHeader } from '@/ui/PageHeader';
import type { AchievementPage, AchievementRow } from '../types';
import { displayLine } from '../types';

type Group = { label: string; count: number; deal: number };

function groupBy(rows: AchievementRow[], key: (r: AchievementRow) => string): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const label = key(r);
    const g = map.get(label) ?? { label, count: 0, deal: 0 };
    g.count += 1;
    if (r.deal_value !== null) g.deal += r.deal_value;
    map.set(label, g);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function csvCell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return `"${s.replaceAll('"', '""')}"`;
}

/**
 * Reports, first version: a read-only monthly summary over the same achievements
 * list the Achievements page reads — month picker, totals by category, owner and
 * organisation, plus deal-value totals. No report editor, no new module. The
 * summary covers the rows the list returns (its first 200); past that, the
 * capped line says how many it shows of how many, as the Achievements list does.
 */
export function ReportSummary({
  page,
  month,
  people,
  partners,
}: {
  page: AchievementPage | null;
  month: string | undefined;
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
  const byCategory = groupBy(rows, categoryName);
  const byOwner = groupBy(rows, (r) => (r.owner_id ? (people[r.owner_id] ?? t('unknownOwner')) : t('unknownOwner')));
  const byPartner = groupBy(rows, (r) =>
    r.partner_id ? (partners[r.partner_id] ?? t('unknownPartner')) : t('unknownPartner'),
  );
  const dealRows = rows.filter((r) => r.deal_value !== null);
  const dealTotal = dealRows.reduce((sum, r) => sum + (r.deal_value ?? 0), 0);
  const download = () => {
    const lines: string[][] = [
      [t('month'), month ?? t('anyMonth')],
      [t('total'), String(page?.total ?? 0)],
      [t('dealValue'), String(dealTotal)],
      [],
      [t('byCategory'), t('total'), t('dealValue')],
      ...byCategory.map((g) => [g.label, String(g.count), String(g.deal)]),
      [],
      [t('byOwner'), t('total'), t('dealValue')],
      ...byOwner.map((g) => [g.label, String(g.count), String(g.deal)]),
      [],
      [t('byPartner'), t('total'), t('dealValue')],
      ...byPartner.map((g) => [g.label, String(g.count), String(g.deal)]),
      [],
      ['Title', 'Category', 'Owner', 'Organisation', 'Date', 'Deal value', 'Number'],
      ...rows.map((r) => [
        displayLine(locale === 'ar' ? r.line_ar : r.line_en),
        categoryName(r),
        r.owner_id ? (people[r.owner_id] ?? t('unknownOwner')) : t('unknownOwner'),
        r.partner_id ? (partners[r.partner_id] ?? t('unknownPartner')) : t('unknownPartner'),
        r.happened_on ? formatDate(r.happened_on, locale) : '',
        r.deal_value !== null ? String(r.deal_value) : '',
        r.number,
      ]),
    ];
    const blob = new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], {
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
        meta={page ? String(page.total) : undefined}
        actions={
          <Button size="sm" variant="secondary" onClick={download} disabled={!page || rows.length === 0}>
            <Download aria-hidden="true" />
            {t('download')}
          </Button>
        }
      />
      <h2 className="text-lg font-semibold">{t('summary')}</h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-sm text-muted" data-report-month>
          {t('month')}
          <MonthPicker id="report-month" value={month} onChange={goMonth} className="w-44" />
        </label>
        <Link
          href={month ? `/kpis/achievements?month=${encodeURIComponent(month)}` : '/kpis/achievements'}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
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
        <DataState kind="empty" message={t('empty')} />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted" data-report-totals>
            {t('total')}: {page.total} · {t('dealValue')}: {formatMoney(dealTotal, locale)}
            {dealRows.length ? ` · ${dealRows.length} ${t('withDealValue')}` : ''}
          </p>
          <GroupList title={t('byCategory')} groups={byCategory} locale={locale} />
          <GroupList title={t('byOwner')} groups={byOwner} locale={locale} />
          <GroupList title={t('byPartner')} groups={byPartner} locale={locale} />
          <CappedNote shown={rows.length} total={page.total} />
        </div>
      )}
    </>
  );
}

function GroupList({ title, groups, locale }: { title: string; groups: Group[]; locale: 'en' | 'ar' }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-medium">{title}</h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
        {groups.map((g) => (
          <li key={g.label} className="flex min-w-0 items-center gap-4 px-4 py-3">
            <span className="min-w-0 flex-1 truncate font-medium">
              <bdi>{g.label}</bdi>
            </span>
            <span className="font-data text-sm text-muted tabular">{g.count}</span>
            {g.deal !== 0 ? <span className="font-data text-sm tabular">{formatMoney(g.deal, locale)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
