import { PartnersListPage } from '@/modules/partners/screens/list-page';

/** Clients (V98): the organisations with the Client side on. */
export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PartnersListPage side="client" searchParams={searchParams} />;
}
