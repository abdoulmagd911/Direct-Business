import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type EntityKind =
  | 'partner'
  | 'invoice'
  | 'task'
  | 'achievement'
  | 'kpi'
  | 'reportLine'
  | 'person'
  | 'project'
  | 'report'
  | 'file';

const dot: Record<EntityKind, string> = {
  partner: 'bg-c1',
  invoice: 'bg-c2',
  project: 'bg-c3',
  kpi: 'bg-c4',
  achievement: 'bg-c5',
  report: 'bg-c6',
  reportLine: 'bg-c6',
  task: 'bg-accent',
  person: 'bg-c3',
  file: 'bg-muted',
};

/**
 * Every entity shown anywhere is a link to its own record (V11). Three looks:
 *  - `name`: a name in running text, link colour;
 *  - `title`: a title in a list, text colour with a light underline;
 *  - `chip`: an ID in mono inside an entity chip, with the entity's colour dot.
 * `data-entity` lets the UI-entity-links walk find plain-text entities that forgot this component.
 */
export function EntityLink({
  kind,
  href,
  children,
  id,
  variant = 'name',
  className,
}: {
  kind: EntityKind;
  href: string;
  children: ReactNode;
  /** The record's number/ID, shown in mono inside a chip. */
  id?: string;
  variant?: 'name' | 'title' | 'chip';
  className?: string;
}) {
  if (variant === 'chip') {
    return (
      <Link
        href={href}
        data-entity={kind}
        className={cn(
          'inline-flex h-[30px] items-center gap-2 whitespace-nowrap rounded-md border border-border bg-raised px-2.5 text-sm font-medium text-link hover:border-border-strong',
          className,
        )}
      >
        <i className={cn('size-2 shrink-0 rounded-[2px]', dot[kind])} aria-hidden="true" />
        {children}
        {id ? <em className="font-data text-xs font-normal not-italic text-muted">{id}</em> : null}
      </Link>
    );
  }
  if (variant === 'title') {
    return (
      <Link
        href={href}
        data-entity={kind}
        className={cn(
          'font-semibold text-text underline decoration-[color-mix(in_srgb,var(--text)_28%,transparent)] underline-offset-[3px] hover:decoration-current',
          className,
        )}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} data-entity={kind} className={cn('font-medium text-link hover:underline', className)}>
      {children}
    </Link>
  );
}
