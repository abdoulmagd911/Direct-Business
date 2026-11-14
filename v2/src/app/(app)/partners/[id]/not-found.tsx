import { PartnerGone } from '@/modules/partners/screens/PartnerGone';

/** A partner's address with no organisation behind it (most often one just removed): the way back to Partners. */
export default function PartnerNotFound() {
  return <PartnerGone side="client" />;
}
