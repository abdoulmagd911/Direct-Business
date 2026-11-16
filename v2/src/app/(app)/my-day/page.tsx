import { Settings } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { accountOfOrg } from '@/core/auth/account';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { dayHeading } from '@/modules/my-day/my-work';
import { DayBanner } from '@/modules/my-day/screens/DayBanner';
import { DayLocked } from '@/modules/my-day/screens/DayStates';
import { MyDay } from '@/modules/my-day/screens/MyDay';
import { CAPTURE_KINDS } from '@/modules/my-day/quick-capture';
import { myDay, escalatedByMe, escalatedToMe, myWorkCount, openAsks, remindersDue } from '@/modules/my-day/server';
import { weeklyUnlogged } from '@/modules/weekly-review/server';
import { SCOPES, type Scope } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import type { TaskStatus } from '@/modules/tasks/types';
import { buttonVariants } from '@/ui/button-variants';
import { DataState } from '@/ui/DataState';
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
  searchParams: Promise<{ tab?: string | string[]; more?: string | string[]; kind?: string | string[] }>;
}) {
  const [t, me, sp, locale] = await Promise.all([getTranslations(), requireMe(), searchParams, getLocale()]);
  // the banner's heading: Riyadh's day as the boards write it — "Sun 15 Nov 2026", «الأحد، 15 نوفمبر 2026»
  const title = dayHeading(new Date(), locale === 'ar' ? 'ar' : 'en');
  // a person whose My day is closed gets the lock card, never a crash or an empty day (M53); nothing is read for them
  if (me.levels.my_day === 'none')
    return (
      <Page>
        <DayLocked heading={title} message={t('state.noAccess', { what: t('nav.my_day') })} />
      </Page>
    );
  // W47: everything this page shows is asked for in one round after me, with the organisation read once — the account
  // mark comes from it (V444) — so the owner's admin account, whose page is a note, simply ignores the rest.
  const scope: Scope = SCOPES.includes(sp.tab as Scope) ? (sp.tab as Scope) : 'me';
  const all = sp.more === '1';
  // narrowed to one kind of capture (V641); an unknown word shows them all
  const kind = CAPTURE_KINDS.find((k) => k === sp.kind);
  // the banner's count: My work, the Tasks screen's own count for its My work tab — asked in this same round, and only
  // of someone who may open Tasks (as that screen does); it answers null when it cannot be read, never an error, and
  // the banner then says no number
  const myWorkAsked = (me.levels.tasks ?? 'none') === 'none' ? Promise.resolve(null) : myWorkCount(me);
  const [answerRead, orgRead, statusesRead, dueRead, asksRead, escalatedRead, escalatedByMeRead, unloggedRead] =
    await Promise.allSettled([
      myDay(scope, all ? ALL : BLOCK + 1, kind),
      serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
      scope === 'me'
        ? (serverRpc('list', { p_list: 'task_status' }) as unknown as Promise<TaskStatus[]>).catch(
            () => [] as TaskStatus[],
          )
        : Promise.resolve([] as TaskStatus[]),
      scope === 'me' ? remindersDue() : Promise.resolve(null),
      scope === 'me' ? openAsks() : Promise.resolve(null),
      scope === 'me' ? escalatedToMe() : Promise.resolve(null),
      scope === 'me' ? escalatedByMe() : Promise.resolve(null),
      // Phase 6: the weekly-review door's unlogged count (me only; null when the read failed, so no badge).
      scope === 'me' ? weeklyUnlogged() : Promise.resolve(null),
    ]);
  const org = orgRead.status === 'fulfilled' ? orgRead.value : null;
  if (org && accountOfOrg(org, me.person.id) === 'admin_account')
    return (
      <Page>
        <DayBanner heading={title} />
        {/* the owner's admin account keeps the settings; his own work is on his employee account (V444, W1) */}
        <DataState
          kind="empty"
          icon={<Settings />}
          message={t('pages.myDay.adminAccount')}
          action={
            <Link href="/settings" className={buttonVariants({ variant: 'primary' })} data-admin-account-settings>
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
  // openAsks(), escalatedToMe() and escalatedByMe() answer null the same way: the Waiting sections say so
  const asks = asksRead.status === 'fulfilled' ? asksRead.value : null;
  const escalated = escalatedRead.status === 'fulfilled' ? escalatedRead.value : null;
  const flaggedByMe = escalatedByMeRead.status === 'fulfilled' ? escalatedByMeRead.value : null;
  // weeklyUnlogged() answers null when it cannot be read: the door simply shows no badge
  const unlogged = unloggedRead.status === 'fulfilled' ? (unloggedRead.value?.total ?? null) : null;
  const myWork = await myWorkAsked;
  return (
    <Page>
      <MyDay
        data={{
          title,
          myWork,
          scope,
          answer,
          all,
          kind,
          people,
          statuses,
          due,
          asks,
          escalated,
          escalatedByMe: flaggedByMe,
          unlogged,
        }}
      />
    </Page>
  );
}
