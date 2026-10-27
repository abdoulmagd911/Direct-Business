'use client';
import { useTranslations } from 'next-intl';
import { statusView } from '../rules';
import type { TaskRow } from '../types';

/**
 * The reason a task is blocked, on its board card (26 Oct): a blocked task sits in its In progress column, so the card
 * itself says "Blocked: <why>", wrapped in full and never cut. Nothing for a task that is not blocked.
 */
export function BlockReason({ task }: { task: Pick<TaskRow, 'meaning' | 'blocked_reason'> }) {
  const t = useTranslations();
  if (statusView(task) !== 'blocked' || !task.blocked_reason) return null;
  return (
    <p className="break-words text-sm text-text [overflow-wrap:anywhere]" data-board-block-reason>
      <span className="font-medium text-danger">{t('pages.tasks.board.blockedLabel')}</span>{' '}
      <span>{task.blocked_reason}</span>
    </p>
  );
}
