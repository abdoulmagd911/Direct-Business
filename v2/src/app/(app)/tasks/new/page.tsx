import { pageTitle } from '@/ui/shell/page-title';
import TasksPage from '../page';

export const generateMetadata = pageTitle('nav.tasks');

/**
 * The + menu's Task (V401): the list, with quick add open. Drawn here, not redirected to /tasks?new=1, so the first
 * answer already carries the page frame and "Loading tasks" — a redirect cost a second full trip to the server before
 * anything showed (V286, measured 16 Oct).
 */
export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return TasksPage({ searchParams: Promise.resolve({ ...params, new: '1' }) });
}
