import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';

/**
 * Landing 31: while the Discount codes reads are on their way the page shows its own shape — the heading, the row of
 * state pills and the list card — as soft shimmer blocks, instead of the page before it standing still.
 * Presentation only: it changes no read and no timing.
 */
export default async function CodesLoading() {
  const t = await getTranslations();
  return (
    <Page bare>
      <DataState kind="loading" message={t('common.loading')} className="gap-5">
        <div className="shimmer h-9 w-56 max-w-full rounded-pill bg-pressed" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-9 w-24 rounded-pill bg-pressed max-sm:h-11" />
          ))}
        </div>
        <div className="shimmer h-72 rounded-lg bg-pressed" />
        <div className="shimmer h-40 rounded-lg bg-pressed" />
      </DataState>
    </Page>
  );
}
