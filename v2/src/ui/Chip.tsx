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
  neutral: 'bg-[color-mix(in_srgb,var(--muted)_12%,transparent)] text-text before:!bg-muted',
};

/** Dot + word on a soft tint. The word always shows — colour never carries the meaning alone. */
export function StatusChip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill pe-2.5 ps-2 text-xs font-medium leading-none before:size-1.5 before:rounded-full before:bg-current',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A filter chip. Dashed = available (click adds it); solid = applied, showing "field: value", its row
 * count and ✕ to drop it (M102/M89).
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
    'inline-flex h-[var(--control-h-sm)] items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-sm transition-colors duration-[var(--dur)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2';
  if (!applied) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={addLabel}
        className={cn(base, 'border-dashed border-border-strong bg-transparent text-muted hover:bg-surface', className)}
      >
        <span aria-hidden="true">+</span> {field}
      </button>
    );
  }
  return (
    <span className={cn(base, 'border-solid border-accent bg-accent-soft pe-1.5 text-text', className)}>
      <b className="font-semibold">{field}:</b> {value}
      {count !== undefined ? <span className="font-data text-xs text-muted">{count}</span> : null}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="relative ms-0.5 inline-grid size-6 place-items-center before:absolute before:-inset-2.5 before:content-[''] rounded-pill hover:bg-[color-mix(in_srgb,var(--text)_10%,transparent)]"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
