import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

/** A group of properties in the details rail (V81, V95): a small heading and its fields. */
export function RailSection({
  title,
  children,
  className,
  plain = false,
  footer,
  ...rest
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  /** A section of lists and buttons rather than fields: no <dl> (a <dl> may hold only term–definition pairs). */
  plain?: boolean;
  /** A control after the fields (an "Add" button), outside the <dl>. */
  footer?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'title' | 'children' | 'className'>) {
  return (
    <section className={cn('flex flex-col gap-3', className)} {...rest}>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {plain ? (
        <div className="flex flex-col gap-3">{children}</div>
      ) : (
        <dl className="flex flex-col gap-3">{children}</dl>
      )}
      {footer}
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
