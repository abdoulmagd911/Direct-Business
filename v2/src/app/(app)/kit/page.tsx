import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { KitGallery } from './KitGallery';

/**
 * The component gallery: every kit component in one page, for the UI-* screenshot, axe and RTL
 * tests (4 themes × 2 densities × 400/1,500 px). Development and test builds only — it is not a
 * screen of the product (V202), so its made-up values never reach a person.
 */
export default async function KitPage() {
  if (process.env.NODE_ENV === 'production' && process.env.V2_KIT !== '1') notFound();
  await requireMe();
  return <KitGallery />;
}
