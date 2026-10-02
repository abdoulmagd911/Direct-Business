import { redirect } from 'next/navigation';

/** The + menu's Task (V401): the list, with quick add open. */
export default function NewTaskPage() {
  redirect('/tasks?new=1');
}
