'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { formatDate } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import type { TaskLookups } from '../load';
import { boardColumns, dueState, statusView } from '../rules';
import type { TaskRow } from '../types';
import { StatusMenu, statusName } from './StatusControl';
import { useNames } from './words';

/**
 * The board (§8 Tasks): one column per status, in the settings' order, each with its count. A card is the task's title,
 * number, owner and due day; its status menu moves it (no dragging — the same moves the record offers, Blocked asking
 * for its reason). The board reads the list's rows, so both count the same tasks. At 390 px the columns stack.
 */
export function TaskBoard({ rows, lookups, today }: { rows: TaskRow[]; lookups: TaskLookups; today: string }) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const columns = boardColumns(rows, lookups.statuses);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-task-board>
      {columns.map((c) => {
        const title = c.status ? statusName(c.status, names.locale) : c.rows[0] ? names.status(c.rows[0]) : c.key;
        return (
          <section
            key={c.key}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3"
            aria-label={title}
            data-board-column={c.key}
            data-count={c.rows.length}
          >
            <h2 className="flex items-baseline justify-between gap-2 text-base font-semibold">
              <span className="break-words">{title}</span>
              <span className="font-data text-sm font-normal text-muted">{c.rows.length}</span>
            </h2>
            {c.rows.length ? (
              <ul className="flex flex-col gap-2">
                {c.rows.map((r) => {
                  const due = dueState(r, today);
                  const view = statusView(r);
                  const label = view === 'blocked' ? t('pages.tasks.blocked') : names.status(r);
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1.5 rounded-md border border-border bg-raised px-3 py-2.5"
                      data-board-card={r.number}
                    >
                      <Link
                        href={`/tasks/${r.number}`}
                        className="break-words text-base font-medium text-text hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {r.title}
                      </Link>
                      <p className="break-words text-sm text-muted">
                        <span className="font-data">{r.number}</span>
                        {` · ${names.person(r.owner_id)}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusMenu task={r} statuses={lookups.statuses} label={label} canEdit={r.can_edit} />
                        {r.due_on ? (
                          <span
                            className={cn(
                              'text-sm text-muted',
                              due === 'overdue' && 'font-medium text-danger',
                              due === 'today' && 'text-text',
                            )}
                          >
                            {due === 'today'
                              ? t('pages.tasks.dueToday')
                              : t('pages.tasks.dueOn', { date: formatDate(r.due_on, names.locale) })}
                          </span>
                        ) : null}
                        {due === 'overdue' ? <StatusChip tone="danger">{t('status.overdue')}</StatusChip> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('pages.tasks.board.emptyColumn')}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
