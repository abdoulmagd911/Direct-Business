import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

// PRF-002: the page's level is asked on the server — with none, the address shows the no-access state and nothing of
// the page, whatever the drawer shows.
export default async function AreaPage() {
  const [me, t] = await Promise.all([requireMe(), getTranslations()]);
  const allowed = (me.levels['finance'] ?? 'none') !== 'none';
  return (
    <Page>
      <PageHeader title={t('nav.finance')} />
      {allowed ? (
        <DataState kind="empty" message={t('state.empty')} />
      ) : (
        <DataState kind="no-access" what={t('nav.finance')} />
      )}
    </Page>
  );
}
