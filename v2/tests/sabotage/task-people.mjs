// Sabotages for the task page's Owner and Helpers pickers (the Architect's ruling of 16 Oct, V287; builder D).
const E2E = 'e2e:tests/e2e/task-people.spec.ts';

export const sabotages = [
  {
    // the Owner picker writes nothing
    name: 'task-owner-picker-changes-nobody',
    breaks: [E2E],
    expect: 'is now with',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: 'if (owner === task.owner_id || busy) return;',
        replace: 'if (owner) return;',
      },
    ],
  },
  {
    // the owner change is written but gives no request to undo
    name: 'task-owner-change-has-no-undo',
    breaks: [E2E],
    expect: 'Undo',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: "rpc('tasks_assign', { p_ids: [task.id], p_owner: owner }) as Promise<Written>",
        replace: "rpc('tasks_assign', { p_ids: [task.id], p_owner: owner }).then(() => ({})) as Promise<Written>",
      },
    ],
  },
  {
    // everyone who may edit the task is offered the Owner picker, not only whoever gives work
    name: 'task-owner-picker-is-offered-to-every-editor',
    breaks: [E2E],
    expect: 'a member who may not give work to others has no Owner picker',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "const mayAssign = mayHelp && me.capabilities.includes('tasks.assign');",
        replace: 'const mayAssign = mayHelp;',
      },
    ],
  },
  {
    // adding a helper replaces the ones already there
    name: 'task-helper-add-replaces-the-others',
    breaks: [E2E],
    expect: 'the second helper joins the first',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: '[...task.helpers, v],',
        replace: '[v],',
      },
    ],
  },
  {
    // the remove button removes nobody
    name: 'task-helper-remove-removes-nobody',
    breaks: [E2E],
    expect: 'the helper is off the task, the other stays',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: 'task.helpers.filter((x) => x !== h),',
        replace: 'task.helpers.filter(() => true),',
      },
    ],
  },
  {
    // a helper change gives no request to undo
    name: 'task-helper-change-has-no-undo',
    breaks: [E2E],
    expect: 'Undo puts the helper back',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: "rpc('task_helpers_set', { p_id: task.id, p_people: next }) as Promise<Written>",
        replace: "rpc('task_helpers_set', { p_id: task.id, p_people: next }).then(() => ({})) as Promise<Written>",
      },
    ],
  },
];
