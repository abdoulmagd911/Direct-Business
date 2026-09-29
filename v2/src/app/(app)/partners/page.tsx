import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** Partners, entered as Clients or Suppliers & partners (owner, 29 Sep): the view names the page until P3-9's list. */
export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const t = await getTranslations();
  const title =
    view === 'suppliers' ? t('nav.suppliers_partners') : view === 'clients' ? t('nav.clients') : t('nav.partners');
  return (
    <Page>
      <PageHeader title={title} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
