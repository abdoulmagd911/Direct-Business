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
    // 1: the form /tasks/new opened is closed, and a later Add task from the header still leaves the list
    name: 'header-add-follows-the-spent-address',
    breaks: [E2E],
    expect: 'from the header, the list stays and shows the new task',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskListScreen.tsx',
        find: "closedOnAddress.current = url.searchParams.has('new');",
        replace: "closedOnAddress.current = closedOnAddress.current || url.searchParams.has('new');",
      },
    ],
  },
  {
    // the Architect's ruling of 15 Oct: Action items has its tab, so no key figure repeats it
    name: 'task-figures-repeat-the-action-items',
    breaks: [E2E],
    expect: 'no figure repeats the action items',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "  const figures: KeyFigure[] = [\n    { key: 'due',",
        replace:
          "  const figures: KeyFigure[] = [\n    { key: 'items', label: t('pages.tasks.tabs.items'), value: String(task.action_items.length) },\n    { key: 'due',",
      },
    ],
  },
  {
    // the Architect's ruling of 15 Oct: Due is a key figure, so Details does not repeat it
    name: 'task-details-repeat-the-due-day',
    breaks: [E2E],
    expect: 'Details does not repeat the due day',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "      <RailField label={t('pages.tasks.fields.start')}",
        replace:
          "      <RailField label={t('pages.tasks.fields.due')}>{date(task.due_on)}</RailField>\n      <RailField label={t('pages.tasks.fields.start')}",
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
