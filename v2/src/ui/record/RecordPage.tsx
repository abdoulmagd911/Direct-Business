import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { ClampedTitle } from './ClampedTitle';
import { Tabs, type TabDef } from '../Tabs';
import { PageFrame } from '../shell/AppShell';
import { KeyFigures, type KeyFigure } from './KeyFigures';

export type RecordTab = { key: string; label: ReactNode; count?: number };

/**
 * The one record page (V95, reshaping V81): a header with the record's avatar or logo, name, one line of data under it,
 * status chips, up to five key figures and the main actions; ONE tab row — Overview · Activity · Related · the type's
 * own tab — with its state in the URL (`?tab=`); then two columns: the main work (up to 960 px) and the details rail
 * (300 px) holding every property, empty ones behind "+ Add". Under 1,024 px the rail follows the main column; on a
 * phone the page is full screen with a back arrow (V85). Every record type draws itself through this component. The
 * page that renders it has already awaited the gate (`requireMe`), so this stays usable from client components.
 */
export function RecordPage({
  crumbs,
  crumbsClass,
  titleClamp = 'line-clamp-2',
  titleMore,
  back,
  avatar,
  title,
  subtitle,
  chips,
  figures,
  actions,
  tabs,
  tab,
  tabHref,
  rail,
  children,
  words,
}: {
  /** The trail; the last entry may have no `href`: the record itself, said once and not a link. */
  crumbs?: { label: ReactNode; href?: string }[];
  /** Extra classes for the trail (a phone shows the back arrow and no trail: `max-lg:hidden`). */
  crumbsClass?: string;
  /** How many lines the name may take before it is cut. */
  titleClamp?: string;
  /** Three lines and a "more" tap that opens the rest, on every width (V653); replaces `titleClamp`. */
  titleMore?: { more: string; less: string };
  /** The phone's back arrow: where the record was opened from. */
  back: { href: string; label: string };
  avatar?: ReactNode;
  title: ReactNode;
  /** One line of data under the name (a job title, a number, a type) — never a hint. */
  subtitle?: ReactNode;
  chips?: ReactNode;
  figures?: KeyFigure[];
  /** One primary button, at most two secondary, the rest in a ⋯ menu (§2.5). */
  actions?: ReactNode;
  tabs: RecordTab[];
  tab: string;
  tabHref: (key: string) => string;
  /** The details rail beside the main column; leave it out on a tab that has no details of its own. */
  rail?: ReactNode;
  children: ReactNode;
  words: { tabs: string; notMeasured: string };
}) {
  const tabDefs: TabDef[] = tabs.map((t) => ({ value: t.key, label: t.label, count: t.count, href: tabHref(t.key) }));
  return (
    <PageFrame className="!gap-0">
      <header className="flex flex-col gap-5 pb-5" data-record-header>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link
            href={back.href}
            aria-label={back.label}
            className="inline-grid size-8 max-sm:size-11 place-items-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus lg:hidden"
          >
            <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
          </Link>
          {crumbs?.length ? (
            <nav aria-label="Breadcrumb" className={cn('flex min-w-0 items-center gap-2', crumbsClass)}>
              {crumbs.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-2">
                  {i > 0 ? <span aria-hidden="true">/</span> : null}
                  {c.href ? (
                    <Link href={c.href} className="inline-flex min-h-6 items-center hover:underline max-sm:min-h-11">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" dir="auto" className="max-w-[40ch] truncate">
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {avatar ? <div className="shrink-0">{avatar}</div> : null}
            <div className="flex min-w-0 flex-col gap-1">
              {titleMore ? (
                <ClampedTitle words={titleMore} className="break-words text-3xl md:text-[27px]">
                  {title}
                </ClampedTitle>
              ) : (
                <h1 className={cn(titleClamp, 'break-words text-3xl md:text-[27px]')} data-record-title>
                  {title}
                </h1>
              )}
              {subtitle ? <p className="text-base text-muted">{subtitle}</p> : null}
              {chips ? <div className="flex flex-wrap items-center gap-1.5 pt-1">{chips}</div> : null}
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2" data-record-actions>
              {actions}
            </div>
          ) : null}
        </div>
        {figures?.length ? (
          <KeyFigures
            figures={figures}
            notMeasured={words.notMeasured}
            className="rounded-lg border border-border bg-raised p-4"
          />
        ) : null}
        <Tabs tabs={tabDefs} value={tab} label={words.tabs} />
      </header>
      <div
        className={cn(
          'grid gap-8 pt-6 lg:gap-10',
          rail ? 'lg:grid-cols-[minmax(0,960px)_300px]' : 'lg:grid-cols-[minmax(0,960px)]',
        )}
        data-record-body
      >
        <div className="flex min-w-0 flex-col gap-8" data-record-main>
          {children}
        </div>
        {rail ? (
          <aside className="flex flex-col gap-6 lg:border-s lg:border-border lg:ps-8" data-record-rail>
            {rail}
          </aside>
        ) : null}
      </div>
    </PageFrame>
  );
}
