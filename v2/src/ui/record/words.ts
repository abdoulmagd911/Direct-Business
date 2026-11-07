'use client';
import { useTranslations } from 'next-intl';
import type { CommandWords } from '@/core/commands/run';

/**
 * The words of a command on a record (not one module's): the done line, Undo, and a refusal in words — the app's
 * own line (`errors.<key>`) when there is one, else the kind's. The server names its refusals (comment.*,
 * access.needs_level), so a record screen needs no module of its own to say them.
 */
export function useCommandWords(): (done: string) => CommandWords {
  const t = useTranslations();
  return (done) => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    undoing: t('common.undoing'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  });
}
