'use client';
import { ChevronLeft, ChevronRight, LineChart, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDate, formatMoney, formatNumber } from '@/core/i18n/format';
import { nameOf } from '@/modules/org/types';
import { buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import {
  barFill,
  curveOf,
  inYear,
  shiftMonth,
  STATUS_TONE,
  type PaceAnswer,
  type PaceRow,
  type PaceStatus,
} from '../pace';

const COUNTED: PaceStatus[] = ['on_track', 'at_risk', 'behind'];

/** The bar's colour follows the status; a KPI with nothing to judge has an empty bar. */
const BAR: Record<PaceStatus, string> = {
  on_track: 'bg-success',
  at_risk: 'bg-warning',
  behind: 'bg-danger',
  not_started: 'bg-border-strong',
  not_measured: 'bg-border-strong',
};

/**
 * Reports → KPI pace (Landing 54; the design session's Batch 3, boards 5–8): the month's KPIs — the plan's targets
 * of that month — each with who is Responsible, its monthly target, its actual to date, its pace and status, and
 * its initiatives; the three status counts above them; and the target-against-actual curve of one KPI with today
 * marked. Everything shown is read (api.kpi_pace); the page changes nothing. The pencil only leads to where targets
 * are edited today (Settings → Targets), for the people who may open it: the KPI edit screen is a later landing.
 */
export function KpiPace({ answer, month }: { answer: PaceAnswer | null; month: string }) {
  const t = useTranslations('pages.kpiPace');
  const tc = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [charted, setCharted] = useState<string | null>(null);
  const rows = answer?.rows ?? [];
  const chosen = rows.find((r) => r.id === charted) ?? rows[0] ?? null;
  const year = Number(month.slice(0, 4));
  const years = answer?.years ?? [year - 2, year - 1, year];
  const hrefOf = (m: string) => `/reports/kpi-pace?month=${m}`;
  const departments = new Set(rows.map((r) => r.department_id)).size;
  const nameOfRow = (r: PaceRow) => {
    const name = locale === 'ar' ? r.name_ar : r.name_en;
    return r.measure === 'value' ? t('dealValueOf', { name }) : name;
  };
  const figure = (r: PaceRow, n: number) => (r.measure === 'value' ? formatMoney(n, locale) : formatNumber(n, locale));
  return (
    <>
      <PageHeader
        crumbs={[{ label: tc('nav.reports'), href: '/reports' }, { label: t('title') }]}
        title={t('title')}
        meta={
          <span data-pace-month>
            {formatDate(`${month}-01T12:00:00+03:00`, locale, { day: undefined, month: 'long', year: 'numeric' })}
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2" role="group" aria-label={t('year')} data-pace-years>
          <span className="text-sm text-muted">{t('year')}</span>
          {years.map((y) => (
            <Link
              key={y}
              href={hrefOf(inYear(month, y))}
              aria-current={y === year ? 'true' : undefined}
              className={cn(
                buttonVariants({ variant: y === year ? 'secondary' : 'ghost', size: 'sm' }),
                'font-data max-sm:h-11',
                y === year && 'border-sel bg-sel text-on-sel hover:bg-sel',
              )}
            >
              {y}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={hrefOf(shiftMonth(month, -1))}
            aria-label={t('previousMonth')}
            title={t('previousMonth')}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2 max-sm:size-11')}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          </Link>
          <Link
            href={hrefOf(shiftMonth(month, 1))}
            aria-label={t('nextMonth')}
            title={t('nextMonth')}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2 max-sm:size-11')}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </div>
      {!answer ? (
        <DataState
          kind="failed"
          what={t('title')}
          message={tc('state.failed', { what: t('title') })}
          onRetry={() => router.refresh()}
          retryLabel={tc('common.tryAgain')}
        />
      ) : rows.length === 0 ? (
        <DataState
          kind="empty"
          message={t('empty')}
          action={
            answer.can_edit ? (
              <Link href="/settings/performance" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                {t('setTargets')}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {chosen ? <PaceChart row={chosen} answer={answer} name={nameOfRow(chosen)} figure={figure} /> : null}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-lg font-semibold">{t('kpis')}</h2>
              <ul className="flex flex-wrap items-center gap-2" data-pace-counts>
                {COUNTED.map((s) => (
                  <li key={s}>
                    <StatusChip tone={STATUS_TONE[s]}>
                      {t(`status.${s}`)}{' '}
                      <span className="font-data" data-pace-count={s}>
                        {answer.counts[s as 'on_track' | 'at_risk' | 'behind']}
                      </span>
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="grid gap-3 lg:grid-cols-2">
              {rows.map((r) => {
                const name = nameOfRow(r);
                const fill = barFill(r.pace);
                return (
                  <li
                    key={r.id}
                    data-pace-kpi={r.code}
                    data-pace-measure={r.measure}
                    className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised p-4"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-base font-semibold text-strong">
                          <bdi>{name}</bdi>
                        </h3>
                        {departments > 1 ? (
                          <p className="text-sm text-muted">
                            <bdi>{locale === 'ar' && r.department_ar ? r.department_ar : r.department_en}</bdi>
                          </p>
                        ) : null}
                      </div>
                      <StatusChip tone={STATUS_TONE[r.status]} className="mt-0.5">
                        <span data-pace-status={r.status}>{t(`status.${r.status}`)}</span>
                      </StatusChip>
                      <IconButton
                        size="sm"
                        label={t('showOnChart', { name })}
                        pressed={chosen?.id === r.id}
                        onClick={() => setCharted(r.id)}
                        icon={<LineChart aria-hidden="true" />}
                      />
                      {answer.can_edit ? (
                        <Link
                          href={`/settings/performance/${r.plan_id}`}
                          aria-label={t('edit', { name })}
                          title={t('edit', { name })}
                          data-pace-edit
                          className="press inline-grid size-8 shrink-0 place-items-center rounded-pill text-current hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:size-11 [&_svg]:size-4"
                        >
                          <Pencil aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                    <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm max-sm:grid-cols-1">
                      <div className="flex min-w-0 flex-col max-sm:flex-row max-sm:justify-between max-sm:gap-3">
                        <dt className="text-muted">{t('responsible')}</dt>
                        <dd className="min-w-0 break-words font-medium" data-pace-responsible>
                          {r.responsible ? (
                            <bdi>{nameOf(r.responsible, locale)}</bdi>
                          ) : (
                            <span className="text-muted">{t('noResponsible')}</span>
                          )}
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col max-sm:flex-row max-sm:justify-between max-sm:gap-3">
                        <dt className="text-muted">{t('monthlyTarget')}</dt>
                        <dd className="font-data font-medium tabular" data-pace-target>
                          {figure(r, Number(r.target))}
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col max-sm:flex-row max-sm:justify-between max-sm:gap-3">
                        <dt className="text-muted">{t('actualToDate')}</dt>
                        <dd className="font-data font-medium tabular" data-pace-actual>
                          {figure(r, Number(r.actual))}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{t('pace')}</span>
                      <div
                        role="progressbar"
                        aria-label={`${t('pace')} — ${name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={fill}
                        aria-valuetext={r.pace === null ? t(`status.${r.status}`) : `${r.pace}%`}
                        className="h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-pressed"
                      >
                        <div
                          className={cn('h-full rounded-pill', BAR[r.status])}
                          style={{ inlineSize: `${fill}%` }}
                          data-pace-bar
                        />
                      </div>
                      <span className="w-12 text-end font-data text-sm font-semibold tabular" data-pace-pct>
                        {r.pace === null ? '—' : `${formatNumber(r.pace, locale)}%`}
                      </span>
                    </div>
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm" data-pace-initiatives>
                      <span className="text-muted">{t('initiatives')}</span>
                      {r.initiatives.length === 0 ? (
                        <span className="text-muted">{t('noInitiatives')}</span>
                      ) : (
                        <>
                          <span className="font-data font-semibold" data-pace-initiative-count>
                            {formatNumber(r.initiatives.length, locale)}
                          </span>
                          <span className="min-w-0 break-words">
                            {r.initiatives.map((i, n) => (
                              <span key={i.id}>
                                {n > 0 ? ' · ' : ''}
                                <bdi>{t('initiativeCount', { name: i.name, count: i.count })}</bdi>
                              </span>
                            ))}
                          </span>
                          {answer.can_see_projects ? (
                            <Link href="/projects" className="font-medium text-link underline underline-offset-[3px]">
                              {t('viewThem')}
                            </Link>
                          ) : null}
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

const W = 600;
const H = 180;
const path = (points: { x: number; y: number }[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * W).toFixed(1)} ${(H - p.y * H).toFixed(1)}`).join(' ');

/**
 * The curve of one KPI: the target due day by day (dashed) against the running actual, with today marked. The
 * drawing holds no words, so in Arabic it is simply mirrored; the words around it are the page's own.
 */
function PaceChart({
  row,
  answer,
  name,
  figure,
}: {
  row: PaceRow;
  answer: PaceAnswer;
  name: string;
  figure: (r: PaceRow, n: number) => string;
}) {
  const t = useTranslations('pages.kpiPace');
  const locale = useLocale() as 'en' | 'ar';
  const curve = curveOf(row, answer);
  const first = answer.days[0]?.day;
  const last = answer.days[answer.days.length - 1]?.day;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4" data-pace-chart={row.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 break-words text-base font-semibold text-strong">
          <bdi>{name}</bdi>
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-border-strong" aria-hidden="true" />
            {t('target')} <span className="font-data text-strong">{figure(row, Number(row.target))}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-primary" aria-hidden="true" />
            {t('actual')} <span className="font-data text-strong">{figure(row, Number(row.actual))}</span>
          </li>
        </ul>
      </div>
      <div className="relative pt-6">
        {curve.today !== null ? (
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-strong rtl:translate-x-1/2"
            style={{ insetInlineStart: `${Math.min(92, Math.max(8, curve.today * 100))}%` }}
            data-pace-today
          >
            {t('today')} · {formatDate(answer.today, locale, { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('chartLabel', { name })}
          className="block h-44 w-full overflow-visible rtl:-scale-x-100"
        >
          <line
            x1="0"
            y1={H}
            x2={W}
            y2={H}
            className="stroke-border"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {curve.today !== null ? (
            <line
              x1={curve.today * W}
              y1="0"
              x2={curve.today * W}
              y2={H}
              className="stroke-border-strong"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            d={path(curve.target)}
            fill="none"
            className="stroke-border-strong"
            strokeWidth="2"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
            data-pace-line="target"
          />
          {curve.actual.length ? (
            <path
              d={path(curve.actual)}
              fill="none"
              className="stroke-primary"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              data-pace-line="actual"
            />
          ) : null}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{first ? formatDate(first, locale, { day: 'numeric', month: 'short' }) : null}</span>
          <span>{last ? formatDate(last, locale, { day: 'numeric', month: 'short' }) : null}</span>
        </div>
      </div>
      <p className="text-sm text-muted" data-pace-days>
        {t('daysPassed', {
          passed: answer.days_passed,
          total: answer.working_days,
          share: formatNumber(Math.round(Number(answer.share) * 100), locale),
        })}
      </p>
    </section>
  );
}
