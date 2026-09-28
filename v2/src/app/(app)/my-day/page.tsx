import { getTranslations } from 'next-intl/server';
import { getMe } from '@/core/auth/me';
import { formatDate } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/AppShell';

export default async function MyDayPage() {
  const t = await getTranslations();
  const me = await getMe();
  return (
    <Page>
      <PageHeader
        title={t('pages.myDay.greeting', { name: me?.person.displayName ?? '' })}
        meta={<span className="font-data">{formatDate(new Date(), 'en', { weekday: 'long' })}</span>}
      />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
