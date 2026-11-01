'use client';
import { useTranslations } from 'next-intl';
import type { TaskRow } from '../types';

/**
 * The reason a task was cancelled, on its board card: a cancelled task's card
 * itself says "Cancelled: <why>", wrapped in full and never cut, mirroring
 * BlockReason. Nothing for a task that is not cancelled.
 */
export function CancelReason({ task }: { task: Pick<TaskRow, 'meaning' | 'cancelled_reason'> }) {
  const t = useTranslations();
  if (task.meaning !== 'cancelled' || !task.cancelled_reason) return null;
  return (
    <p className="break-words text-sm text-text [overflow-wrap:anywhere]" data-board-cancel-reason>
      <span className="font-medium">{t('pages.tasks.board.cancelledLabel')}</span> <span>{task.cancelled_reason}</span>
    </p>
  );
}
