import { Inbox, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { buttonVariants } from './button-variants';
import { cn } from './cn';

export type DataStateKind = 'loading' | 'failed' | 'empty' | 'no-access' | 'not-measured';

/**
 * Every read renders through this (spec §2.4 rule 5). Five distinct states: loading, failed (says
 * which read failed, with Try again — M27/M71 — as a callback, or as a link `action` when the caller is a server
 * page that cannot pass one, FIX-28), empty (a true zero — one line and its one action),
 * no access (M53) and not measured (M60). A figure that failed is never drawn as 0.
 * The look (V21): loading is soft pill bars with a shimmer, shown only once loading has taken 400 ms; empty is a card
 * with a 48 px icon circle, its one line and its one action, 56 px of room above and below (`compact` keeps it to a
 * short row, for an empty list inside a card that is already drawn); a whole-page no access is a card that says so
 * with the way back.
 */
export function DataState({
  kind,
  what,
  message,
  action,
  onRetry,
  retryLabel,
  goHome,
  icon,
  compact = false,
  className,
  children,
}: {
  kind: DataStateKind;
  /** What was being read, for the failed and no-access lines. */
  what?: string;
  /** The one sentence for empty/failed/no-access, already translated. */
  message?: string;
  action?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** A whole-page no-access state (W40): the label of the button that goes back to My day. */
  goHome?: string;
  /** The line icon in the empty state's circle; an inbox when none is named. */
  icon?: ReactNode;
  /** The empty state as a short row, without the circle and the room: inside a card or a panel. */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  if (kind === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-state="loading"
        className={cn('show-late flex flex-col gap-3', className)}
      >
        {children ?? (
          <>
            <div className="shimmer h-4 w-1/3 rounded-pill bg-pressed" />
            <div className="shimmer h-4 w-2/3 rounded-pill bg-pressed" />
            <div className="shimmer h-4 w-1/2 rounded-pill bg-pressed" />
          </>
        )}
        <span className="sr-only">{message}</span>
      </div>
    );
  }
  if (kind === 'failed') {
    return (
      <div
        role="alert"
        data-state="failed"
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-base text-text',
          className,
        )}
      >
        <span>{message ?? what}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={onRetry} className="ms-auto">
            {retryLabel}
          </Button>
        ) : null}
        {/* FIX-28: a server page cannot pass a retry callback — it passes a link instead (the same address, read
            again), rendered beside the button above. A failed read never shows without one of the two. */}
        {action}
      </div>
    );
  }
  if (kind === 'no-access') {
    return (
      <div
        role="status"
        data-state="no-access"
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-raised px-4 py-3 text-base text-muted',
          // a whole page that is closed to this person: a card of its own, with the way back
          goHome && 'max-w-[560px] gap-4 p-6 text-strong shadow-1 sm:p-10',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="inline-grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink"
        >
          <Lock className="size-4" />
        </span>
        <span className="min-w-0 flex-1 basis-40">{message ?? what}</span>
        {goHome ? (
          <Link href="/my-day" className={cn(buttonVariants({ size: 'sm' }), 'ms-auto')} data-no-access-home>
            {goHome}
          </Link>
        ) : null}
      </div>
    );
  }
  if (kind === 'not-measured') {
    return (
      <span data-state="not-measured" className={cn('inline-flex items-baseline gap-1.5 text-muted', className)}>
        <span className="font-display text-2xl font-semibold">—</span>
        <span className="text-sm">{message}</span>
      </span>
    );
  }
  if (compact) {
    return (
      <div
        data-state="empty"
        className={cn(
          'flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong px-4 py-4 text-base text-muted',
          className,
        )}
      >
        <span>{message}</span>
        {action}
      </div>
    );
  }
  return (
    <div
      data-state="empty"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-raised px-6 py-14 text-center text-base text-muted shadow-1 max-sm:px-4 max-sm:py-10',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-grid size-12 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink [&_svg]:size-6"
      >
        {icon ?? <Inbox />}
      </span>
      <span className="font-display text-lg font-medium leading-6 text-strong">{message}</span>
      {action}
    </div>
  );
}
