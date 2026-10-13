import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { readOrFail } from '@/modules/org/read-or-fail';
import { avatarOf, type OrgAnswer } from '@/modules/org/types';
import { RecentlyDeleted, type DeletedRow } from '@/modules/settings/screens/RecentlyDeleted';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('recentlyDeleted.title');

/**
 * Recently deleted, everyone's own (QA-71, V401): what this person may see and restore, from the profile menu — a
 * member's saved views and notes included, which the Activity page (Activity · View and above) would keep from them.
 */
export default async function RecentlyDeletedPage() {
  const me = await requireMe();
  const t = await getTranslations();
  const failed: string[] = [];
  const [org, rows] = await Promise.all([
    readOrFail<OrgAnswer>('org', failed, () => serverRpc('org', {} as never)),
    readOrFail<DeletedRow[]>('deleted', failed, () => serverRpc('recently_deleted', { p_limit: 200 })),
  ]);
  const people = Object.fromEntries((org?.people ?? []).map((p) => [p.id, avatarOf(p, me.profile?.locale ?? 'en')]));
  return (
    <Page className="[&>*]:max-w-[900px]">
      <PageHeader title={t('recentlyDeleted.title')} />
      {failed.includes('deleted') ? (
        <DataState
          kind="failed"
          what={t('recentlyDeleted.title')}
          message={t('state.failed', { what: t('recentlyDeleted.title') })}
        />
      ) : (
        <RecentlyDeleted rows={rows ?? []} people={people} />
      )}
    </Page>
  );
}
