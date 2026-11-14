import { redirect } from 'next/navigation';

/** The old Clients record address goes to the Partners record (L23 rename). */
export default async function ClientRecordRedirect(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([props.params, props.searchParams]);
  const q = typeof tab === 'string' ? `?tab=${encodeURIComponent(tab)}` : '';
  redirect(`/partners/${id}${q}`);
}
