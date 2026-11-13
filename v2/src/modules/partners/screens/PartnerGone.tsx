import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
// the variants themselves, not the client Button module: this page is drawn on the server
import { buttonVariants } from '@/ui/button-variants';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { SIDE_ROUTE, type Side } from '../types';

/**
 * An organisation's address with no organisation behind it — most often one just removed, whose Undo is still on
 * screen (the record re-reads after Remove and lands here). It says so in the organisation's own words with the way
 * back to its list, instead of the general "Page not found … Go to My day" with the raw address.
 */
export async function PartnerGone({ side }: { side: Side }) {
  const t = await getTranslations();
  const list = side === 'client' ? t('nav.clients') : t('nav.suppliers_partners');
  return (
    <Page>
      <PageHeader crumbs={[{ label: list, href: SIDE_ROUTE[side] }]} title={t('partners.gone.title')} />
      <div data-state="not-found" className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5">
        <p className="text-base text-text">{t('partners.gone.body')}</p>
        <div>
          <Link
            href={SIDE_ROUTE[side]}
            className={buttonVariants({ variant: 'secondary', size: 'md' })}
            data-partner-gone-back
          >
            {/* one sentence per list, so the Arabic case is right (إلى الموردين, not إلى الموردون) */}
            {side === 'client' ? t('partners.gone.backClients') : t('partners.gone.backSuppliers')}
          </Link>
        </div>
      </div>
    </Page>
  );
}
