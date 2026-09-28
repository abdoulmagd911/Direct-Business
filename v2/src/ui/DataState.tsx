import { Lock, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

export type DataStateKind = 'loading' | 'failed' | 'empty' | 'no-access' | 'not-measured';

/**
 * Every read renders through this (spec §2.4 rule 5). Five distinct states: loading, failed (says
 * which read failed, with Try again — M27/M71), empty (a true zero — one line and its one action),
 * no access (M53) and not measured (M60). A figure that failed is never drawn as 0.
 */
export function DataState({
  kind,
  what,
  message,
  action,
  onRetry,
  retryLabel,
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
        className={cn('flex flex-col gap-3', className)}
      >
        {children ?? (
          <>
            <div className="h-4 w-1/3 animate-pulse rounded-sm bg-border" />
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-border" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-border" />
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
          'flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-base text-text',
          className,
        )}
      >
        <span>{message ?? what}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={onRetry} className="ms-auto">
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }
  if (kind === 'no-access') {
    return (
      <div
        role="status"
        data-state="no-access"
        className={cn(
          'flex items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-3 text-base text-muted',
          className,
        )}
      >
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        <span>{message ?? what}</span>
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
  return (
    <div
      data-state="empty"
      className={cn(
        'flex flex-col items-start gap-3 rounded-md border border-dashed border-border-strong px-4 py-4 text-base text-muted',
        className,
      )}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}
