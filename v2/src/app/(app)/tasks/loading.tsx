import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';

/**
 * While Tasks is read — and while /tasks/new opens quick add on top of it — the loading state shows at once, said to a
 * screen reader too: a phone never sits on a blank page (the supervisor's sweep of 15 Oct).
 */
export default async function Loading() {
  const t = await getTranslations();
  return (
    <div className="p-4" data-tasks-loading>
      <DataState kind="loading" message={t('state.loading', { what: t('nav.tasks') })} />
    </div>
  );
}
