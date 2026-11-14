import { redirect } from 'next/navigation';

/** The old Clients address goes to Partners (L23 rename): the filters ride in the address, so they are kept. */
export default async function ClientsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === 'string') s.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => s.append(k, x));
  }
  const qs = s.toString();
  redirect(`/partners${qs ? `?${qs}` : ''}`);
}
