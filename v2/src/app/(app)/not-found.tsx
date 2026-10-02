import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PATH_HEADER } from '@/core/db/proxy-session';
import { NotFoundBody } from '@/ui/NotFoundBody';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

// Not found inside the shell, with status 404 (W32): an address nothing answers, or a page that called notFound(). The
// address comes from the proxy's header, without its query.
export default async function NotFound() {
  const [t, h] = await Promise.all([getTranslations(), headers()]);
  const address = (h.get(PATH_HEADER) ?? '/').split('?')[0] ?? '/';
  return (
    <Page>
      <PageHeader title={t('errors.notFound.title')} />
      <NotFoundBody address={address} />
    </Page>
  );
}
