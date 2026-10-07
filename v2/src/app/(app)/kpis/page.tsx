import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.kpis');

/**
 * KPIs: the page itself is still being built, so a person with a level on it lands on Achievements (GC-4, V377,
 * V605 (2)); a person with none sees the refusal under the KPIs title, as every area page gives it (PRF-002).
 */
export default async function KpisPage() {
  const [me, t] = await Promise.all([requireMe(), getTranslations()]);
  if ((me.levels.kpis ?? 'none') !== 'none') redirect('/kpis/achievements');
  return (
    <Page page="kpis" title={t('nav.kpis')}>
      {null}
    </Page>
  );
}
