import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Page header: breadcrumb, H1, one primary button, up to two secondary; the rest go to a ⋯ menu.
 * No page titles in the top bar (spec §2.5).
 */
export function PageHeader({
  crumbs,
  title,
  meta,
  actions,
  className,
}: {
  crumbs?: { label: ReactNode; href?: string }[];
  title: ReactNode;
  /** One line under the title, in data terms (a date, counts) — never a hint. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {crumbs?.length ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="inline-flex min-h-6 items-center hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-3xl md:text-[27px]">{title}</h1>
        {meta ? <p className="text-base text-muted">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
