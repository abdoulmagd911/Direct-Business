'use client';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { command, type Written } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { cn } from '@/ui/cn';
import { useCommandWords } from './words';

/**
 * The importance star (V661, V514 (1)) on a task or on a task's checklist line: one tap sets it, one tap clears it, each one
 * a logged request with Undo (D7). A tap target of 44 px (V654). It is a button only for who may change the task; the
 * database decides, and a refusal is said in words. `mark` is the sentence read by a screen reader, e.g. the task's title.
 */
export function StarToggle({
  id,
  door,
  starred,
  title,
  number,
  className,
}: {
  id: string;
  /** The door that sets the star: a task's, or a checklist line's. */
  door: 'task_star' | 'action_item_star';
  starred: boolean;
  /** What is starred, for the done line and the screen reader. */
  title: string;
  number: string;
  className?: string;
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const [on, setOn] = useState(starred);
  const [seen, setSeen] = useState(starred);
  const [busy, setBusy] = useState(false);
  // a star set elsewhere (Undo, another tab) is drawn when the screen reads it again
  if (starred !== seen) {
    setSeen(starred);
    setOn(starred);
  }
  const next = !on;
  const press = async () => {
    setBusy(true);
    await command(
      words(t(next ? 'pages.tasks.star.marked' : 'pages.tasks.star.unmarked', { number })),
      () => rpc(door, { p_id: id, p_starred: next }) as Promise<Written>,
      { after: () => setOn(next) },
    );
    setBusy(false);
  };
  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy}
      aria-pressed={on}
      aria-label={t(on ? 'pages.tasks.star.unmark' : 'pages.tasks.star.mark', { title })}
      title={t(on ? 'pages.tasks.star.unmarkHint' : 'pages.tasks.star.markHint')}
      data-star={on ? 'on' : 'off'}
      className={cn(
        'group relative z-10 inline-grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50',
        className,
      )}
    >
      <Star
        aria-hidden="true"
        className={cn('size-5', on ? 'fill-current text-warning' : 'text-muted group-hover:text-text')}
      />
    </button>
  );
}

/** The star of a task one only helps on: shown when set, not changed from here (it is not theirs to change). */
export function StarMark({ starred }: { starred: boolean }) {
  const t = useTranslations();
  if (!starred) return null;
  return (
    <span
      className="inline-grid size-6 shrink-0 place-items-center"
      data-star="mark"
      title={t('pages.tasks.star.important')}
    >
      <Star aria-hidden="true" className="size-4 fill-current text-warning" />
      <span className="sr-only">{t('pages.tasks.star.important')}</span>
    </span>
  );
}
