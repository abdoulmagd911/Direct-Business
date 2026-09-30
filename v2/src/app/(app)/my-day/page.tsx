import { getTranslations } from 'next-intl/server';
import { formatDate } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** My day's heading is the date, Riyadh's day (V40), no greeting (V217, cut 9); the page itself is being built. */
export default async function MyDayPage() {
  const t = await getTranslations();
  return (
    <Page>
      <PageHeader title={formatDate(new Date(), 'en', { weekday: 'long' })} />
      <DataState kind="empty" message={t('pages.beingBuilt')} />
    </Page>
  );
}
