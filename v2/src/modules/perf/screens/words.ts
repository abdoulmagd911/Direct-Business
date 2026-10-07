'use client';
import { useTranslations } from 'next-intl';
import type { CommandWords } from '@/core/commands/run';

/**
 * The words of an achievements command: the done line, Undo, and a refusal in words — the achievements' own line
 * (`pages.achievements.errors.<key>`) when there is one, else the app's (`errors.<key>`, then the kind's).
 */
export function useCommandWords(): (done: string) => CommandWords {
  const t = useTranslations();
  const own = (k: string) => `pages.achievements.${k}`;
  return (done) => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(own(k)) || t.has(k),
    failed: (k, d) => (t.has(own(k)) ? t(own(k), { detail: d }) : t(k, { detail: d })),
  });
}
