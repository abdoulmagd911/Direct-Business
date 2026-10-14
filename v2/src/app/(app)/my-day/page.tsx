import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { accountOfOrg } from '@/core/auth/account';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { formatDate } from '@/core/i18n/format';
import { MyDay } from '@/modules/my-day/screens/MyDay';
import { myDay, remindersDue } from '@/modules/my-day/server';
import { SCOPES, type Scope } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import type { TaskStatus } from '@/modules/tasks/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.my_day');

/** What `?more=1` reads: the first block is 7 notes, the rest a person keeps open is a few dozen. */
const ALL = 100;
const BLOCK = 7;

/** My day (V433): headed by Riyadh's date (V40, V217), Capture then Convert (`modules/my-day`); the owner's admin account keeps the settings (V444). */
export default async function MyDayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; more?: string | string[] }>;
}) {
  const [t, me, sp, locale] = await Promise.all([getTranslations(), requireMe(), searchParams, getLocale()]);
  const title = formatDate(new Date(), locale === 'ar' ? 'ar' : 'en', { weekday: 'long' });
  // W47: everything this page shows is asked for in one round after me, with the organisation read once — the account
  // mark comes from it (V444) — so the owner's admin account, whose page is a note, simply ignores the rest.
  const scope: Scope = SCOPES.includes(sp.tab as Scope) ? (sp.tab as Scope) : 'me';
  const all = sp.more === '1';
  const [answerRead, orgRead, statusesRead, dueRead] = await Promise.allSettled([
    myDay(scope, all ? ALL : BLOCK + 1),
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    scope === 'me'
      ? (serverRpc('list', { p_list: 'task_status' }) as unknown as Promise<TaskStatus[]>).catch(
          () => [] as TaskStatus[],
        )
      : Promise.resolve([] as TaskStatus[]),
    scope === 'me' ? remindersDue() : Promise.resolve(null),
  ]);
  const org = orgRead.status === 'fulfilled' ? orgRead.value : null;
  if (org && accountOfOrg(org, me.person.id) === 'admin_account')
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
  // a read that failed is the page's error, as before (never drawn as an empty day)
  if (answerRead.status === 'rejected') throw answerRead.reason;
  if (orgRead.status === 'rejected') throw orgRead.reason;
  if (statusesRead.status === 'rejected') throw statusesRead.reason;
  const answer = answerRead.value;
  const statuses = statusesRead.value;
  const people = orgRead.value.people;
  // remindersDue() answers null when it cannot be read: the Today block says so and the rest of My day still draws
  const due = dueRead.status === 'fulfilled' ? dueRead.value : null;
  return (
    <Page>
      <MyDay data={{ title, scope, answer, all, people, statuses, due }} />
    </Page>
  );
}
