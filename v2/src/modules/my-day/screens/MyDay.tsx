'use client';
import { BellRing, Hourglass, MessageCircleQuestion, NotebookPen, Plus, Star } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { clip, formatDate } from '@/core/i18n/format';
import { nameOf as personName, type OrgPerson } from '@/modules/org/types';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Tabs } from '@/ui/Tabs';
import { entityRoute } from '@/ui/entity-route';
import { BLOCK_ROWS, helpingTasks, todaysThree } from '../logic';
import { CAPTURE_KINDS, openQuickCapture, type CaptureKind } from '../quick-capture';
import { markReminderDone } from '../reminder-done';
import { laterReminders } from '../today-reminders';
import type { DueAnswer } from '../reminder-alert';
import { SCOPES, type MyDayAnswer, type OpenAsk, type OpenAsks, type PendingReminder, type Scope } from '../types';
import { CaptureShortcut } from './CaptureShortcut';
import { DayBanner } from './DayBanner';
import { card, CardHead, cardLink, emptyInCard, pill } from './look';
import { NoteRow } from './NoteBits';
import { SinceBlock } from './SinceBlock';
import { TodayBlock } from './TodayBlock';
import { TeamStreaks, TodaysThree } from './TodaysThree';
import type { TaskRow, TaskStatus } from '@/modules/tasks/types';
import { WrapUpDialog } from './WrapUpDialog';
import { WeekDoor } from '@/modules/weekly-review/screens/WeekDoor';

export type MyDayData = {
  /** The banner's heading: Riyadh's day, already written (`dayHeading`). */
  title: string;
  /** The banner's count: My work, the Tasks screen's own count for its My work tab; null when it was not read. */
  myWork: number | null;
  scope: Scope;
  answer: MyDayAnswer;
  /** Every note read (`?more=1`) rather than the first block. */
  all: boolean;
  /** The one kind My notes is narrowed to (`?kind=`), if any. */
  kind?: CaptureKind;
  people: OrgPerson[];
  /** The task statuses, so the Today block's tick can say Done. */
  statuses: TaskStatus[];
  /** My reminders whose time has come (`api.reminders_due`); null when it could not be read. */
  due: DueAnswer | null;
  /** The open questions asked to me and the ones I asked (`api.open_asks`); null when it could not be read. */
  asks: OpenAsks | null;
  /** The tasks flagged as needing help and addressed to me (`api.escalated_tasks`); null when it could not be read. */
  escalated: TaskRow[] | null;
  /** FIX-26: the tasks I flagged as needing help (`api.escalated_tasks_by_me`); null when it could not be read. */
  escalatedByMe: TaskRow[] | null;
  /** My closed tasks with no achievement logged (Phase 6): null when the read failed, so the door shows no badge. */
  unlogged: number | null;
};

const tabHref = (s: Scope) => (s === 'me' ? '/my-day' : `/my-day?tab=${s}`);
const kindHref = (k?: CaptureKind) => (k ? `/my-day?kind=${k}` : '/my-day');

/**
 * My day (V433): Capture (Create → Capture, the + or "/"), then Convert. Tabs Me · My team · Workspace; on Me my
 * notes and the reminders waiting; on the other two what my team or everyone shares. Every block draws at most 7 rows and a "more" link. P5-7
 * adds the task, money and KPI blocks here as their data lands.
 */
export function MyDay({ data }: { data: MyDayData }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useWords();
  const { scope, answer, all, kind } = data;
  const [wrapping, setWrapping] = useState(false);
  // "Shared with me": a client-side filter over the already-loaded team rows, not a fourth tab or a new read.
  const [sharedWithMe, setSharedWithMe] = useState(false);
  // Acknowledge a flagged task from the "Waiting on me" section (Phase 5): the flag clears and the person who
  // flagged it is told; the section re-reads with the rest of the page
  const acknowledge = (id: string) =>
    command(
      words(t('pages.tasks.escalate.acknowledged')),
      () => rpc('escalate_acknowledge', { p_id: id }) as Promise<{ request_id?: string | null }>,
    );
  // Where a question's row leads: the record, on its Discussion tab — the answer box lives there, not on this page
  const askHref = (a: OpenAsk) => {
    const base = entityRoute(a.entity, a.entity_id);
    if (!base) return null;
    return a.entity === 'task' || a.entity === 'achievement' || a.entity === 'partner'
      ? `${base}?tab=discussion`
      : base;
  };
  // A person's name in this page's language, from an ask's two name fields
  const askPerson = (en: string | null, ar: string | null) => (locale === 'ar' ? (ar ?? en) : (en ?? ar)) ?? '';
  // Done on a reminder for a later day, as on the alert and in the Today block (W-daily 14): it is put away, Undo brings it back
  const done = (r: PendingReminder) =>
    command(
      words(t('pages.myDay.today.reminderDone', { title: clip(r.text || t('pages.myDay.today.reminder')) })),
      () => markReminderDone({ id: r.id, notification_id: null }),
    );
  // what falls today or is overdue is in the Today block; this block keeps only the reminders for later days
  const later = laterReminders(answer.reminders, answer.day);
  const people = new Map(data.people.map((p) => [p.id, p]));
  // my starred tasks, from the Today list (Phase 5): the star already carries undated tasks there. Mine only — a task I
  // only help on carries its owner's star, which is not mine to set or to chase (it stays in Today's Helping group)
  const starred = (answer.tasks ?? []).filter((task) => task.starred && task.role === 'owner');
  // Today's three (Landing 34): 3 important + 3 short + 3 maintenance of my own tasks sit at the top; the Today block
  // below keeps the rest of mine, grouped as before, and the tasks I only help on
  const three = todaysThree(answer.tasks ?? [], answer.day);
  const belowThree = [...three.rest, ...helpingTasks(answer.tasks ?? [])];
  const authorOf = (id: string) => {
    const p = people.get(id);
    return p ? personName(p, locale) : undefined;
  };
  const baseRows = all ? answer.notes : answer.notes.slice(0, BLOCK_ROWS);
  const rows =
    scope === 'team' && sharedWithMe ? baseRows.filter((n) => n.visibility === 'person' && !n.mine) : baseRows;
  // When the filter is on, the "more" link would drop it (it is client state, not in the address), so it is hidden.
  const more = !sharedWithMe && !all && (answer.more || answer.notes.length > BLOCK_ROWS);
  // A Waiting section with nothing in either of its lists (both read) is one short line, not two headings and two empty
  // sentences: on a phone the two empty cards filled the first screen and pushed Today below it
  const nothingOnMe =
    data.escalated !== null && data.asks !== null && !data.escalated.length && !data.asks.to_me.length;
  const nothingOnOthers =
    data.escalatedByMe !== null && data.asks !== null && !data.escalatedByMe.length && !data.asks.by_me.length;
  const nothingLine = (key: 'onMe' | 'onOthers', marker: Record<string, string>) => (
    <section
      className={cn(card, 'flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3')}
      data-waiting-nothing
      {...marker}
    >
      <h2 className="text-lg font-medium leading-6 text-strong">{t(`pages.myDay.waiting.${key}`)}</h2>
      <p className="text-sm text-muted">{t('pages.myDay.waiting.nothingNow')}</p>
    </section>
  );

  return (
    <>
      <DayBanner heading={data.title} myWork={data.myWork}>
        {scope === 'me' ? (
          <>
            {/* on the banner the quiet button is the white one, whatever the theme's card colour is called */}
            <Button
              className="border-transparent bg-raised text-strong shadow-1"
              onClick={() => setWrapping(true)}
              data-wrap-open
            >
              {t('pages.myDay.wrap.label')}
            </Button>
            {/* Capture sits on the banner from 640 px up (the 15 Nov board); a phone keeps its one add control, the +
                in the bottom bar, as its board draws. It opens the same sheet as Create → Capture and "/". */}
            <Button
              variant="primary"
              icon={<Plus />}
              className="ring-2 ring-raised/75 max-sm:hidden"
              onClick={() => openQuickCapture()}
              data-capture-open
            >
              {t('pages.myDay.banner.capture')}
            </Button>
          </>
        ) : null}
      </DayBanner>
      <Tabs
        label={t('pages.myDay.tabsLabel')}
        value={scope}
        tabs={SCOPES.map((s) => ({ value: s, label: t(`pages.myDay.tabs.${s}`), href: tabHref(s) }))}
      />
      {/* Landing 34: the banner, then Today's three, then the rest — on Me, for everyone who has a My day, tasks or none */}
      {scope === 'me' ? <TodaysThree three={three} statuses={data.statuses} /> : null}
      {/* the manager's view of the team's streaks; nothing at all for someone who manages nobody */}
      {scope === 'team' ? <TeamStreaks /> : null}
      {/* Phase 5, at the top of My day: what waits on me (tasks flagged as needing help, addressed to me, plus the
          open questions asked to me) and what waits on others (the questions I asked). Rows link to the record; the
          answer box lives on the record, in the Discussion tab — there is no inline answer box here. */}
      {scope === 'me' && nothingOnMe ? nothingLine('onMe', { 'data-waiting-on-me': '' }) : null}
      {scope === 'me' && !nothingOnMe ? (
        <section className={cn(card, 'py-1')} data-waiting-on-me>
          <CardHead icon={<MessageCircleQuestion />} title={t('pages.myDay.waiting.onMe')} />
          <h3 className="pt-3 text-sm font-semibold text-muted">{t('pages.myDay.waiting.needHelp')}</h3>
          {data.escalated === null ? (
            <DataState
              kind="failed"
              className="my-2"
              message={t('state.failed', { what: t('pages.myDay.waiting.needHelp') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          ) : data.escalated.length ? (
            <ul className="divide-y divide-border">
              {data.escalated.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                  data-waiting-need-help={r.id}
                >
                  <span className="min-w-0 flex-1">
                    <Link href={`/tasks/${r.number}`} className="break-words text-base font-medium hover:underline">
                      <bdi>{r.title}</bdi>
                    </Link>
                    <span className="block text-sm text-muted">
                      {r.number}
                      {r.escalated_at ? ` · ${formatDate(r.escalated_at, locale, { dateStyle: 'medium' })}` : ''}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto sm:ms-0"
                    onClick={() => void acknowledge(r.id)}
                    data-acknowledge={r.id}
                  >
                    {t('pages.tasks.escalate.acknowledge')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2.5 text-base text-muted">{t('pages.myDay.waiting.emptyNeedHelp')}</p>
          )}
          <h3 className="border-t border-border pt-3 text-sm font-semibold text-muted">
            {t('pages.myDay.waiting.questions')}
          </h3>
          {data.asks === null ? (
            <DataState
              kind="failed"
              className="my-2"
              message={t('state.failed', { what: t('pages.myDay.waiting.questions') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          ) : data.asks.to_me.length ? (
            <ul className="divide-y divide-border">
              {data.asks.to_me.map((a) => {
                const href = askHref(a);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                    data-waiting-ask={a.id}
                  >
                    <span className="min-w-0 flex-1">
                      {href ? (
                        <Link href={href} className="break-words text-base font-medium hover:underline">
                          <bdi>{a.body}</bdi>
                        </Link>
                      ) : (
                        <span className="break-words text-base font-medium">
                          <bdi>{a.body}</bdi>
                        </span>
                      )}
                      <span className="block text-sm text-muted">
                        {[
                          a.record,
                          t('pages.myDay.waiting.askedBy', {
                            name: askPerson(a.author_name, a.author_name_ar),
                          }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2.5 text-base text-muted">{t('pages.myDay.waiting.emptyQuestions')}</p>
          )}
        </section>
      ) : null}
      {scope === 'me' && nothingOnOthers ? nothingLine('onOthers', { 'data-waiting-on-others': '' }) : null}
      {scope === 'me' && !nothingOnOthers ? (
        <section className={cn(card, 'py-1')} data-waiting-on-others>
          <CardHead icon={<Hourglass />} title={t('pages.myDay.waiting.onOthers')} />
          {/* FIX-26 F006: the tasks I flagged as needing help — newest flag first — with no Acknowledge on my
              own flag; the Questions subsection keeps its own empty text (F041). */}
          <h3 className="pt-3 text-sm font-semibold text-muted">{t('pages.myDay.waiting.needHelp')}</h3>
          {data.escalatedByMe === null ? (
            <DataState
              kind="failed"
              className="my-2"
              message={t('state.failed', { what: t('pages.myDay.waiting.needHelp') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          ) : data.escalatedByMe.length ? (
            <ul className="divide-y divide-border">
              {data.escalatedByMe.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                  data-waiting-need-help-by-me={r.id}
                >
                  <span className="min-w-0 flex-1">
                    <Link href={`/tasks/${r.number}`} className="break-words text-base font-medium hover:underline">
                      <bdi>{r.title}</bdi>
                    </Link>
                    <span className="block text-sm text-muted">
                      {r.number}
                      {r.escalated_at ? ` · ${formatDate(r.escalated_at, locale, { dateStyle: 'medium' })}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2.5 text-base text-muted">{t('pages.myDay.waiting.emptyNeedHelpOthers')}</p>
          )}
          <h3 className="border-t border-border pt-3 text-sm font-semibold text-muted">
            {t('pages.myDay.waiting.questions')}
          </h3>
          {data.asks === null ? (
            <DataState
              kind="failed"
              className="my-2"
              message={t('state.failed', { what: t('pages.myDay.waiting.questions') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          ) : data.asks.by_me.length ? (
            <ul className="divide-y divide-border">
              {data.asks.by_me.map((a) => {
                const href = askHref(a);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                    data-waiting-ask={a.id}
                  >
                    <span className="min-w-0 flex-1">
                      {href ? (
                        <Link href={href} className="break-words text-base font-medium hover:underline">
                          <bdi>{a.body}</bdi>
                        </Link>
                      ) : (
                        <span className="break-words text-base font-medium">
                          <bdi>{a.body}</bdi>
                        </span>
                      )}
                      <span className="block text-sm text-muted">
                        {[
                          a.record,
                          t('pages.myDay.waiting.askedTo', {
                            name: askPerson(a.asked_to_name, a.asked_to_name_ar),
                          }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-2.5 text-base text-muted">{t('pages.myDay.waiting.emptyWaitingOnOthers')}</p>
          )}
        </section>
      ) : null}
      {scope === 'me' ? (
        <TodayBlock
          tasks={belowThree}
          day={answer.day}
          statuses={data.statuses}
          carried={answer.carried_over?.length ?? 0}
          pending={answer.reminders}
          due={data.due}
        />
      ) : null}
      {scope === 'me' ? <WeekDoor day={answer.day} unloggedCount={data.unlogged} /> : null}
      {/* Phase 5: my starred tasks, from the Today list — the star already carries undated tasks there. */}
      {scope === 'me' ? (
        <section className={cn(card, 'py-1')} data-starred>
          <CardHead icon={<Star />} title={t('pages.myDay.starred')} />
          {starred.length ? (
            <ul className="divide-y divide-border">
              {starred.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                  data-starred-task={task.id}
                >
                  <span className="min-w-0 flex-1">
                    <Link href={`/tasks/${task.number}`} className="break-words text-base font-medium hover:underline">
                      <bdi>{task.title}</bdi>
                    </Link>
                    <span className="block text-sm text-muted">{task.number}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <DataState kind="empty" className={emptyInCard} icon={<Star />} message={t('pages.tasks.empty.starred')} />
          )}
        </section>
      ) : null}
      {scope === 'me' ? <CaptureShortcut /> : null}
      {/* narrowed to one kind, My notes is the list: the Reminders block would list the same reminders again */}
      {scope === 'me' && !kind && later.length ? (
        <section className={cn(card, 'py-1')} data-reminders>
          <CardHead icon={<BellRing />} title={t('pages.myDay.blocks.reminders')} />
          <ul className="divide-y divide-border">
            {later.slice(0, BLOCK_ROWS).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                data-reminder={r.id}
              >
                {/* on a phone the words and the record's chip take the whole line, the time and Done sit under them */}
                <span className="min-w-0 flex-1 basis-full sm:basis-0">
                  {/* the words and their time stay together on one line; the record's chip has the line under them */}
                  <span className="flex items-baseline gap-3" data-reminder-line>
                    <span className="min-w-0 flex-1">
                      <bdi className="break-words">{r.text}</bdi>
                    </span>
                    <span className="shrink-0 font-data text-xs whitespace-nowrap text-muted">
                      {formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </span>
                  {/* a follow-up says what it is about, as a tag — never in its title (QA-560), only if the reader may see it */}
                  {r.about?.label ? (
                    // the record's name wraps rather than being cut to "Follow up…" on a phone
                    <StatusChip
                      tone="info"
                      className="mt-1 h-auto min-h-6 max-w-full whitespace-normal py-1 leading-snug"
                    >
                      <span className="min-w-0 break-words">
                        {t('pages.myDay.today.followUpAbout', { name: r.about.label })}
                      </span>
                    </StatusChip>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto sm:ms-0"
                  onClick={() => void done(r)}
                  data-reminder-done-later
                >
                  {t('pages.myDay.alert.done')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {scope === 'me' ? <SinceBlock /> : null}
      <section className={cn(card, 'py-1')} data-block={scope}>
        <CardHead icon={<NotebookPen />} title={t(`pages.myDay.blocks.${scope}`)}>
          {all ? (
            <Link href={kind ? kindHref(kind) : tabHref(scope)} className={cardLink} data-block-fewer>
              {t('pages.myDay.fewer')}
            </Link>
          ) : null}
        </CardHead>
        {scope === 'me' ? (
          <nav
            aria-label={t('pages.myDay.kindFilter.label')}
            className="flex flex-wrap gap-2 border-b border-border py-2.5"
            data-kind-filter
          >
            {[undefined, ...CAPTURE_KINDS].map((k) => (
              <Link
                key={k ?? 'all'}
                href={kindHref(k)}
                aria-current={kind === k ? 'true' : undefined}
                // this exact class list is what the tap-size sabotage plant looks for: keep it as it is
                className={cn(
                  'inline-flex min-h-11 items-center rounded-pill sm:min-h-9 border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
                  kind === k ? 'border-accent bg-accent-soft text-text' : 'border-border text-muted hover:bg-surface',
                )}
                data-kind-option={k ?? 'all'}
              >
                {k ? t(`pages.myDay.quick.kinds.${k}`) : t('pages.myDay.kindFilter.all')}
              </Link>
            ))}
          </nav>
        ) : null}
        {scope === 'team' ? (
          <nav
            aria-label={t('pages.myDay.sharedWithMe')}
            className="flex flex-wrap gap-2 border-b border-border py-2.5"
          >
            <button
              type="button"
              aria-pressed={sharedWithMe}
              onClick={() => setSharedWithMe((v) => !v)}
              className={pill(sharedWithMe)}
              data-shared-with-me
            >
              {t('pages.myDay.sharedWithMe')}
            </button>
          </nav>
        ) : null}
        {rows.length ? (
          <ul className="divide-y divide-border" data-block-rows>
            {rows.map((n) => (
              <NoteRow key={n.id} note={n} author={scope === 'me' ? undefined : authorOf(n.author_id)} />
            ))}
          </ul>
        ) : (
          <DataState
            kind="empty"
            className={emptyInCard}
            icon={<NotebookPen />}
            message={kind ? t('pages.myDay.empty.kind') : t(`pages.myDay.empty.${scope}`)}
          />
        )}
        {more ? (
          <div className="border-t border-border py-1">
            <Link
              href={`${kind ? kindHref(kind) : tabHref(scope)}${scope === 'me' && !kind ? '?' : '&'}more=1`}
              className={cardLink}
              data-block-more
            >
              {t('pages.myDay.more')}
            </Link>
          </div>
        ) : null}
      </section>
      {/* FIX-27: a deferred note is reachable here — a list within My day, not a new route. The main list never
          shows it (its day is still ahead), and the kind filter never hides it. */}
      {(answer.deferred?.length ?? 0) > 0 ? (
        <section className={cn(card, 'py-1')} data-block-deferred>
          <CardHead icon={<Hourglass />} title={t('pages.myDay.blocks.deferred')} />
          <ul className="divide-y divide-border" data-block-deferred-rows>
            {answer.deferred!.map((n) => (
              <NoteRow key={n.id} note={n} author={scope === 'me' ? undefined : authorOf(n.author_id)} deferred />
            ))}
          </ul>
        </section>
      ) : null}
      {scope === 'me' ? <WrapUpDialog day={answer.day} open={wrapping} onOpenChange={setWrapping} /> : null}
    </>
  );
}
