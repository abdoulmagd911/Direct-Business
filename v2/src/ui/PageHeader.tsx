import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Page header: breadcrumb, H1 (Readex 600 30/38; 24/32 on a phone), one primary button, up to two secondary; the
 * rest go to a ⋯ menu.
 * No page titles in the top bar (spec §2.5). The trail is named in the language on screen (`data-crumbs` marks it).
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
  const t = useTranslations('common');
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {crumbs?.length ? (
          <nav
            aria-label={t('breadcrumb')}
            className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted"
            data-crumbs
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="inline-flex min-h-6 items-center hover:underline max-sm:min-h-11">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="min-w-0 break-words text-3xl leading-[38px] max-sm:text-2xl max-sm:leading-8">{title}</h1>
        {meta ? <p className="text-base leading-[22px] text-muted">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
