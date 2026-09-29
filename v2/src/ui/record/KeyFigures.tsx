import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '../cn';

/** One of a record's key figures (V95): a label, a value in words or a number already formatted, an optional unit. */
export type KeyFigure = {
  key: string;
  label: ReactNode;
  /** Null draws "not measured" — never a dash that could be read as zero (§2.5). */
  value: string | null;
  unit?: string;
  href?: string;
  /** The line under the value, in data terms (a date, a comparison). */
  note?: ReactNode;
};

/**
 * Up to five key figures in one row (V95). The record header, the hover card and the phone card draw the same list,
 * so one component. Numbers in the display face; the unit and note muted; a figure links when it has somewhere to go.
 */
export function KeyFigures({
  figures,
  notMeasured,
  size = 'md',
  className,
}: {
  figures: KeyFigure[];
  notMeasured: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const shown = figures.slice(0, 5);
  if (!shown.length) return null;
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3',
        size === 'md' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-3',
        className,
      )}
      data-key-figures
    >
      {shown.map((f) => {
        const body = (
          <>
            <dt className={cn('truncate text-muted', size === 'md' ? 'text-sm' : 'text-xs')}>{f.label}</dt>
            <dd className="flex items-baseline gap-1">
              <span
                className={cn(
                  'font-display font-semibold tabular-nums',
                  size === 'md' ? 'text-2xl' : 'text-base',
                  f.value === null && 'text-base font-normal text-muted',
                )}
              >
                {f.value ?? notMeasured}
              </span>
              {f.value !== null && f.unit ? (
                <span className={cn('font-data text-muted', size === 'md' ? 'text-sm' : 'text-xs')}>{f.unit}</span>
              ) : null}
            </dd>
            {f.note && size === 'md' ? <dd className="text-xs text-muted">{f.note}</dd> : null}
          </>
        );
        return f.href ? (
          <Link
            key={f.key}
            href={f.href}
            className="min-w-0 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {body}
          </Link>
        ) : (
          <div key={f.key} className="min-w-0">
            {body}
          </div>
        );
      })}
    </dl>
  );
}
