'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { DoneTick } from '@/modules/tasks/screens/StatusControl';
import type { TaskStatus } from '@/modules/tasks/types';
import { todayGroups } from '../logic';
import type { TodayTask } from '../types';

/**
 * The Today block at the top of My day (productivity stage 1): my tasks as Overdue (with its count), Today and Next
 * (the rest of this week). A row is a done tick (Undo comes with it), the title (opens the task), the client and the due
 * day. Nothing due → "Nothing due today".
 */
export function TodayBlock({
  tasks,
  day,
  statuses,
  carried = 0,
}: {
  tasks: TodayTask[];
  day: string;
  statuses: TaskStatus[];
  /** What yesterday's wrap-up carried to today and is still open. */
  carried?: number;
}) {
  const t = useTranslations();
  const g = todayGroups(tasks, day);
  const groups = [
    { key: 'overdue', rows: g.overdue },
    { key: 'today', rows: g.today },
    { key: 'next', rows: g.next },
  ] as const;
  const none = !g.overdue.length && !g.today.length && !g.next.length;
  return (
    <section className="rounded-lg border border-border bg-raised px-4 py-2" data-today-block>
      <h2 className="border-b border-border py-2.5 text-base font-semibold">{t('pages.myDay.today.title')}</h2>
      {carried > 0 ? (
        <p className="border-b border-border py-2.5 text-sm text-muted" data-today-carried>
          {t('pages.myDay.today.carried', { count: carried })}
        </p>
      ) : null}
      {none ? (
        <DataState kind="empty" message={t('pages.myDay.today.empty')} />
      ) : (
        groups
          .filter((x) => x.rows.length)
          .map((x) => (
            <div key={x.key} data-today-group={x.key}>
              <h3 className="pt-3 text-sm font-medium text-muted">
                {t(`pages.myDay.today.${x.key}`)}
                {x.key === 'overdue' ? (
                  <span className="ms-2 font-data text-danger" data-today-overdue-count>
                    {x.rows.length}
                  </span>
                ) : null}
              </h3>
              <ul className="divide-y divide-border">
                {x.rows.map((r) => (
                  <TodayRow key={r.id} task={r} statuses={statuses} overdue={x.key === 'overdue'} />
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  );
}

function TodayRow({ task, statuses, overdue }: { task: TodayTask; statuses: TaskStatus[]; overdue: boolean }) {
  const locale = useLocale() as 'en' | 'ar';
  const tick = {
    id: task.id,
    number: task.number,
    title: task.title,
    status: '',
    meaning: 'not_started',
    blocked_reason: null,
    open_action_items: 0,
  } as unknown as Parameters<typeof DoneTick>[0]['task'];
  return (
    <li className="relative flex min-h-14 items-start gap-3 py-3" data-today-task={task.number}>
      <DoneTick task={tick} statuses={statuses} title={task.title} />
      <Link
        href={`/tasks/${task.number}`}
        className="min-w-0 flex-1 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
        data-today-open
      >
        <span className="block break-words">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.partner_name ? <StatusChip tone="neutral">{task.partner_name}</StatusChip> : null}
          <span className={`font-data text-xs whitespace-nowrap ${overdue ? 'text-danger' : 'text-muted'}`}>
            {formatDate(task.due_on, locale, { dateStyle: 'medium' })}
          </span>
        </span>
      </Link>
    </li>
  );
}
