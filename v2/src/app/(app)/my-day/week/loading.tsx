import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';

/** While the week is read: the loading state, said to a screen reader too. */
export default async function Loading() {
  const t = await getTranslations();
  return (
    <div className="p-4">
      <DataState kind="loading" message={t('state.loading', { what: t('pages.weeklyReview.title') })} />
    </div>
  );
}
