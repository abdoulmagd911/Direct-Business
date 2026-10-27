'use client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { clip, formatDate } from '@/core/i18n/format';
import { useWords } from '@/modules/partners/screens/record/words';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { DoneTick } from '@/modules/tasks/screens/StatusControl';
import type { TaskStatus } from '@/modules/tasks/types';
import { todayGroups, noteRoute } from '../logic';
import { markReminderDone } from '../reminder-done';
import { todayReminders, type TodayReminder } from '../today-reminders';
import type { DueAnswer } from '../reminder-alert';
import type { PendingReminder, TodayTask } from '../types';

/**
 * The Today block at the top of My day (productivity stage 1): my tasks as Overdue (with its count), Today and Next
 * (the rest of this week). A row is a done tick (Undo comes with it), the title (opens the task), the client and the due
 * day. Stage 2 adds reminders due today or overdue (a tick ends it, in the bell too) and tags a follow-up with the
 * record it is about — named only if this reader may see the record (V454). Nothing due → "Nothing due today".
 */
export function TodayBlock({
  tasks,
  day,
  statuses,
  carried = 0,
  pending = [],
  due,
}: {
  tasks: TodayTask[];
  day: string;
  statuses: TaskStatus[];
  /** What yesterday's wrap-up carried to today and is still open. */
  carried?: number;
  /** My reminders the job has not sent yet (`api.my_day`). */
  pending?: PendingReminder[];
  /** Those whose time has come and are not put away (`api.reminders_due`); null when that could not be read. */
  due: DueAnswer | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const g = todayGroups(tasks, day);
  const rem = todayReminders(pending, due?.due ?? [], day);
  const groups = [
    { key: 'overdue', rows: g.overdue, reminders: rem.overdue },
    { key: 'today', rows: g.today, reminders: rem.today },
    { key: 'next', rows: g.next, reminders: [] as TodayReminder[] },
  ] as const;
  const none = groups.every((x) => !x.rows.length && !x.reminders.length);
  return (
    <section className="rounded-lg border border-border bg-raised px-4 py-2" data-today-block>
      <h2 className="border-b border-border py-2.5 text-base font-semibold">{t('pages.myDay.today.title')}</h2>
      {carried > 0 ? (
        <p className="border-b border-border py-2.5 text-sm text-muted" data-today-carried>
          {t('pages.myDay.today.carried', { count: carried })}
        </p>
      ) : null}
      {due === null ? (
        <DataState
          kind="failed"
          className="my-2"
          message={t('pages.myDay.today.failed')}
          onRetry={() => router.refresh()}
          retryLabel={t('common.tryAgain')}
        />
      ) : null}
      {none ? (
        <DataState kind="empty" message={t('pages.myDay.today.empty')} />
      ) : (
        groups
          .filter((x) => x.rows.length || x.reminders.length)
          .map((x) => (
            <div key={x.key} data-today-group={x.key}>
              {/* the card is titled "Today"; its groups are never titled just that: Overdue · Due today · Next 7 days (QA-564) */}
              <h3 className="pt-3 text-sm font-medium text-muted">
                {t(`pages.myDay.today.${x.key}`)}
                {x.key === 'overdue' ? (
                  <span className="ms-2 font-data text-danger" data-today-overdue-count>
                    {x.rows.length + x.reminders.length}
                  </span>
                ) : null}
              </h3>
              <ul className="divide-y divide-border">
                {x.reminders.map((r) => (
                  <ReminderRow key={r.id} reminder={r} overdue={x.key === 'overdue'} />
                ))}
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

/** A reminder due today or overdue: the tick ends it everywhere; the words open the note it came from. */
function ReminderRow({ reminder: r, overdue }: { reminder: TodayReminder; overdue: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [busy, setBusy] = useState(false);
  const title = r.text || t('pages.myDay.today.reminder');
  const done = async () => {
    setBusy(true);
    await command(words(t('pages.myDay.today.reminderDone', { title: clip(title) })), () => markReminderDone(r));
    setBusy(false);
  };
  const body = (
    <>
      {/* the words and their time stay together on one line; the record's chip has the line under them */}
      <span className="flex items-baseline gap-3" data-reminder-line>
        <span className="min-w-0 flex-1 break-words">{title}</span>
        <span className={`shrink-0 font-data text-xs whitespace-nowrap ${overdue ? 'text-danger' : 'text-muted'}`}>
          {overdue ? formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }) : r.time}
        </span>
      </span>
      {/* the record is a tag, never the title (QA-560), and only when this reader may see it (V454) */}
      <StatusChip tone="info" className="mt-1 h-auto min-h-6 max-w-full whitespace-normal py-1 leading-snug">
        <span className="min-w-0 break-words">
          {r.about?.label
            ? t('pages.myDay.today.followUpAbout', { name: r.about.label })
            : t('pages.myDay.today.reminder')}
        </span>
      </StatusChip>
    </>
  );
  return (
    <li
      className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
      data-today-reminder={r.id}
    >
      <button
        type="button"
        onClick={() => void done()}
        disabled={busy}
        aria-label={t('pages.myDay.today.markDone', { title })}
        data-reminder-done
        className="group relative z-10 -mx-2.5 -mb-2.5 -mt-2 inline-grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full border border-border-strong text-muted group-hover:border-success group-hover:text-success"
        >
          <Check className="size-3.5" />
        </span>
      </button>
      {r.note_id ? (
        <Link
          href={noteRoute(r.note_id)}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
          data-today-open
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
    </li>
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
    <li
      className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
      data-today-task={task.number}
    >
      <DoneTick task={tick} statuses={statuses} title={task.title} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.number}`}
          className="block break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
          data-today-open
        >
          {task.title}
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* the client opens the client, above the row's own link (the read names it only to a reader who may see it) */}
          {task.partner_id && task.partner_name ? (
            <Link href={`/clients/${task.partner_id}`} className="relative z-10" data-today-client>
              <StatusChip tone="neutral">{task.partner_name}</StatusChip>
            </Link>
          ) : null}
          <span className={`font-data text-xs whitespace-nowrap ${overdue ? 'text-danger' : 'text-muted'}`}>
            {formatDate(task.due_on, locale, { dateStyle: 'medium' })}
          </span>
        </span>
      </div>
    </li>
  );
}
