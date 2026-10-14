import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';

/**
 * While any page of the app is being read (W47): the shell stays, and the page area says "Loading" at once — a tab
 * switch on a slow phone never looks frozen. A page with a more exact line of its own (the week) keeps it.
 */
export default async function Loading() {
  const t = await getTranslations();
  return (
    <div className="p-4" data-page-loading>
      <DataState kind="loading" message={t('common.loading')} />
    </div>
  );
}
