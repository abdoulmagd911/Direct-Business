import { DataState } from '@/ui/DataState';

const bar = 'shimmer rounded-pill bg-pressed';

/**
 * The list while it is read (V21): the title, the four cards and the rows as soft pill shapes with the kit's
 * shimmer — drawn only once loading has taken 400 ms (DataState's `show-late`), and said to a screen reader as
 * "Loading". The cards are not drawn on a phone, as on the list itself.
 */
export function ListSkeleton({ label }: { label: string }) {
  return (
    <DataState kind="loading" message={label} className="gap-[var(--section-gap)]">
      <div className="flex flex-col gap-2.5" data-skeleton="header">
        <div className={`${bar} h-7 w-40`} />
        <div className={`${bar} h-3.5 w-28`} />
      </div>
      <div className="grid grid-cols-2 gap-4 max-sm:hidden lg:grid-cols-4" data-skeleton="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border border-s-4 border-s-kpi bg-raised px-[18px] pb-[18px] pt-4 shadow-1"
          >
            <div className="flex items-center gap-2.5">
              <span className={`${bar} size-10 shrink-0`} />
              <span className={`${bar} h-3 w-2/5`} />
            </div>
            <span className={`${bar} h-[26px] w-[55%]`} />
            <span className={`${bar} h-2.5 w-[70%]`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" data-skeleton="chips">
        {['w-16', 'w-24', 'w-24', 'w-20'].map((w, i) => (
          <span key={i} className={`${bar} h-[34px] ${w} max-sm:h-11`} />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-raised shadow-1" data-skeleton="rows">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <span className={`${bar} size-8 shrink-0`} />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className={`${bar} h-3 ${i % 2 ? 'w-1/2' : 'w-1/3'}`} />
              <span className={`${bar} h-2.5 w-1/4`} />
            </span>
            <span className={`${bar} h-6 w-16 max-sm:hidden`} />
            <span className={`${bar} h-3 w-20 max-md:hidden`} />
          </div>
        ))}
      </div>
    </DataState>
  );
}
