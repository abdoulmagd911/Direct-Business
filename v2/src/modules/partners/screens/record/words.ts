'use client';
import { useTranslations } from 'next-intl';
import type { CommandWords } from '@/core/commands/command';

/** The command words every dialog on the organisation record shares. */
export function useWords() {
  const t = useTranslations();
  return (done: string): CommandWords => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  });
}

export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
