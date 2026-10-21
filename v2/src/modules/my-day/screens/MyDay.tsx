'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { clip, formatDate } from '@/core/i18n/format';
import { nameOf as personName, type OrgPerson } from '@/modules/org/types';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { BLOCK_ROWS } from '../logic';
import { CAPTURE_KINDS, type CaptureKind } from '../quick-capture';
import { markReminderDone } from '../reminder-done';
import { laterReminders } from '../today-reminders';
import type { DueAnswer } from '../reminder-alert';
import { SCOPES, type MyDayAnswer, type PendingReminder, type Scope } from '../types';
import { CaptureShortcut } from './CaptureShortcut';
import { NoteRow } from './NoteBits';
import { SinceBlock } from './SinceBlock';
import { TodayBlock } from './TodayBlock';
import type { TaskStatus } from '@/modules/tasks/types';
import { WrapUpDialog } from './WrapUpDialog';
import { WeekDoor } from '@/modules/weekly-review/screens/WeekDoor';

export type MyDayData = {
  title: string;
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
  const words = useWords();
  const { scope, answer, all, kind } = data;
  const [wrapping, setWrapping] = useState(false);
  // Done on a reminder for a later day, as on the alert and in the Today block (W-daily 14): it is put away, Undo brings it back
  const done = (r: PendingReminder) =>
    command(
      words(t('pages.myDay.today.reminderDone', { title: clip(r.text || t('pages.myDay.today.reminder')) })),
      () => markReminderDone({ id: r.id, notification_id: null }),
    );
  // what falls today or is overdue is in the Today block; this block keeps only the reminders for later days
  const later = laterReminders(answer.reminders, answer.day);
  const people = new Map(data.people.map((p) => [p.id, p]));
  const authorOf = (id: string) => {
    const p = people.get(id);
    return p ? personName(p, locale) : undefined;
  };
  const rows = all ? answer.notes : answer.notes.slice(0, BLOCK_ROWS);
  const more = !all && (answer.more || answer.notes.length > BLOCK_ROWS);

  return (
    <>
      <PageHeader
        title={data.title}
        actions={
          scope === 'me' ? (
            <Button onClick={() => setWrapping(true)} data-wrap-open>
              {t('pages.myDay.wrap.label')}
            </Button>
          ) : null
        }
      />
      <Tabs
        label={t('pages.myDay.tabsLabel')}
        value={scope}
        tabs={SCOPES.map((s) => ({ value: s, label: t(`pages.myDay.tabs.${s}`), href: tabHref(s) }))}
      />
      {scope === 'me' ? (
        <TodayBlock
          tasks={answer.tasks ?? []}
          day={answer.day}
          statuses={data.statuses}
          carried={answer.carried_over?.length ?? 0}
          pending={answer.reminders}
          due={data.due}
        />
      ) : null}
      {scope === 'me' ? <WeekDoor day={answer.day} /> : null}
      {scope === 'me' ? <CaptureShortcut /> : null}
      {scope === 'me' && later.length ? (
        <section className="rounded-lg border border-border bg-raised px-4 py-2" data-reminders>
          <h2 className="border-b border-border py-2.5 text-base font-semibold">{t('pages.myDay.blocks.reminders')}</h2>
          <ul className="divide-y divide-border">
            {later.slice(0, BLOCK_ROWS).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
                data-reminder={r.id}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{r.text}</span>
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
                <span className="shrink-0 font-data text-xs whitespace-nowrap text-muted">
                  {formatDate(r.remind_at, locale, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <Button size="sm" variant="ghost" onClick={() => void done(r)} data-reminder-done-later>
                  {t('pages.myDay.alert.done')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {scope === 'me' ? <SinceBlock /> : null}
      <section className="rounded-lg border border-border bg-raised px-4 py-2" data-block={scope}>
        <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
          <h2 className="text-base font-semibold">{t(`pages.myDay.blocks.${scope}`)}</h2>
          {all ? (
            <Link
              href={kind ? kindHref(kind) : tabHref(scope)}
              className="text-sm text-link hover:underline"
              data-block-fewer
            >
              {t('pages.myDay.fewer')}
            </Link>
          ) : null}
        </div>
        {scope === 'me' ? (
          <nav
            aria-label={t('pages.myDay.kindFilter.label')}
            className="flex flex-wrap gap-1.5 border-b border-border py-2.5"
            data-kind-filter
          >
            {[undefined, ...CAPTURE_KINDS].map((k) => (
              <Link
                key={k ?? 'all'}
                href={kindHref(k)}
                aria-current={kind === k ? 'true' : undefined}
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
        {rows.length ? (
          <ul className="divide-y divide-border" data-block-rows>
            {rows.map((n) => (
              <NoteRow key={n.id} note={n} author={scope === 'me' ? undefined : authorOf(n.author_id)} />
            ))}
          </ul>
        ) : (
          <DataState kind="empty" message={kind ? t('pages.myDay.empty.kind') : t(`pages.myDay.empty.${scope}`)} />
        )}
        {more ? (
          <div className="border-t border-border py-2.5">
            <Link
              href={`${kind ? kindHref(kind) : tabHref(scope)}${scope === 'me' && !kind ? '?' : '&'}more=1`}
              className="text-sm text-link hover:underline"
              data-block-more
            >
              {t('pages.myDay.more')}
            </Link>
          </div>
        ) : null}
      </section>
      {scope === 'me' ? <WrapUpDialog day={answer.day} open={wrapping} onOpenChange={setWrapping} /> : null}
    </>
  );
}
