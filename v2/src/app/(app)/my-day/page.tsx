import { getTranslations } from 'next-intl/server';
import { getMe } from '@/core/auth/get-me';
import { personOf } from '@/ui/person';
import { formatDate, TIME_ZONE } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

export default async function MyDayPage() {
  const t = await getTranslations();
  const me = await getMe();
  // the greeting follows Riyadh's clock, whatever the server's (V40)
  const hour = Number(
    new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(new Date()),
  );
  const greeting = hour < 12 ? 'greetingMorning' : hour < 17 ? 'greetingAfternoon' : 'greetingEvening';
  return (
    <Page>
      <PageHeader
        title={t(`pages.myDay.${greeting}`, { name: me && me.status === 'ok' ? personOf(me).displayName : '' })}
        meta={<span>{formatDate(new Date(), 'en', { weekday: 'long' })}</span>}
      />
      <DataState kind="empty" message={t('pages.empty.my_day')} />
    </Page>
  );
}
