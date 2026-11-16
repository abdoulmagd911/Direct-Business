'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/ui/cn';
import type { TaskLookups } from '../load';
import type { TaskRow } from '../types';
import { BlockReason } from './BlockReason';
import { CancelReason } from './CancelReason';
import { StatusMenu, statusName } from './StatusControl';
import { CountBadge, DueMark, ResponsibleMark, WhereMark } from './TaskBits';
import { PHONE_COLUMN_CARDS, pillOf, statusGroups } from './look';
import { useNames } from './words';

/**
 * The board (§8 Tasks; the 15 Nov board): one column per status the app has, in the settings' order, plus Blocked
 * after In progress, each with its count (`statusGroups` — the list's groups are the same answer). A card is the
 * task's title, the partner or project it is about, its due day, its Responsible person and ONE status pill; the pill
 * is the status menu that moves the card (no dragging — the same moves the record offers, by mouse or keyboard,
 * Blocked and Cancelled asking for their reason). The board reads the list's rows, so both count the same tasks.
 * Columns stack on a phone, each showing two cards and "See all"; nothing scrolls sideways.
 */
export function TaskBoard({ rows, lookups, today }: { rows: TaskRow[]; lookups: TaskLookups; today: string }) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const columns = statusGroups(rows, lookups.statuses);
  // the columns a phone shows whole (See all); a wide screen always shows every card
  const [whole, setWhole] = useState<string[]>([]);
  return (
    <div
      className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fit,minmax(13.5rem,1fr))]"
      data-task-board
    >
      {columns.map((c) => {
        const title =
          c.kind === 'blocked'
            ? t('pages.tasks.blocked')
            : c.status
              ? statusName(c.status, names.locale)
              : c.rows[0]
                ? names.status(c.rows[0])
                : c.key;
        const open = whole.includes(c.key);
        return (
          <section
            key={`${c.kind}:${c.key}`}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-2 max-sm:p-2.5"
            aria-label={title}
            data-board-column={c.key}
            data-count={c.rows.length}
          >
            <h2 className="flex items-center gap-2 px-1.5 py-1 text-sm font-medium leading-5 text-strong">
              <span className="min-w-0 break-words">{title}</span>
              <CountBadge count={c.rows.length} />
            </h2>
            {c.rows.length ? (
              <ul className="flex flex-col gap-2">
                {c.rows.map((r, i) => {
                  const view = pillOf(r);
                  const label = view === 'blocked' ? t('pages.tasks.blocked') : names.status(r);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        'relative flex flex-col gap-2 rounded-[14px] border border-border bg-raised px-3.5 py-3 shadow-1',
                        i >= PHONE_COLUMN_CARDS && !open && 'max-sm:hidden',
                      )}
                      data-board-card={r.number}
                    >
                      <Link
                        href={`/tasks/${r.number}`}
                        title={r.number}
                        className="line-clamp-2 break-words text-sm font-medium leading-5 text-strong after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {r.title}
                      </Link>
                      <WhereMark row={r} names={names} first />
                      <DueMark row={r} today={today} locale={names.locale} />
                      <BlockReason task={r} />
                      <CancelReason task={r} />
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <ResponsibleMark row={r} lookups={lookups} names={names} className="min-w-24 flex-1" />
                        {/* the ONE pill: above the card's whole-card link, so a tap on it opens the moves */}
                        <span className="relative z-10 shrink-0" data-task-pill={view}>
                          <StatusMenu task={r} statuses={lookups.statuses} label={label} canEdit={r.can_edit} />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-1.5 pb-1 text-sm text-muted">{t('pages.tasks.board.emptyColumn')}</p>
            )}
            {c.rows.length > PHONE_COLUMN_CARDS ? (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setWhole((w) => (open ? w.filter((k) => k !== c.key) : [...w, c.key]))}
                className="inline-flex min-h-11 items-center justify-center rounded-pill px-3 text-sm font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-focus sm:hidden"
                data-board-see-all={c.key}
              >
                {open ? t('pages.tasks.look.seeFewer') : t('pages.tasks.look.seeAll', { count: c.rows.length })}
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
