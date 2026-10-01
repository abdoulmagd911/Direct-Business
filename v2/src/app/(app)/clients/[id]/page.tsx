import { PartnerRecordPage } from '@/modules/partners/screens/record-page';

/** An organisation opened from Clients: its Client side leads (V98). */
export default function ClientRecordPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return <PartnerRecordPage side="client" {...props} />;
}
