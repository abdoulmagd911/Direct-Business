import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { accountOf } from '@/core/auth/account';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { formatDate } from '@/core/i18n/format';
import { MyDay } from '@/modules/my-day/screens/MyDay';
import { myDay } from '@/modules/my-day/server';
import { SCOPES, type Scope } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** What `?more=1` reads: the first block is 7 notes, the rest a person keeps open is a few dozen. */
const ALL = 100;
const BLOCK = 7;

/** My day (V433): headed by Riyadh's date (V40, V217), Capture then Convert (`modules/my-day`); the owner's admin account keeps the settings (V444). */
export default async function MyDayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; more?: string | string[] }>;
}) {
  const [t, me, sp] = await Promise.all([getTranslations(), requireMe(), searchParams]);
  const title = formatDate(new Date(), 'en', { weekday: 'long' });
  if ((await accountOf(me.person.id)) === 'admin_account')
    return (
      <Page>
        <PageHeader title={title} />
        {/* the owner's admin account keeps the settings; his own work is on his employee account (V444, W1) */}
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
      </Page>
    );

  const scope: Scope = SCOPES.includes(sp.tab as Scope) ? (sp.tab as Scope) : 'me';
  const all = sp.more === '1';
  const [answer, org] = await Promise.all([
    myDay(scope, all ? ALL : BLOCK + 1),
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
  ]);
  return (
    <Page>
      <MyDay data={{ title, scope, answer, all, people: org.people }} />
    </Page>
  );
}
