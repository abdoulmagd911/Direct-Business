'use client';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/ui/cn';
import type { TaskLookups } from '../load';
import type { Move } from '../rules';
import type { TaskRow } from '../types';
import { BlockReason } from './BlockReason';
import { CancelReason } from './CancelReason';
import { StatusMenu, statusName, useStatusMove } from './StatusControl';
import { CountBadge, DueMark, ResponsibleMark, StepsMark, WhereMark } from './TaskBits';
import { StarMark } from './StarToggle';
import { useBoardDrag } from './board-drag';
import { dropMove, pillOf, statusGroups, type StatusGroup } from './look';
import { useNames } from './words';

/**
 * The board (§8 Tasks; the 15 Nov board; made a real kanban in Landing 35): one column per status the app has, in the
 * settings' order, plus Blocked after In progress, each with its name and count (`statusGroups` — the list's groups
 * are the same answer). The columns stand SIDE BY SIDE in one row at every width — in Arabic from the right — and the
 * row scrolls sideways inside its own frame when they do not fit; the page itself never does. Each column scrolls its
 * own cards up and down under a header that stays, so a long column (Done, Not started) never pushes the others off
 * the screen. On a phone a column is nearly the screen's width and the row snaps to one column at a time.
 *
 * A card is the task's number and star, its title, the partner or project it is about, its due day, its steps done,
 * its Responsible person and ONE status pill. The board reads the list's rows, so both count the same tasks.
 *
 * Landing 33 (B5): a card is DRAGGED to another column and its status changes — the same move the pill's menu makes,
 * through the same door, with the same questions (Blocked and Cancelled ask their reason; Done asks about open steps)
 * and the same Undo. A mouse drags the card from anywhere; a finger drags it by its grip. The pill's menu stays: it is
 * the way by keyboard, and the way for anyone who would rather not drag. Only someone who may move the task's status
 * (whoever may edit it, or its deputy) can drag its card. Nothing is shown as moved before the database has answered.
 *
 * Landing 47: a card dropped beside a short column — below its box — is taken too (`laneAt` in board-drag.ts), and
 * while a card is carried the columns are drawn the board's full height, so the lane under the card is seen marked.
 */
export function TaskBoard({ rows, lookups, today }: { rows: TaskRow[]; lookups: TaskLookups; today: string }) {
  const t = useTranslations();
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const columns = statusGroups(rows, lookups.statuses);
  // each card hands the board its own "ask this move" (it holds the move's dialogs); a drop calls the dropped card's
  const askers = useRef(new Map<string, (m: Move) => void>());
  const columnsRef = useRef(columns);
  const rowsRef = useRef(rows);
  useEffect(() => {
    columnsRef.current = columns;
    rowsRef.current = rows;
  });
  const onDrop = useCallback((cardId: string, columnKey: string) => {
    const row = rowsRef.current.find((r) => r.id === cardId);
    const column = columnsRef.current.find((c) => c.key === columnKey);
    if (!row || !column) return;
    const move = dropMove(row, column);
    if (move) askers.current.get(cardId)?.(move);
  }, []);
  const { drag, frame, down, clickCapture } = useBoardDrag(onDrop);
  const dragged = drag ? rows.find((r) => r.id === drag.id) : undefined;
  const titleOf = (c: StatusGroup<TaskRow>) =>
    c.kind === 'blocked'
      ? t('pages.tasks.blocked')
      : c.status
        ? statusName(c.status, names.locale)
        : c.rows[0]
          ? names.status(c.rows[0])
          : c.key;
  return (
    <div
      ref={frame}
      role="group"
      aria-label={t('pages.tasks.layout.board')}
      className={cn(BOARD_FRAME, drag && 'select-none')}
      data-task-board
      data-dragging={drag ? drag.id : undefined}
    >
      {columns.map((c) => {
        const title = titleOf(c);
        // a column takes the card only when dropping it there is a move
        const takes = !!dragged && !!dropMove(dragged, c);
        return (
          <section
            key={`${c.kind}:${c.key}`}
            className={cn(
              BOARD_COLUMN,
              // Landing 47: while a card is carried every column stands the board's full height, so a short (empty)
              // column is a lane the eye can see and the card can be dropped into from anywhere beside it
              drag && 'self-stretch',
              drag && drag.over === c.key && takes && 'border-accent bg-accent-soft outline-2 outline-accent',
            )}
            aria-label={title}
            data-board-column={c.key}
            data-board-key={c.key}
            data-count={c.rows.length}
            data-drop-target={drag && drag.over === c.key && takes ? '' : undefined}
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
                {c.rows.map((r) => (
                  <BoardCard
                    key={r.id}
                    row={r}
                    column={c.key}
                    lookups={lookups}
                    names={names}
                    today={today}
                    lifted={drag?.id === r.id}
                    down={down}
                    clickCapture={clickCapture}
                    askers={askers}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-1.5 pb-1 text-sm text-muted">{t('pages.tasks.board.emptyColumn')}</p>
            )}
          </section>
        );
      })}
      {drag ? (
        // the card being carried: its title follows the pointer; it takes no pointer events, so the column under it is found
        <div
          className="pointer-events-none fixed z-50 max-w-[15rem] -translate-x-1/2 -translate-y-1/2 rotate-2 truncate rounded-[14px] border border-border-strong bg-raised px-3.5 py-3 text-sm font-medium text-strong shadow-2"
          // check-allow: no-physical-css — the pointer's clientX is a physical coordinate, the same in Arabic
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
          data-board-ghost
        >
          {drag.label}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {drag ? t('pages.tasks.board.dragging', { title: drag.label }) : ''}
      </p>
    </div>
  );
}

function BoardCard({
  row: r,
  column,
  lookups,
  names,
  today,
  lifted,
  down,
  clickCapture,
  askers,
}: {
  row: TaskRow;
  column: string;
  lookups: TaskLookups;
  names: ReturnType<typeof useNames>;
  today: string;
  lifted: boolean;
  down: ReturnType<typeof useBoardDrag>['down'];
  clickCapture: ReturnType<typeof useBoardDrag>['clickCapture'];
  askers: React.RefObject<Map<string, (m: Move) => void>>;
}) {
  const t = useTranslations();
  const view = pillOf(r);
  const label = view === 'blocked' ? t('pages.tasks.blocked') : names.status(r);
  const mayAct = r.can_act ?? r.can_edit;
  const move = useStatusMove(r, lookups.statuses);
  const choose = move.choose;
  useEffect(() => {
    if (!mayAct) return;
    const map = askers.current;
    map.set(r.id, (m) => void choose(m));
    return () => {
      map.delete(r.id);
    };
  });
  const card = { id: r.id, label: r.title, column };
  return (
    <li
      className={cn(
        'relative flex shrink-0 flex-col gap-2 rounded-[14px] border border-border bg-raised px-3.5 py-3 shadow-1',
        mayAct && 'cursor-grab',
        lifted && 'opacity-40',
      )}
      data-board-card={r.number}
      data-task-id={r.id}
      data-draggable={mayAct ? '' : undefined}
      onPointerDown={mayAct ? down(card) : undefined}
      onClickCapture={clickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="min-w-0 truncate font-data text-xs leading-4 text-muted" data-board-card-number>
          {r.number}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <StarMark starred={r.starred} />
          {mayAct ? (
            // the grip: where a finger picks the card up (it gives up scrolling); a mouse may use it too. Not a tab
            // stop — by keyboard the status pill's menu makes the same moves.
            <span
              role="img"
              aria-label={t('pages.tasks.board.grip', { title: r.title })}
              title={t('pages.tasks.board.gripHint')}
              className="relative z-10 -my-2.5 -me-2.5 inline-flex size-11 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text"
              onPointerDown={down(card, true)}
              data-board-grip
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </div>
      <Link
        href={`/tasks/${r.number}`}
        title={r.number}
        draggable={false}
        className="line-clamp-2 break-words text-sm font-medium leading-5 text-strong after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-focus"
      >
        {r.title}
      </Link>
      <WhereMark row={r} names={names} first />
      <DueMark row={r} today={today} locale={names.locale} />
      <StepsMark row={r} locale={names.locale} />
      <BlockReason task={r} />
      <CancelReason task={r} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ResponsibleMark row={r} lookups={lookups} names={names} className="min-w-24 flex-1" />
        {/* the ONE pill: above the card's whole-card link, so a tap on it opens the moves */}
        <span className="relative z-10 shrink-0" data-task-pill={view} data-no-drag>
          <StatusMenu task={r} statuses={lookups.statuses} label={label} canEdit={mayAct} />
        </span>
      </div>
      {mayAct ? move.dialogs : null}
    </li>
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
