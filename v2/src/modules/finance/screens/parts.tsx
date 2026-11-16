import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

/**
 * The Finance page's own card (V21): a white card on the page colour, 16 px corners, the soft shadow, its heading and
 * — beside it, muted — where its figures are read from ("· Recorded here", "· Unified ledger"). The card is a
 * container, so what is inside lays itself out by the card's own width, never the window's: with the drawer open a
 * 1024 px window leaves a card far narrower than the window says, and a table sized by the window ran off its edge.
 */
export function FinanceCard({
  id,
  title,
  source,
  action,
  children,
  className,
  ...rest
}: {
  /** The heading's id: the section is labelled by it. */
  id: string;
  title: ReactNode;
  source?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        '@container flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-raised shadow-1',
        className,
      )}
      {...rest}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-3 pt-4 sm:px-5">
        <h2 id={id} className="font-display text-lg font-semibold leading-6 text-strong">
          {title}
          {source ? <span className="ms-1.5 font-ui text-sm font-normal text-muted">· {source}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A table's heading cell and body cell, the one look for every Finance table: 12 px muted headings, 13 px rows. */
export const TH =
  'px-3 py-2.5 text-start text-xs font-semibold leading-4 text-muted first:ps-4 last:pe-4 sm:first:ps-5 sm:last:pe-5';
export const TD = 'px-3 py-3 align-top text-sm leading-5 first:ps-4 last:pe-4 sm:first:ps-5 sm:last:pe-5';
/** A figure in a table: mono, end-aligned, neutral — amounts in tables carry no colour. */
export const NUM = 'text-end font-data tabular';

/** The shape of the figure cards while their read is on its way: the same grid, soft bars with the shimmer. */
export function TilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 @min-[880px]:grid-cols-4 sm:gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-raised px-[18px] pb-[18px] pt-4 shadow-1 max-sm:px-3.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="shimmer size-10 shrink-0 rounded-pill bg-pressed max-sm:size-8" />
            <div className="shimmer h-3.5 w-2/3 rounded-pill bg-pressed" />
          </div>
          <div className="shimmer h-7 w-1/2 rounded-pill bg-pressed" />
          <div className="shimmer h-3 w-3/4 rounded-pill bg-pressed" />
        </div>
      ))}
    </div>
  );
}
