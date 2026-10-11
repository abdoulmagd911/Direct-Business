import { pageTitle } from '@/ui/shell/page-title';
import { FinanceOverviewPage } from '@/modules/finance/screens/overview-page';

export const generateMetadata = pageTitle('nav.finance');

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <FinanceOverviewPage searchParams={searchParams} />;
}
