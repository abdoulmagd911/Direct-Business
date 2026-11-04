import { pageTitle } from '@/ui/shell/page-title';
import { FilesArchivePage } from '@/modules/partners/screens/files-archive-page';

export const generateMetadata = pageTitle('nav.files');

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <FilesArchivePage searchParams={searchParams} />;
}
