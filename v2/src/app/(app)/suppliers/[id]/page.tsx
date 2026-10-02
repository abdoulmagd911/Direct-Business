import { PartnerRecordPage } from '@/modules/partners/screens/record-page';

/** An organisation opened from Suppliers & partners: its Supplier & partner side leads (V98). */
export default function SupplierRecordPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return <PartnerRecordPage side="supplier_partner" {...props} />;
}
