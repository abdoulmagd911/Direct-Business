import { redirect } from 'next/navigation';
import { PartnersListPage } from '@/modules/partners/screens/list-page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.clients');

/**
 * Partners (V98): the organisations with the Partner side on. The old /partners?view=suppliers address (V207)
 * still goes to the Suppliers list.
 */
export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  if (q.view === 'suppliers') redirect('/suppliers');
  return <PartnersListPage side="client" searchParams={Promise.resolve(q)} />;
}
