import { pageTitle } from '@/ui/shell/page-title';
import { NewInvoicePage } from '@/modules/finance/screens/new-page';

export const generateMetadata = pageTitle('finance.new.title');

export default function Page() {
  return <NewInvoicePage />;
}
