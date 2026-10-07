import { redirect } from 'next/navigation';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.tasks');

/** The + menu's Task (V401): the list, with quick add open. */
export default function NewTaskPage() {
  redirect('/tasks?new=1');
}
