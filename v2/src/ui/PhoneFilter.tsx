'use client';
import { SlidersHorizontal } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A list's search and filter chips, folded behind ONE "Filter" button on a phone (V630: nothing crowded). The button
 * shows how many filters are on; it opens the controls just below it, in place. From 640 px the controls sit in the
 * row as ever (`contents`) and the button is not drawn. The controls are one copy in the page, not two.
 */
export function PhoneFilter({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        data-filter-toggle
        className="inline-flex h-[var(--control-h)] items-center gap-2 rounded-md border border-border-strong bg-raised px-3.5 text-base font-medium text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {label}
        {count > 0 ? (
          <span
            data-filter-count
            className="grid min-w-5 place-items-center rounded-pill bg-accent-soft px-1.5 font-data text-xs text-text"
          >
            {count}
          </span>
        ) : null}
      </button>
      <div
        id={id}
        data-filter-panel
        className={cn(
          'contents',
          open
            ? 'max-sm:order-last max-sm:flex max-sm:w-full max-sm:flex-wrap max-sm:items-center max-sm:gap-2'
            : 'max-sm:hidden',
        )}
      >
        {children}
      </div>
    </>
  );
}
