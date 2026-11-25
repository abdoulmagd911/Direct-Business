'use client';
import {
  BellRing,
  Check,
  ClipboardCheck,
  File,
  FileText,
  Forward,
  ListTodo,
  MapPin,
  Phone,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { command } from '@/core/commands/command';
import { readRestView, writeRestView } from '@/core/prefs/rest-view';
import { clip, formatDate } from '@/core/i18n/format';
import { useWords } from '@/modules/partners/screens/record/words';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { PhoneFilter } from '@/ui/PhoneFilter';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { DoneTick } from '@/modules/tasks/screens/StatusControl';
import { StarMark, StarToggle } from '@/modules/tasks/screens/StarToggle';
import type { TaskStatus } from '@/modules/tasks/types';
import {
  BLOCK_ROWS,
  FIXED_TASK_VIEWS,
  REST_VIEWS,
  TASK_GROUPS,
  TODAY_BOXES,
  capRows,
  helpingTasks,
  noteRoute,
  readTaskView,
  restByKind,
  todayBoxes,
  type RestView,
  type TaskGroup,
} from '../logic';
import { markReminderDone } from '../reminder-done';
import { card, CardHead, cardLink, emptyInCard, groupHead, pill } from './look';
import { laterReminders, todayReminders, type TodayReminder } from '../today-reminders';
import type { DueAnswer } from '../reminder-alert';
import type { PendingReminder, TodayTask } from '../types';

/** The small icon beside a kind's name (the boards); a type the catalog does not know takes the list icon. */
const KIND_ICONS: Record<string, LucideIcon> = {
  reminders: BellRing,
  meeting: Users,
  call: Phone,
  follow_up: Forward,
  request: ClipboardCheck,
  report: FileText,
  document: File,
  site_visit: MapPin,
};
/** An arrow points the way the page reads: mirrored in Arabic (Batch 2 of the boards). */
const MIRRORED = new Set(['follow_up']);

/**
 * The Today block at the top of My day: the reminders that are due (a tick ends one, in the bell too; a follow-up names the
 * record it is about only if this reader may see it, V454), then my tasks in the four boxes of V661 — Do now, Plan it, Quick
 * or hand off, Later, by the importance star and the due day — then the tasks I only help on. A task row is a done tick (Undo
 * comes with it), the title (opens the task), the client, the due day and the star (44 px; one tap sets or clears it).
 * Nothing due → "Nothing due today".
 *
 * Landing 53 (the boards of the design session): on My day the block is "The rest of today (N)" and opens grouped BY
 * KIND — Meetings, Calls, Follow-ups … each task under its own type from Settings, a follow-up reminder with the
 * Follow-ups and marked "Only me" — in two columns on a wide screen and one card on a phone. One small switch turns it
 * to BY PRIORITY: the four boxes above, with their saved views and chips, exactly as before (V514 (4): the boxes are a
 * sort a person may choose, never the default). The choice is remembered in this browser.
 */
export function TodayBlock({
  tasks,
  day,
  statuses,
  carried = 0,
  pending = [],
  due,
  initialView = 'priority',
}: {
  /** How the block opens: My day passes `kind`; on its own it is the four boxes. */
  initialView?: RestView;
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
  const locale = useLocale() as 'en' | 'ar';
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
  // by kind or by priority: My day opens by kind; a person's own choice, kept in this browser, wins once read
  const [mode, setMode] = useState<RestView>(initialView);
  useEffect(() => {
    if (initialView !== 'kind') return;
    // read after the first paint, as the week door does: the server cannot know this browser's choice
    queueMicrotask(() => {
      const kept = readRestView(REST_VIEWS);
      if (kept) setMode(kept);
    });
  }, [initialView]);
  const choose = (v: RestView) => {
    setMode(v);
    writeRestView(v);
  };
  const byKind = mode === 'kind';
  const kinds = restByKind(tasks, [...rem.overdue, ...rem.today]);
  const everything = all.reduce((n, x) => n + x.rows.length + x.reminders.length, 0);
  const kindCut = kinds.some((k) => k.rows.length + k.reminders.length > BLOCK_ROWS);
  const kindName = (k: (typeof kinds)[number]) =>
    k.key === 'reminders'
      ? t('pages.myDay.today.reminders')
      : t.has(`pages.myDay.kinds.task.${k.key}`)
        ? t(`pages.myDay.kinds.task.${k.key}`)
        : ((locale === 'ar' ? (k.name_ar ?? k.name_en) : (k.name_en ?? k.name_ar)) ??
          t('pages.myDay.kinds.task.other'));
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
  // By priority: the four boxes with their saved views and chips, as the block has drawn them since V661.
  const priority = (
    <>
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
                  className={pill(shown.includes(k))}
                  data-today-chip={k}
                >
                  {t(`pages.myDay.today.${k}`)} <span className="ms-1 font-data text-xs">{count(k)}</span>
                </button>
              ))}
            </div>
          </PhoneFilter>
        </div>
      </div>
      {none ? (
        <DataState kind="empty" className={emptyInCard} icon={<Sun />} message={t('pages.myDay.today.empty')} />
      ) : (
        drawn
          .filter((x) => x.rows.length || x.reminders.length)
          .map((x) => (
            <div key={x.key} data-today-group={x.key}>
              {/* the card is titled "Today"; its groups are never titled just that (QA-564): Do now · Plan it · Quick or hand off · Later (V661) */}
              <h3 className={groupHead}>
                {/* a real space between the name and its count, not a margin alone: read as text (a copy, a screen
                    reader, a narrow phone line) it said "Quick or pass to someone3" (Landing 34, item 15) */}
                {t(`pages.myDay.today.${x.key}`)}{' '}
                <span className="ms-1 font-data" data-today-count>
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
        <div className="border-t border-border py-1">
          <button
            type="button"
            onClick={() => setAll7((v) => !v)}
            aria-expanded={all7}
            className={cardLink}
            data-today-more
          >
            {all7 ? t('pages.myDay.today.showFewer') : t('pages.myDay.today.showAll', { count: total })}
          </button>
        </div>
      ) : null}
    </>
  );
  return (
    <section
      className={cn(card, 'py-1', byKind && 'lg:border-0 lg:bg-transparent lg:px-0 lg:shadow-none')}
      data-today-block
      data-rest-view={mode}
    >
      {initialView === 'kind' ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3',
            byKind && 'lg:border-0 lg:pb-4 lg:pt-0',
          )}
        >
          <h2 className="min-w-0 flex-1 text-lg font-semibold leading-6 text-strong lg:text-xl lg:leading-7">
            {t('pages.myDay.today.rest')}{' '}
            <span className="font-data text-base font-medium text-muted" data-rest-count>
              ({everything})
            </span>
          </h2>
          {/* the one switch: by kind (the board) or by priority (the four boxes) */}
          <div
            role="group"
            aria-label={t('pages.myDay.today.groupBy')}
            className="flex shrink-0 items-center gap-1 rounded-pill bg-surface p-1"
            data-rest-switch
          >
            {REST_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={mode === v}
                onClick={() => choose(v)}
                className={cn(
                  'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus sm:min-h-8',
                  mode === v ? 'bg-raised font-semibold text-strong shadow-tab' : 'text-muted hover:text-strong',
                )}
                data-rest-view-option={v}
              >
                {t(`pages.myDay.today.view.${v}`)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CardHead icon={<Sun />} title={t('pages.myDay.today.title')} />
      )}
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
      {byKind ? (
        everything === 0 ? (
          <DataState
            kind="empty"
            className={cn(emptyInCard, 'lg:rounded-lg lg:border lg:border-border lg:bg-raised lg:shadow-1')}
            icon={<Sun />}
            message={t('pages.myDay.today.empty')}
          />
        ) : (
          // two columns of small cards on a wide screen, packed like a page of print; one card on a phone
          <div className="lg:columns-2 lg:gap-4" data-rest-kinds>
            {kinds.map((k) => {
              const count = k.rows.length + k.reminders.length;
              const reminders = all7 ? k.reminders : k.reminders.slice(0, BLOCK_ROWS);
              const rows = all7 ? k.rows : k.rows.slice(0, Math.max(BLOCK_ROWS - reminders.length, 0));
              const KindIcon = KIND_ICONS[k.key] ?? ListTodo;
              return (
                <div
                  key={k.key}
                  className="break-inside-avoid lg:mb-4 lg:rounded-lg lg:border lg:border-border lg:bg-raised lg:px-5 lg:pb-1 lg:shadow-1"
                  data-rest-kind={k.key}
                >
                  <h3 className="flex items-baseline gap-x-2 pt-4 pb-1 text-base font-semibold text-strong">
                    <KindIcon
                      aria-hidden="true"
                      className={cn(
                        'size-4 shrink-0 self-center text-accent-ink',
                        MIRRORED.has(k.key) && locale === 'ar' && '-scale-x-100',
                      )}
                      data-kind-icon={k.key}
                    />
                    <span>{kindName(k)}</span>{' '}
                    <span className="font-data text-sm font-medium text-muted" data-rest-kind-count>
                      {count}
                    </span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {reminders.map((r) => (
                      <ReminderRow key={r.id} reminder={r} overdue={overdueReminders.has(r.id)} onlyMe />
                    ))}
                    {rows.map((r) => (
                      <TodayRow
                        key={r.id}
                        task={r}
                        statuses={statuses}
                        helping={r.role === 'helper' || r.group === 'helping'}
                        kindTag={false}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      ) : null}
      {byKind && kindCut ? (
        <div className="py-1 max-lg:border-t max-lg:border-border">
          <button
            type="button"
            onClick={() => setAll7((v) => !v)}
            aria-expanded={all7}
            className={cardLink}
            data-rest-more
          >
            {all7 ? t('pages.myDay.today.showFewer') : t('pages.myDay.today.showAll', { count: everything })}
          </button>
        </div>
      ) : null}
      {byKind ? null : priority}
    </section>
  );
}

/** A reminder due today or overdue: the tick ends it everywhere; the words open the note it came from. */
function ReminderRow({
  reminder: r,
  overdue,
  onlyMe = false,
}: {
  reminder: TodayReminder;
  overdue: boolean;
  /** Drawn by kind: a reminder is its owner's alone, and the row says so ("Only me"), as the board does. */
  onlyMe?: boolean;
}) {
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
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusChip tone="info" className="h-auto min-h-6 max-w-full whitespace-normal py-1 leading-snug">
          <span className="min-w-0 break-words">
            {r.about?.label
              ? t('pages.myDay.today.followUpAbout', { name: r.about.label })
              : t('pages.myDay.today.reminder')}
          </span>
        </StatusChip>
        {onlyMe ? (
          <StatusChip tone="neutral" className="shrink-0">
            <span data-only-me>{t('pages.myDay.visibility.private')}</span>
          </StatusChip>
        ) : null}
      </span>
    </span>
  );
  return (
    <li
      className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)] max-sm:min-h-14"
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

/** One task's row: the Today block's, and the same row in Today's three (so the tick, the star and the title behave as one). */
export function TodayRow({
  task,
  statuses,
  helping = false,
  three = false,
  kindTag = true,
}: {
  /** The row says its kind in a tag; off where the row already sits under its kind's heading. */
  kindTag?: boolean;
  task: TodayTask;
  statuses: TaskStatus[];
  /** A task I only help on: it is not mine to finish, so no done tick (P5-7). */
  helping?: boolean;
  /** Drawn in Today's three: the row carries that section's own mark too. */
  three?: boolean;
}) {
  const locale = useLocale() as 'en' | 'ar';
  // overdue is the red day on the row; the heading no longer says it (V661: the boxes replace Overdue · Due today · Next 7 days)
  const overdue = task.group === 'overdue' && !task.done;
  const kind = (locale === 'ar' ? (task.type_ar ?? task.type_en) : (task.type_en ?? task.type_ar)) ?? null;
  const tick = {
    id: task.id,
    number: task.number,
    title: task.title,
    status: '',
    // a task finished today keeps its place in Today's three, ticked (Landing 53)
    meaning: task.done ? 'done' : 'not_started',
    blocked_reason: null,
    // The real open-item count, from the Today read — the stub's 0 sent Done straight through and the
    // database refused it, so the tick looked refused instead of asking about the open items first.
    open_action_items: task.open_action_items ?? 0,
  } as unknown as Parameters<typeof DoneTick>[0]['task'];
  return (
    <li
      // on a phone every task row is the full width and at least 56 px tall (the boards)
      className="relative flex items-start gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)] max-sm:min-h-14"
      data-today-task={task.number}
      {...(three ? { 'data-three-row': task.number } : {})}
      {...(task.done ? { 'data-row-done': '' } : {})}
    >
      {helping ? null : <DoneTick task={tick} statuses={statuses} title={task.title} />}
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks/${task.number}`}
          className={cn(
            "block break-words after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-focus",
            task.done && 'text-muted line-through',
          )}
          data-today-open
        >
          <bdi>{task.title}</bdi>
        </Link>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 empty:hidden">
          {/* the task's kind: its own type from Settings, as a tag (the boards) */}
          {kindTag && kind ? (
            <StatusChip tone="info" className="max-w-full">
              <bdi className="truncate" data-row-kind={task.type ?? ''}>
                {kind}
              </bdi>
            </StatusChip>
          ) : null}
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
      {helping || task.done ? (
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
