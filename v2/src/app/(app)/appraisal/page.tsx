import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

// PRF-002: the page's level is asked on the server — with none, the address shows the no-access state and nothing of
// the page, whatever the drawer shows.
export default async function AreaPage() {
  const [me, t] = await Promise.all([requireMe(), getTranslations()]);
  const allowed = (me.levels['appraisal'] ?? 'none') !== 'none';
  return (
    <Page page="appraisal" title={t('nav.appraisal')}>
      <PageHeader title={t('nav.appraisal')} />
      {allowed ? (
        <DataState kind="empty" message={t('state.empty')} />
      ) : (
        <DataState kind="no-access" what={t('nav.appraisal')} />
      )}
    </Page>
  );
}
