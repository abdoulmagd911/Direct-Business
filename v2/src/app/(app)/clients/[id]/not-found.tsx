import { PartnerGone } from '@/modules/partners/screens/PartnerGone';

/** A client's address with no organisation behind it (most often one just removed): the way back to Clients. */
export default function ClientNotFound() {
  return <PartnerGone side="client" />;
}
