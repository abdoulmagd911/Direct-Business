'use client';
import { Check, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useMaybeMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { clip } from '@/core/i18n/format';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { cn } from '@/ui/cn';
import { STATUS_TONE, planMove, statusMoves, statusView, type Move } from '../rules';
import type { TaskRow, TaskStatus } from '../types';
import { useCommandWords } from './words';

type Task = Pick<TaskRow, 'id' | 'number' | 'title' | 'status' | 'meaning' | 'blocked_reason' | 'open_action_items'>;

/**
 * One status move, asked the way V401 and V191 say: Blocked asks its reason; Done with open action items asks whether
 * to close them too. Every move is one request through api.task_status_set, with Undo.
 */
export function useStatusMove(task: Task, statuses: TaskStatus[]) {
  const t = useTranslations();
  const locale = useLocale();
  const words = useCommandWords();
  const router = useRouter();
  const canLog = ['own', 'full'].includes(useMaybeMe()?.levels.kpis ?? 'none');
  const [blocking, setBlocking] = useState(false);
  const [closing, setClosing] = useState<{ move: Move; count: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (
    args: { p_status: string; p_reason?: string; p_close_items?: boolean },
    done: string,
    finished = false,
  ) => {
    setBusy(true);
    await command(
      words(done),
      () =>
        rpc('task_status_set', { p_id: task.id, ...args }) as Promise<{
          request_id?: string | null;
        }>,
      // Done (never Cancelled) offers the achievement beside Undo, pre-filled with the task's title; a refused move has
      // no toast to carry it (the Architect's ask of 16 Oct, V384)
      finished && canLog
        ? {
            extra: {
              label: t('pages.achievements.offerAction'),
              onClick: () => router.push(`/kpis/achievements/new?title=${encodeURIComponent(clip(task.title, 300))}`),
            },
          }
        : {},
    );
    setBusy(false);
  };
  const doneLine = (move: Move) =>
    move.kind === 'block'
      ? t('pages.tasks.status.blockedLine', { title: clip(task.title), number: task.number })
      : t('pages.tasks.status.movedLine', {
          title: clip(task.title),
          number: task.number,
          status: statusName(move.status, locale),
        });

  const choose = async (move: Move, answers: { reason?: string; closeItems?: boolean } = {}) => {
    const plan = planMove(task, move, statuses, answers);
    if ('ask' in plan) {
      if (plan.ask === 'reason') setBlocking(true);
      else setClosing({ move, count: plan.count });
      return;
    }
    if ('refuse' in plan) return;
    await send(plan.go, doneLine(move), move.kind === 'status' && move.status.meaning === 'done');
  };
  const doneStatus = statuses.find((s) => s.meaning === 'done' && s.active);

  const dialogs: ReactNode = (
    <>
      <ReasonDialog
        open={blocking}
        onOpenChange={setBlocking}
        title={t('pages.tasks.status.blockTitle', { number: task.number })}
        body={task.title}
        words={{
          reason: t('pages.tasks.status.blockReason'),
          save: t('pages.tasks.status.block'),
          cancel: t('common.cancel'),
          reasonRequired: t('pages.tasks.status.reasonRequired'),
        }}
        onSave={async (reason) => {
          await choose({ kind: 'block' }, { reason });
          setBlocking(false);
        }}
      />
      <Confirm
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title={t('pages.tasks.status.closeItemsTitle', { count: closing?.count ?? 0, number: task.number })}
        body={t('pages.tasks.status.closeItemsBody')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('pages.tasks.status.closeItems')}
        destructive={false}
        busy={busy}
        onConfirm={async () => {
          if (closing) await choose(closing.move, { closeItems: true });
          setClosing(null);
        }}
      />
    </>
  );
  return {
    busy,
    dialogs,
    moves: statusMoves(task, statuses),
    choose,
    markDone: doneStatus ? () => choose({ kind: 'status', status: doneStatus }) : null,
  };
}

/** The status chip and its menu of moves (the record's header, the list on a desk). */
export function StatusMenu({
  task,
  statuses,
  label,
  canEdit,
}: {
  task: Task;
  statuses: TaskStatus[];
  label: string;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const move = useStatusMove(task, statuses);
  const view = statusView(task);
  const chip = (
    <StatusChip tone={STATUS_TONE[view]} className={canEdit ? 'pe-1.5' : undefined}>
      {label}
      {canEdit ? <ChevronDown className="size-3.5" aria-hidden="true" /> : null}
    </StatusChip>
  );
  if (!canEdit) return <span data-task-status={view}>{chip}</span>;
  return (
    <>
      <Menu>
        <MenuTrigger
          className="relative rounded-pill before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-focus"
          aria-label={t('pages.tasks.status.change', { status: label })}
          data-task-status={view}
          disabled={move.busy}
        >
          {chip}
        </MenuTrigger>
        <MenuContent align="start">
          {move.moves.map((m) => (
            <MenuItem
              key={m.kind === 'block' ? 'blocked' : m.status.key}
              onSelect={() => void move.choose(m)}
              data-move={m.kind === 'block' ? 'blocked' : m.status.meaning}
            >
              {m.kind === 'block' ? t('pages.tasks.blocked') : statusName(m.status, locale)}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {move.dialogs}
    </>
  );
}

/** A status is said by the name an admin gave it, in the language on screen (V401: names editable). */
export const statusName = (s: Pick<TaskStatus, 'name_en' | 'name_ar'>, locale: string) =>
  locale === 'ar' && s.name_ar ? s.name_ar : s.name_en;

/** The round tick on a list row: Done in one tap (V509's "tick one off"), asking first when items are open. */
export function DoneTick({ task, statuses, title }: { task: Task; statuses: TaskStatus[]; title: string }) {
  const t = useTranslations();
  const move = useStatusMove(task, statuses);
  const closed = task.meaning === 'done' || task.meaning === 'cancelled';
  if (!move.markDone || closed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 inline-grid size-6 shrink-0 place-items-center rounded-full border border-border-strong',
          task.meaning === 'done' && 'border-success bg-success-soft text-success',
        )}
      >
        {task.meaning === 'done' ? <Check className="size-3.5" /> : null}
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void move.markDone?.()}
        disabled={move.busy}
        aria-label={t('pages.tasks.markDone', { title })}
        data-done-tick
        className="group relative z-10 -mx-2.5 -mb-2.5 -mt-2 inline-grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full border border-border-strong text-muted group-hover:border-success group-hover:text-success"
        >
          <Check className="size-3.5" />
        </span>
      </button>
      {move.dialogs}
    </>
  );
}
