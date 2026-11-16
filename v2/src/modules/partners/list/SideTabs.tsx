import Link from 'next/link';
import { cn } from '@/ui/cn';
import { SIDE_ROUTE, type Side } from '../types';

/**
 * Partners · Suppliers as the look's pill tabs on a soft track (V21, V217): each tab is its own address, the open
 * one a white pill that says so (`aria-current="page"`); 44 px tall on a phone, where the two share the row. A side's
 * count shows once its own list has been read (FIX-45: the other side is not read just to fill a number).
 */
export function SideTabs({
  side,
  label,
  names,
  totals,
}: {
  side: Side;
  label: string;
  names: Record<Side, string>;
  totals: Record<Side, number | null>;
}) {
  return (
    <div className="flex min-w-0">
      <nav
        aria-label={label}
        data-side-tabs
        className="flex min-w-0 max-w-full gap-1 rounded-pill bg-surface p-1 max-sm:flex-1"
      >
        {(['client', 'supplier_partner'] as const).map((s) => {
          const active = s === side;
          return (
            <Link
              key={s}
              href={SIDE_ROUTE[s]}
              aria-current={active ? 'page' : undefined}
              data-side-tab={s}
              className={cn(
                'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-pill px-4 text-base font-medium leading-5 transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus max-sm:h-11 max-sm:flex-1 max-sm:px-2',
                active ? 'bg-raised font-semibold text-strong shadow-tab' : 'text-muted hover:text-strong',
              )}
            >
              <span className="truncate">{names[s]}</span>
              {totals[s] !== null ? (
                <span className="font-data text-xs font-normal" data-side-count>
                  {totals[s]}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
