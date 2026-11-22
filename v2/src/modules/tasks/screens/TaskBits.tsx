'use client';
import { Briefcase, Building2, CalendarDays, CalendarX2, ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDate, formatNumber } from '@/core/i18n/format';
import { avatarOf } from '@/modules/org/types';
import { Avatar } from '@/ui/Avatar';
import { cn } from '@/ui/cn';
import type { TaskLookups } from '../load';
import { dueState } from '../rules';
import type { TaskRow } from '../types';
import { whereOf } from './look';
import type { useNames } from './words';

type Names = ReturnType<typeof useNames>;

/**
 * The due day on a row or a card (15 Nov). Overdue is NOT a pill: the date itself turns the danger colour, with its own
 * icon and the word "Overdue:" for a screen reader — so it is never said by colour alone.
 */
export function DueMark({ row, today, locale }: { row: TaskRow; today: string; locale: 'en' | 'ar' }) {
  const t = useTranslations();
  if (!row.due_on) return null;
  const due = dueState(row, today);
  const late = due === 'overdue';
  const Icon = late ? CalendarX2 : CalendarDays;
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-sm text-muted',
        late && 'font-medium text-danger',
        due === 'today' && 'text-text',
      )}
      title={late ? t('status.overdue') : undefined}
      data-task-due={due}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">
        {late ? <span className="sr-only">{t('pages.tasks.look.overdueLabel')} </span> : null}
        {due === 'today' ? t('pages.tasks.dueToday') : formatDate(row.due_on, locale)}
      </span>
    </span>
  );
}

/** The partner or project a task is about: one line that shortens with "…", the whole name in its tooltip. */
export function WhereMark({
  row,
  names,
  first = false,
  label,
  className,
}: {
  row: TaskRow;
  names: Names;
  /** The column's name, said to a screen reader before the value (the list's header is not read with each row). */
  label?: string;
  /** Only the first name (a board card: "project or partner"); the tooltip still says both. */
  first?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const where = whereOf(row, names, t('pages.tasks.internalWork'));
  if (where.kind === 'none') return null;
  const full = where.parts.join(' · ');
  const Icon = where.kind === 'project' ? Briefcase : Building2;
  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm text-muted', className)}
      title={full}
      data-task-where={where.kind}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label ? <span className="sr-only">{label}: </span> : null}
      <span className="truncate">{first ? where.parts[0] : full}</span>
    </span>
  );
}

/** The Responsible person: a 24 px avatar and the name, which shortens with "…" (the whole name in its tooltip). */
export function ResponsibleMark({
  row,
  lookups,
  names,
  label,
  className,
}: {
  row: TaskRow;
  lookups: TaskLookups;
  names: Names;
  label?: string;
  className?: string;
}) {
  const person = row.owner_id ? lookups.org?.people.find((p) => p.id === row.owner_id) : undefined;
  const name = names.person(row.owner_id);
  return (
    <span
      className={cn('inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-text', className)}
      title={name}
      data-task-responsible
    >
      {person ? <Avatar person={avatarOf(person, names.locale)} size="xs" ring="none" decorative /> : null}
      {label ? <span className="sr-only">{label}: </span> : null}
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The small count beside a column's or a group's name. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-pill bg-pressed px-1.5 font-data text-xs font-semibold text-strong">
      {count}
    </span>
  );
}

/**
 * A task's steps done (Landing 33, B4): "2 of 5 steps" with a thin bar, on a row or a card that has steps. Nothing
 * for a task with none. The bar is decoration; the words carry the count.
 */
export function StepsMark({
  row,
  locale,
  className,
}: {
  row: Pick<TaskRow, 'open_action_items' | 'action_items_total'>;
  locale: 'en' | 'ar';
  className?: string;
}) {
  const t = useTranslations();
  const total = row.action_items_total ?? 0;
  if (total <= 0) return null;
  const done = Math.max(0, total - row.open_action_items);
  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-1.5 text-sm text-muted', className)}
      data-task-steps={`${done}/${total}`}
    >
      <ListChecks className="size-4 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">
        {t('pages.tasks.look.steps', { done: formatNumber(done, locale), total: formatNumber(total, locale) })}
      </span>
      <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-pill bg-pressed" aria-hidden="true">
        <span
          className={cn('block h-full rounded-pill', done === total ? 'bg-success' : 'bg-info')}
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </span>
    </span>
  );
}
