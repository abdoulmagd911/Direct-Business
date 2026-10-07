import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { ActivityScreen, type DeletedRow, type SignInRow } from '@/modules/settings/screens/ActivityScreen';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import type { HistoryRow } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { isAdmin } from '@/ui/shell/nav';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.activity');

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/** Activity (V97): the change log, the settings log with Revert and the sign-in log, for Activity · View. */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me] = await Promise.all([searchParams, requireMe()]);
  const t = await getTranslations();
  const tab = str(q.tab) || 'changes';
  const filters = { actor: str(q.actor), entity: str(q.entity), since: str(q.since), person: str(q.person) };
  if ((me.levels['activity'] ?? 'none') === 'none')
    return (
      <Page>
        <PageHeader title={t('nav.activity')} />
        <DataState kind="no-access" what={t('nav.activity')} message={t('activity.locked')} />
      </Page>
    );
  const org = (await serverRpc('org', {} as never)) as unknown as OrgAnswer;
  let rows: HistoryRow[] = [];
  let signIns: SignInRow[] = [];
  let deleted: DeletedRow[] = [];
  if (tab === 'deleted') {
    // Recently deleted (V401): what the viewer may see, inside audit.recently_deleted_days.
    deleted = ((await serverRpc('recently_deleted', { p_limit: 200 })) as unknown as DeletedRow[]) ?? [];
  } else if (tab === 'signIns') {
    signIns =
      ((await serverRpc('sign_in_log', {
        p_person: filters.person || me.person.id,
        p_limit: 100,
      } as never)) as unknown as SignInRow[]) ?? [];
  } else if (tab === 'settings' && isAdmin(me)) {
    // The settings log (api.settings_log — V97, P3-6d): every request that touched a settings page, with each change's
    // before and after, so Revert knows the value that stood before without another read.
    const log =
      ((await serverRpc('settings_log', { p_limit: 100 })) as unknown as (Omit<HistoryRow, 'undone'> & {
        undone_by: string | null;
      })[]) ?? [];
    rows = log.map(({ undone_by, ...r }) => ({ ...r, undone: undone_by !== null }));
  } else {
    rows =
      ((await serverRpc('activity', {
        p_actor: filters.actor || undefined,
        p_entity: tab === 'settings' ? 'setting' : filters.entity || undefined,
        p_since: filters.since ? new Date(filters.since).toISOString() : undefined,
        p_limit: 100,
      })) as unknown as HistoryRow[]) ?? [];
  }
  return (
    <Page bare>
      <ActivityScreen me={me} tab={tab} org={org} rows={rows} signIns={signIns} deleted={deleted} filters={filters} />
    </Page>
  );
}
