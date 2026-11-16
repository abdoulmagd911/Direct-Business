'use client';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const tones: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  // the grey pill's own pair; its colour is named through the variable because `text-neutral` reads as a stock palette name
  neutral: 'bg-neutral-soft text-[color:var(--neutral)]',
};

/** A status pill (V21): 24 px, 600 12 px, its tone's colour on that tone's soft ground. The word always shows — colour
 *  never carries the meaning alone. */
export function StatusChip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold leading-4 [&_svg]:size-3.5 [&_svg]:shrink-0',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A filter chip (V21): 34 px, the field line. Dashed = available (click adds it); applied it is the selection colour,
 * showing "field: value", its row count and ✕ to drop it (M102/M89). The ✕ keeps its small look inside a 44 px tap area.
 */
export function FilterChip({
  field,
  value,
  count,
  onRemove,
  onClick,
  removeLabel,
  addLabel,
  className,
}: {
  field: ReactNode;
  value?: ReactNode;
  count?: number;
  onRemove?: () => void;
  onClick?: () => void;
  removeLabel?: string;
  addLabel?: string;
  className?: string;
}) {
  const applied = value !== undefined;
  const base =
    'inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 max-sm:h-11 text-sm font-medium leading-[18px] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2';
  if (!applied) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={addLabel}
        className={cn(
          base,
          'border-dashed border-border-strong bg-raised text-text hover:bg-surface active:bg-pressed',
          className,
        )}
      >
        <span aria-hidden="true">+</span> {field}
      </button>
    );
  }
  return (
    <span className={cn(base, 'border-solid border-sel bg-sel pe-1.5 text-on-sel', className)}>
      <b className="font-semibold">{field}:</b> {value}
      {count !== undefined ? <span className="font-data text-xs opacity-80">{count}</span> : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="hit-44 ms-0.5 inline-grid size-6 place-items-center rounded-pill hover:bg-[color-mix(in_srgb,currentColor_18%,transparent)] focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
