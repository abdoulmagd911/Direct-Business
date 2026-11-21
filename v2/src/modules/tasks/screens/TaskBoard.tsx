'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { TaskLookups } from '../load';
import type { TaskRow } from '../types';
import { BlockReason } from './BlockReason';
import { CancelReason } from './CancelReason';
import { StatusMenu, statusName } from './StatusControl';
import { CountBadge, DueMark, ResponsibleMark, WhereMark } from './TaskBits';
import { StarMark } from './StarToggle';
import { pillOf, statusGroups } from './look';
import { useNames } from './words';

/**
 * The board (§8 Tasks; the 15 Nov board; made a real kanban in Landing 35): one column per status the app has, in the
 * settings' order, plus Blocked after In progress, each with its name and count (`statusGroups` — the list's groups
 * are the same answer). The columns stand SIDE BY SIDE in one row at every width — in Arabic from the right — and the
 * row scrolls sideways inside its own frame when they do not fit; the page itself never does. Each column scrolls its
 * own cards up and down under a header that stays, so a long column (Done, Not started) never pushes the others off
 * the screen. On a phone a column is nearly the screen's width and the row snaps to one column at a time.
 *
 * (Before Landing 35 this was a grid that wrapped: one column per row on a phone, two per row to 1024 px, and above
 * that as many as fitted with the rest wrapped UNDER them, every column as tall as all of its cards — status groups
 * one under the other, which read as the list again.)
 *
 * A card is the task's number and star, its title, the partner or project it is about, its due day, its Responsible
 * person and ONE status pill; the pill is the status menu that moves the card (no dragging — the same moves the record
 * offers, by mouse or keyboard, Blocked and Cancelled asking for their reason). The board reads the list's rows, so
 * both count the same tasks.
 */
export function TaskBoard({ rows, lookups, today }: { rows: TaskRow[]; lookups: TaskLookups; today: string }) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const columns = statusGroups(rows, lookups.statuses);
  return (
    <div role="group" aria-label={t('pages.tasks.layout.board')} className={BOARD_FRAME} data-task-board>
      {columns.map((c) => {
        const title =
          c.kind === 'blocked'
            ? t('pages.tasks.blocked')
            : c.status
              ? statusName(c.status, names.locale)
              : c.rows[0]
                ? names.status(c.rows[0])
                : c.key;
        return (
          <section
            key={`${c.kind}:${c.key}`}
            className={BOARD_COLUMN}
            aria-label={title}
            data-board-column={c.key}
            data-count={c.rows.length}
          >
            <h2
              className="flex shrink-0 items-center gap-2 px-1.5 py-1 text-sm font-medium leading-5 text-strong"
              data-board-column-head
            >
              <span className="min-w-0 break-words">{title}</span>
              <CountBadge count={c.rows.length} />
            </h2>
            {c.rows.length ? (
              <ul className={BOARD_CARDS} data-board-cards>
                {c.rows.map((r) => {
                  const view = pillOf(r);
                  const label = view === 'blocked' ? t('pages.tasks.blocked') : names.status(r);
                  return (
                    <li
                      key={r.id}
                      className="relative flex shrink-0 flex-col gap-2 rounded-[14px] border border-border bg-raised px-3.5 py-3 shadow-1"
                      data-board-card={r.number}
                      data-task-id={r.id}
                    >
                      <div className="flex min-h-6 items-center justify-between gap-2">
                        <span
                          className="min-w-0 truncate font-data text-xs leading-4 text-muted"
                          data-board-card-number
                        >
                          {r.number}
                        </span>
                        <StarMark starred={r.starred} />
                      </div>
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
          </section>
        );
      })}
    </div>
  );
}

/**
 * The board's frame: one row of columns that scrolls sideways INSIDE itself (the page never does). On a phone the row
 * snaps to one column at a time; `overscroll-x-contain` keeps a sideways swipe on the board from turning the page back.
 */
export const BOARD_FRAME =
  'flex min-w-0 max-w-full snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-2 sm:snap-none';

/**
 * One column: never narrower than a card needs (15 rem) and sharing the row's spare room on a wide screen; on a phone
 * nearly the screen's width, so the next column shows its edge. It is no taller than the screen has room for — its
 * cards scroll inside it (`BOARD_CARDS`).
 */
export const BOARD_COLUMN =
  'flex max-h-[max(22rem,calc(100dvh-13rem))] w-[calc(100%-2.5rem)] shrink-0 snap-start snap-always flex-col gap-2 rounded-lg border border-border bg-surface p-2 max-sm:p-2.5 sm:w-auto sm:min-w-[15rem] sm:flex-1 sm:basis-0';

/** A column's cards: they scroll up and down inside the column, under its header. */
export const BOARD_CARDS = '-m-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1';
