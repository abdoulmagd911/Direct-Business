import { redirect } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { PartnerRecordPage } from '@/modules/partners/screens/record-page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.clients');

/**
 * An organisation opened from Partners: its Partner side leads (V98). A /partners/[id] link is the neutral
 * record address (a notification, a search hit, a finance link) — a reader with no Partner-side access is sent
 * on to the Suppliers record, as the old /partners/[id] redirect did.
 */
export default async function PartnerRecordPageRoute(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }, me] = await Promise.all([props.params, props.searchParams, requireMe()]);
  if ((me.levels['clients'] ?? 'none') === 'none' && (me.levels['suppliers_partners'] ?? 'none') !== 'none') {
    const q = typeof tab === 'string' ? `?tab=${encodeURIComponent(tab)}` : '';
    redirect(`/suppliers/${id}${q}`);
  }
  return <PartnerRecordPage side="client" {...props} />;
}
