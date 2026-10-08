import { PartnerRecordPage } from '@/modules/partners/screens/record-page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.suppliers_partners');

/** An organisation opened from Suppliers & partners: its Supplier & partner side leads (V98). */
export default function SupplierRecordPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return <PartnerRecordPage side="supplier_partner" {...props} />;
}
