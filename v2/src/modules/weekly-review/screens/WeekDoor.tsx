'use client';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/ui/Chip';
import { cn } from '@/ui/cn';
import { isReviewDay } from '../logic';

/**
 * The door to the weekly review on My day's Me tab (QA-557): one whole-row link, no menu entry (V633). On Thursday in
 * Riyadh it is marked as review day — an outline and a chip, never a second filled button beside Wrap up (V630).
 */
export function WeekDoor({ day }: { day: string }) {
  const t = useTranslations();
  const thursday = isReviewDay(day);
  return (
    <Link
      href="/my-day/week"
      className={cn(
        'flex min-h-12 items-center gap-3 rounded-lg border bg-raised px-4 py-2 focus-visible:outline-2 focus-visible:outline-focus',
        thursday ? 'border-primary border-2' : 'border-border',
      )}
      data-week-door
      data-week-door-thursday={thursday ? 'true' : 'false'}
    >
      <CalendarCheck className="size-5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">{t('pages.weeklyReview.title')}</span>
      {thursday ? <StatusChip tone="info">{t('pages.weeklyReview.reviewDay')}</StatusChip> : null}
      <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
}
