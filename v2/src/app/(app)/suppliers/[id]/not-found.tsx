import { PartnerGone } from '@/modules/partners/screens/PartnerGone';

/** A supplier's address with no organisation behind it (most often one just removed): the way back to Suppliers. */
export default function SupplierNotFound() {
  return <PartnerGone side="supplier_partner" />;
}
