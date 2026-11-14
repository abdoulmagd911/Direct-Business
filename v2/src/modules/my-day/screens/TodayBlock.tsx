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
import { PhoneFilter } from '@/ui/PhoneFilter';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { DoneTick } from '@/modules/tasks/screens/StatusControl';
import { StarMark, StarToggle } from '@/modules/tasks/screens/StarToggle';
import type { TaskStatus } from '@/modules/tasks/types';
import {
  BLOCK_ROWS,
  FIXED_TASK_VIEWS,
  TASK_GROUPS,
  TODAY_BOXES,
  capRows,
  helpingTasks,
  noteRoute,
  readTaskView,
  todayBoxes,
  type TaskGroup,
} from '../logic';
import { markReminderDone } from '../reminder-done';
import { whenChip } from './WhenPicker';
import { laterReminders, todayReminders, type TodayReminder } from '../today-reminders';
import type { DueAnswer } from '../reminder-alert';
import type { PendingReminder, TodayTask } from '../types';

/**
 * The Today block at the top of My day: the reminders that are due (a tick ends one, in the bell too; a follow-up names the
 * record it is about only if this reader may see it, V454), then my tasks in the four boxes of V661 — Do now, Plan it, Quick
 * or hand off, Later, by the importance star and the due day — then the tasks I only help on. A task row is a done tick (Undo
 * comes with it), the title (opens the task), the client, the due day and the star (44 px; one tap sets or clears it).
 * Nothing due → "Nothing due today".
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
  const boxes = todayBoxes(tasks, day);
  const rem = todayReminders(pending, due?.due ?? [], day);
  // reminders first (a due note is not a task: no star, no box — WRK-161), then V661's four boxes, then the tasks I only help on
  type Group = { key: TaskGroup; rows: TodayTask[]; reminders: TodayReminder[] };
  const all: Group[] = [
    { key: 'reminders', rows: [], reminders: [...rem.overdue, ...rem.today] },
    ...TODAY_BOXES.map((k): Group => ({ key: k, rows: boxes[k], reminders: [] })),
    { key: 'helping', rows: helpingTasks(tasks), reminders: [] },
  ];
  const overdueReminders = new Set(rem.overdue.map((r) => r.id));
  // the groups drawn (P5-7): none chosen means all of them; a fixed or saved view sets them, a chip changes them
  const [shown, setShown] = useState<TaskGroup[]>([]);
  const [view, setView] = useState('all');
  const groups = all.filter((x) => !shown.length || shown.includes(x.key));
  const none = groups.every((x) => !x.rows.length && !x.reminders.length);
  // a block draws 5–7 rows, then "Show all" (V433): the first seven of what the chips leave
  const [all7, setAll7] = useState(false);
  const total = groups.reduce((n, x) => n + x.rows.length + x.reminders.length, 0);
  const cut = total > BLOCK_ROWS;
  const drawn =
    cut && !all7
      ? capRows(groups, BLOCK_ROWS)
      : groups.map((x) => ({ ...x, total: x.rows.length + x.reminders.length }));
  const count = (k: TaskGroup) =>
    all.find((x) => x.key === k)!.rows.length +
    all.find((x) => x.key === k)!.reminders.length +
    // FIX-27 (F-B1-08): the Reminders chip counts every reminder My day lists — the Today block's overdue and
    // today's, and the Reminders section's later-day ones below. Before, it counted today only, so it read
    // "Reminders 0" while a later-day reminder was listed on the page.
    (k === 'reminders' ? laterReminders(pending, day).length : 0);
  const open = (v: { key: string; query?: Record<string, unknown> }) => {
    setView(v.key);
    setShown(
      v.key in FIXED_TASK_VIEWS ? FIXED_TASK_VIEWS[v.key as keyof typeof FIXED_TASK_VIEWS] : readTaskView(v.query),
    );
  };
  const toggle = (k: TaskGroup) => {
    setView('');
    setShown((cur) =>
      cur.includes(k) ? cur.filter((x) => x !== k) : TASK_GROUPS.filter((x) => x === k || cur.includes(x)),
    );
  };
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
      {/* P5-7: saved views of the block and a chip per group; none pressed shows all four */}
      <div className="flex flex-col gap-2 py-3" data-today-views>
        <SavedViewsBar
          page="my_day"
          fixed={[{ key: 'all', label: t('pages.myDay.today.views.all') }]}
          current={view}
          query={{ groups: shown }}
          onOpen={open}
          onDefault={open}
          canShare={false}
          saveHint={t('pages.myDay.today.saveHint')}
        />
        {/* the chips are a filter, not buttons that do something: the word says so, and a count sits in each */}
        {/* on a phone the chips fold behind one Filter button, as on the Tasks page (V630); PC draws them as before */}
        <div className="flex flex-wrap items-center gap-2" data-today-filter>
          <PhoneFilter label={t('common.filter')} count={shown.length}>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t('pages.myDay.today.filter')}
              data-today-chips
            >
              <span className="text-sm text-muted" data-today-filter-label>
                {t('pages.myDay.today.filter')}
              </span>
              {TASK_GROUPS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={shown.includes(k)}
                  onClick={() => toggle(k)}
                  className={whenChip(shown.includes(k))}
                  data-today-chip={k}
                >
                  {t(`pages.myDay.today.${k}`)} <span className="ms-1.5 font-data text-xs">{count(k)}</span>
                </button>
              ))}
            </div>
          </PhoneFilter>
        </div>
      </div>
      {none ? (
        <DataState kind="empty" message={t('pages.myDay.today.empty')} />
      ) : (
        drawn
          .filter((x) => x.rows.length || x.reminders.length)
          .map((x) => (
            <div key={x.key} data-today-group={x.key}>
              {/* the card is titled "Today"; its groups are never titled just that (QA-564): Do now · Plan it · Quick or hand off · Later (V661) */}
              <h3 className="pt-3 text-sm font-medium text-muted">
                {t(`pages.myDay.today.${x.key}`)}
                <span className="ms-2 font-data" data-today-count>
                  {x.total}
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {x.reminders.map((r) => (
                  <ReminderRow key={r.id} reminder={r} overdue={overdueReminders.has(r.id)} />
                ))}
                {x.rows.map((r) => (
                  <TodayRow key={r.id} task={r} statuses={statuses} helping={x.key === 'helping'} />
                ))}
              </ul>
            </div>
          ))
      )}
      {cut ? (
        <div className="border-t border-border py-2.5">
          <button
            type="button"
            onClick={() => setAll7((v) => !v)}
            aria-expanded={all7}
            className="text-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            data-today-more
          >
            {all7 ? t('pages.myDay.today.showFewer') : t('pages.myDay.today.showAll', { count: total })}
          </button>
        </div>
      ) : null}
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
    // one block that stacks its two parts: the words and their time, then the record's chip under them
    <span className="flex min-w-0 flex-col">
      {/* the words and their time stay together on one line; the record's chip has the line under them */}
      <span className="flex items-baseline gap-3" data-reminder-line>
        <span className="min-w-0 flex-1 break-words">
          <bdi>{title}</bdi>
        </span>
        <span className={`shrink-0 font-data text-xs whitespace-nowrap ${overdue ? 'text-danger' : 'text-muted'}`}>
          {overdue ? formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' }) : r.time}
        </span>
      </span>
      {/* the record is a tag, never the title (QA-560), and only when this reader may see it (V454) */}
      <StatusChip tone="info" className="mt-1 h-auto min-h-6 max-w-full self-start whitespace-normal py-1 leading-snug">
        <span className="min-w-0 break-words">
          {r.about?.label
            ? t('pages.myDay.today.followUpAbout', { name: r.about.label })
            : t('pages.myDay.today.reminder')}
        </span>
      </StatusChip>
    </span>
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

function TodayRow({
  task,
  statuses,
  helping = false,
}: {
  task: TodayTask;
  statuses: TaskStatus[];
  /** A task I only help on: it is not mine to finish, so no done tick (P5-7). */
  helping?: boolean;
}) {
  const locale = useLocale() as 'en' | 'ar';
  // overdue is the red day on the row; the heading no longer says it (V661: the boxes replace Overdue · Due today · Next 7 days)
  const overdue = task.group === 'overdue';
  const tick = {
    id: task.id,
    number: task.number,
    title: task.title,
    status: '',
    meaning: 'not_started',
    blocked_reason: null,
    // The real open-item count, from the Today read — the stub's 0 sent Done straight through and the
    // database refused it, so the tick looked refused instead of asking about the open items first.
    open_action_items: task.open_action_items ?? 0,
  } as unknown as Parameters<typeof DoneTick>[0]['task'];
  return (
    <li
      className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
      data-today-task={task.number}
    >
      {helping ? null : <DoneTick task={tick} statuses={statuses} title={task.title} />}
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.number}`}
          className="block break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
          data-today-open
        >
          <bdi>{task.title}</bdi>
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* the client opens the client, above the row's own link (the read names it only to a reader who may see it) */}
          {task.partner_id && task.partner_name ? (
            <Link href={`/partners/${task.partner_id}`} className="relative z-10" data-today-client>
              <StatusChip tone="neutral">
                <bdi>{task.partner_name}</bdi>
              </StatusChip>
            </Link>
          ) : null}
          {/* a starred task may have no due day (V661): then no day is shown */}
          {task.due_on ? (
            <span className={`font-data text-xs whitespace-nowrap ${overdue ? 'text-danger' : 'text-muted'}`}>
              {formatDate(task.due_on, locale, { dateStyle: 'medium' })}
            </span>
          ) : null}
        </span>
      </div>
      {/* the importance star (V661): a 44 px tap for whoever may change the task, a plain mark for one who only helps */}
      {helping ? (
        <StarMark starred={!!task.starred} />
      ) : (
        <StarToggle
          id={task.id}
          door="task_star"
          starred={!!task.starred}
          title={task.title}
          number={task.number}
          className="-me-2.5 -mt-2 -mb-2.5"
        />
      )}
    </li>
  );
}
