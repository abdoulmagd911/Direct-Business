import { cn } from '@/ui/cn';

const bar = 'shimmer rounded-pill bg-pressed';

/**
 * Tasks while it loads (15 Nov, both views): the shape of what is coming — the tab track, the toolbar, then the list
 * card's rows or the board's four columns — as soft bars with the kit's shimmer (still under "reduce motion"). It
 * shows only once loading has taken 400 ms (`show-late`), and says "Loading tasks" to a screen reader.
 */
export function TasksSkeleton({ board = false, label }: { board?: boolean; label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-state="loading"
      data-tasks-skeleton={board ? 'board' : 'list'}
      className="show-late flex min-w-0 flex-col gap-5"
    >
      <span className="sr-only">{label}</span>
      <div className={cn(bar, 'h-11 w-full max-w-[520px]')} />
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(bar, 'h-11 w-full sm:w-[280px]')} />
        <div className={cn(bar, 'h-[34px] w-20 max-sm:hidden')} />
        <div className={cn(bar, 'h-[34px] w-24 max-sm:hidden')} />
        <div className={cn(bar, 'ms-auto h-10 w-28')} />
      </div>
      {board ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[3, 2, 1, 2].map((cards, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
              <div className={cn(bar, 'm-1.5 h-4 w-24')} />
              {Array.from({ length: cards }, (_, j) => (
                <div
                  key={j}
                  className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-raised px-3.5 py-3"
                >
                  <div className={cn(bar, 'h-4 w-4/5')} />
                  <div className={cn(bar, 'h-3 w-3/5')} />
                  <div className={cn(bar, 'h-3 w-2/5')} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-raised shadow-1">
          {['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5', 'w-1/2'].map((w, i) => (
            <div key={i} className="flex min-h-[var(--list-row-min)] items-center gap-3 px-4 py-3">
              <div className={cn(bar, 'size-6 shrink-0')} />
              <div className={cn(bar, 'h-4', w)} />
              <div className={cn(bar, 'ms-auto h-6 w-20 shrink-0')} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
