import { PartnersListPage } from '@/modules/partners/screens/list-page';

/** Suppliers & partners (V98): the organisations with the Supplier & partner side on. */
export default function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PartnersListPage side="supplier_partner" searchParams={searchParams} />;
}
