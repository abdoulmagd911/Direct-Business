import { redirect } from 'next/navigation';

/** The old Partners address (V207) goes to the two lists of V98: Suppliers & partners when asked for, else Clients. */
export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  redirect(view === 'suppliers' ? '/suppliers' : '/clients');
}
