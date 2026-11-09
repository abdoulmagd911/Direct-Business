'use client';
import { CalendarCheck, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { StatusChip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { cn } from '@/ui/cn';
import { readWeekDoorDismissed, weekDoorKey, writeWeekDoorDismissed } from '@/core/prefs/week-door';
import { isReviewDay, weekStartOf } from '../logic';

/**
 * The door to the weekly review on My day's Me tab (QA-557): one whole-row link, no menu entry (V633). On Thursday in
 * Riyadh it is marked as review day — an outline and a chip, never a second filled button beside Wrap up (V630).
 * Phase 6: the badge counts my closed tasks with no achievement logged from them, and stays until the count reaches
 * zero (not Thursday-only) — the bell and this badge are the only prompts; the badge is the single door in.
 * FIX-29 F029 (D23): the door is dismissible — the × hides it until next week, kept in this browser only; the
 * review stays one tap away at /my-day/week.
 */
export function WeekDoor({ day, unloggedCount }: { day: string; unloggedCount?: number | null }) {
  const t = useTranslations();
  const thursday = isReviewDay(day);
  const count = unloggedCount ?? 0;
  const key = weekDoorKey(weekStartOf(day));
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDismissed(readWeekDoorDismissed(key)));
  }, [key]);
  if (dismissed) return null;
  const dismiss = () => {
    writeWeekDoorDismissed(key);
    setDismissed(true);
  };
  return (
    <div
      className={cn(
        'flex items-center rounded-lg border bg-raised',
        thursday ? 'border-primary border-2' : 'border-border',
      )}
    >
      <Link
        href="/my-day/week"
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-4 py-2 focus-visible:outline-2 focus-visible:outline-focus"
        data-week-door
        data-week-door-thursday={thursday ? 'true' : 'false'}
      >
        <CalendarCheck className="size-5 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-medium">{t('pages.weeklyReview.title')}</span>
        {count > 0 ? (
          <span
            className="rounded-full bg-primary px-2 py-0.5 font-data text-xs font-semibold text-on-primary"
            data-week-door-unlogged={count}
            aria-label={t('pages.weeklyReview.nudge.count', { count })}
          >
            {count}
          </span>
        ) : null}
        {thursday ? <StatusChip tone="info">{t('pages.weeklyReview.reviewDay')}</StatusChip> : null}
        <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
      </Link>
      <IconButton
        size="sm"
        label={t('pages.weeklyReview.dismiss')}
        icon={<X />}
        onClick={dismiss}
        className="me-2 shrink-0"
        data-week-door-dismiss
      />
    </div>
  );
}
