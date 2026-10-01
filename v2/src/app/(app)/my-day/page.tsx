import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { accountOf } from '@/core/auth/account';
import { getMe } from '@/core/auth/get-me';
import { personOf } from '@/ui/person';
import { formatDate, TIME_ZONE } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.my_day');

export default async function MyDayPage() {
  const t = await getTranslations();
  const me = await getMe();
  const adminAccount = me && me.status === 'ok' && (await accountOf(me.person.id)) === 'admin_account';
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
      {adminAccount ? (
        // the owner's admin account keeps the settings; his own work is on his employee account (V444, W1)
        <DataState
          kind="empty"
          message={t('pages.myDay.adminAccount')}
          action={
            <Link
              href="/settings"
              className="inline-flex h-[var(--control-h)] items-center rounded-md bg-primary px-4 text-base font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              data-admin-account-settings
            >
              {t('pages.myDay.goSettings')}
            </Link>
          }
        />
      ) : (
        <DataState kind="empty" message={t('pages.empty.my_day')} />
      )}
    </Page>
  );
}
