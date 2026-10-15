// Sabotages for the supervisor's sweep of 15 Oct (builder D): each breaks one promise of its spec.
const E2E = 'e2e:tests/e2e/sweep-15-oct.spec.ts';
const NEW = '/tasks/new shows Loading at once, and saving moves the address to the new task';
const TOAST = 'the Done toast names the task by its title, then its number';

export const sabotages = [
  {
    // 1: Tasks opens on a blank page until the list is read
    name: 'tasks-open-on-a-blank-page',
    breaks: [E2E],
    expect: NEW,
    edits: [
      {
        file: 'src/app/(app)/tasks/page.tsx',
        find: '<div data-tasks-loading>',
        replace: '<div>',
      },
    ],
  },
  {
    // 1: after saving, the address keeps the empty form's, so Back and refresh reopen it
    name: 'new-task-keeps-the-form-address',
    breaks: [E2E],
    expect: NEW,
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: "closedOnAddress.current = url.searchParams.has('new');",
        replace: 'closedOnAddress.current = false;',
      },
    ],
  },
  {
    // 2: the toast leads with the number, not the title
    name: 'done-toast-names-the-number-only',
    breaks: [E2E],
    expect: TOAST,
    edits: [
      {
        file: 'messages/en.json',
        find: '"movedLine": "{status} · {title} ({number})",',
        replace: '"movedLine": "{number}: {status}",',
      },
    ],
  },
];
