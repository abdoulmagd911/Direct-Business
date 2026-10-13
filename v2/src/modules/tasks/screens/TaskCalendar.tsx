'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatDate } from '@/core/i18n/format';
import { cn } from '@/ui/cn';
import type { TaskLookups } from '../load';
import { byDueDay, dueState, filtersHref, monthOf, monthWeeks, shiftMonth, type TaskFilters } from '../rules';
import type { TaskRow } from '../types';
import { useNames } from './words';

/**
 * The calendar (§8 Tasks): the month's tasks on their due days, Sunday first, with the month before and after one tap
 * away (in the address). Tasks with no due day are listed under the month, never placed on a guessed day. On a desk it
 * is the month's grid; at 390 px the same days stack as a list and the empty ones are left out — never a sideways
 * scroll. It reads the list's rows, so the chips and the view apply here too.
 */
export function TaskCalendar({
  rows,
  lookups,
  today,
  filters,
}: {
  rows: TaskRow[];
  lookups: TaskLookups;
  today: string;
  filters: TaskFilters;
}) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const month = monthOf(filters.month, today);
  const weeks = monthWeeks(month);
  const { days, undated } = byDueDay(rows);
  // one part of a day (its month, weekday or number) — formatDate's day-month-year default is switched off
  const part = (day: string, opts: Intl.DateTimeFormatOptions) =>
    formatDate(`${day}T12:00:00Z`, names.locale, { day: undefined, month: undefined, year: undefined, ...opts });
  const monthName = part(`${month}-01`, { month: 'long', year: 'numeric' });
  const weekdays = weeks[0]!.map((d) => part(d.day, { weekday: 'short' }));
  const inMonth = weeks.flat().filter((d) => d.inMonth && days.has(d.day)).length;

  const line = (r: TaskRow) => {
    const due = dueState(r, today);
    return (
      <li key={r.id} data-calendar-task={r.number}>
        <Link
          href={`/tasks/${r.number}`}
          className={cn(
            'block break-words rounded-sm px-1.5 py-1 text-sm hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus',
            due === 'overdue' && 'font-medium text-danger',
            r.meaning === 'done' && 'text-muted line-through',
          )}
        >
          {r.title}
        </Link>
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-3" data-task-calendar={month}>
      <div className="flex items-center justify-between gap-2">
        <Link
          href={filtersHref(filters, { month: shiftMonth(month, -1) })}
          className="inline-flex size-9 max-sm:size-11 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
          aria-label={t('pages.tasks.calendar.previous')}
          data-calendar-previous
        >
          <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
        </Link>
        <h2 className="text-lg font-semibold" data-calendar-month>
          {monthName}
        </h2>
        <Link
          href={filtersHref(filters, { month: shiftMonth(month, 1) })}
          className="inline-flex size-9 max-sm:size-11 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
          aria-label={t('pages.tasks.calendar.next')}
          data-calendar-next
        >
          <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>
      <div className="hidden grid-cols-7 gap-px text-center text-xs font-medium text-muted sm:grid" aria-hidden="true">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-px sm:overflow-hidden sm:rounded-lg sm:border sm:border-border sm:bg-border">
        {weeks.flat().map((d) => {
          const due = days.get(d.day) ?? [];
          return (
            <li
              key={d.day}
              className={cn(
                'flex min-w-0 flex-col gap-1 bg-raised p-1.5 sm:min-h-24',
                // on a phone only the month's days that hold work are listed
                (!d.inMonth || !due.length) && 'hidden sm:flex',
                !d.inMonth && 'sm:bg-surface',
                'max-sm:rounded-lg max-sm:border max-sm:border-border',
              )}
              data-calendar-day={d.day}
              data-count={d.inMonth ? due.length : undefined}
            >
              <span
                className={cn(
                  'px-1.5 text-sm text-muted',
                  d.day === today && 'font-semibold text-text',
                  !d.inMonth && 'opacity-60',
                )}
              >
                <span className="sm:hidden">{part(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="max-sm:hidden">{part(d.day, { day: 'numeric' })}</span>
              </span>
              {d.inMonth && due.length ? <ul className="flex flex-col">{due.map(line)}</ul> : null}
            </li>
          );
        })}
      </ol>
      {!inMonth ? <p className="text-base text-muted">{t('pages.tasks.calendar.emptyMonth')}</p> : null}
      {undated.length ? (
        <section className="flex flex-col gap-1" data-calendar-undated>
          <h3 className="text-base font-semibold">{t('pages.tasks.calendar.noDue', { count: undated.length })}</h3>
          <ul className="flex flex-col">{undated.map(line)}</ul>
        </section>
      ) : null}
    </section>
  );
}
