import type { ReactNode } from 'react';
import { cn } from '../cn';

/** A group of properties in the details rail (V81, V95): a small heading and its fields. */
export function RailSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <dl className="flex flex-col gap-3">{children}</dl>
    </section>
  );
}

/**
 * One property. An empty field is hidden behind its "+ Add" control (V81): pass `empty` and the `add` control (a link
 * or a button the screen owns); the label stays so the field can be found.
 */
export function RailField({
  label,
  children,
  empty = false,
  add,
  className,
}: {
  label: ReactNode;
  children?: ReactNode;
  empty?: boolean;
  add?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)} data-rail-field data-empty={empty || undefined}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-text">{empty ? add : children}</dd>
    </div>
  );
}
