import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { accountOf } from '@/core/auth/account';
import { getMe } from '@/core/auth/get-me';
import { formatDate } from '@/core/i18n/format';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** My day's heading is the date, Riyadh's day (V40), no greeting (V217, cut 9); the page itself is being built. */
export default async function MyDayPage() {
  const t = await getTranslations();
  const me = await getMe();
  const adminAccount = me && me.status === 'ok' && (await accountOf(me.person.id)) === 'admin_account';
  return (
    <Page>
      <PageHeader title={formatDate(new Date(), 'en', { weekday: 'long' })} />
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
        <DataState kind="empty" message={t('pages.beingBuilt')} />
      )}
    </Page>
  );
}
