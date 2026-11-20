'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { navStartedTo } from '@/ui/shell/nav-pending';
import type { TaskLookups } from '../load';
import type { QuickAddInput } from '../rules';
import { QuickAdd } from './QuickAdd';
import { spendNewTaskAddress } from './TaskListScreen';

/** What the form names things with; it works with none of them (a title is enough) and gains each as it arrives. */
export type NewTaskNames = Pick<TaskLookups, 'org' | 'partners' | 'projects' | 'priorities'>;

export const NO_NAMES: NewTaskNames = { org: null, partners: [], projects: [], priorities: [] };

/**
 * The form /tasks/new opens (the + menu's Task), drawn with the page's FIRST answer (Landing 34, item 6). Before, the
 * form was part of the list, and the list arrives late — after the list read, the statuses, the organisation, the
 * clients and the projects, each of which can take seconds — and as a part put in place afterwards, which a browser
 * that is not drawing frames never does (the weekly review's lesson of 26 Oct). So a phone could sit on "Loading
 * tasks" with no form at all. Now the form does not wait for the list: it opens at once with the title, the due day
 * and the notes, and the owner, client, project and priority pickers join it when their names arrive (`names`, a
 * promise from the page — the SAME reads the list makes, not a second round). What is typed stays through that: this
 * is one mounted form, never re-made when the list lands.
 * Closing or saving spends the address exactly as the list's own form does (`spendNewTaskAddress`), and a save moves
 * on to the new task's page.
 */
export function NewTaskEntry({ names, initial }: { names: Promise<NewTaskNames>; initial?: Partial<QuickAddInput> }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [known, setKnown] = useState<NewTaskNames>(NO_NAMES);
  const closedOnAddress = useRef(false);
  useEffect(() => {
    let live = true;
    names.then(
      (n) => {
        if (live) setKnown(n);
      },
      // the names could not be read: the form still saves a task with a title; the list below says what failed
      () => {},
    );
    return () => {
      live = false;
    };
  }, [names]);
  return (
    <QuickAdd
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) spendNewTaskAddress(closedOnAddress);
      }}
      org={known.org}
      partners={known.partners}
      projects={known.projects}
      priorities={known.priorities}
      initial={initial}
      onAdded={(r) => {
        if (closedOnAddress.current && navStartedTo(`/tasks/${r.number}`)) router.replace(`/tasks/${r.number}`);
      }}
    />
  );
}
