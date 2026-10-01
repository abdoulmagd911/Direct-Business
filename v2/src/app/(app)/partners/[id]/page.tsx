import { notFound, redirect } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { PartnerCard } from '@/modules/partners/types';

/**
 * One organisation, two doors (V98, V147): a link to /partners/[id] (a notification, a search hit, an old address)
 * opens the record from the list whose side the reader may see — Clients when the Client side is on and readable,
 * else Suppliers & partners. An id that is no organisation is not found. (The P3-2 specs' throwaway deep link moved
 * to /tasks/…, which the catch-all still serves.)
 */
export default async function PartnerRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }, me] = await Promise.all([params, searchParams, requireMe()]);
  let card: PartnerCard | null = null;
  try {
    card = (await serverRpc('partner', { p_id: id })) as unknown as PartnerCard;
  } catch (e) {
    if ((e as { kind?: string }).kind === 'NotFound') notFound();
  }
  // an address that is no organisation (a made-up id) is not found — never sent on to a record that is not there
  if (!card) notFound();
  const client = card?.sides.some((s) => s.side === 'client' && s.on) && (me.levels['clients'] ?? 'none') !== 'none';
  const q = typeof tab === 'string' ? `?tab=${encodeURIComponent(tab)}` : '';
  redirect(`${client ? '/clients' : '/suppliers'}/${id}${q}`);
}
