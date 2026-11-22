// Sabotages for the task page's Owner and Helpers pickers (the Architect's ruling of 16 Oct, V287; builder D).
const E2E = 'e2e:tests/e2e/task-people.spec.ts';

export const sabotages = [
  {
    // Landing 33: the Owner picker became Hand over (O-3). The hand-over writes nothing (it was: the picker writes nothing)
    name: 'task-owner-picker-changes-nobody',
    breaks: [E2E],
    expect: 'the Responsible changed',
    edits: [
      {
        file: 'src/modules/tasks/screens/Delegate.tsx',
        find: "() => rpc('task_delegate', { p_id: task.id, ...r.values }) as Promise<{ request_id?: string | null }>,",
        replace: 'async () => ({}) as { request_id?: string | null },',
      },
    ],
  },
  {
    // the hand-over is written but gives no request to undo (it was: the owner change)
    name: 'task-owner-change-has-no-undo',
    breaks: [E2E],
    expect: 'Undo',
    edits: [
      {
        file: 'src/modules/tasks/screens/Delegate.tsx',
        find: "() => rpc('task_delegate', { p_id: task.id, ...r.values }) as Promise<{ request_id?: string | null }>,",
        replace:
          "() => rpc('task_delegate', { p_id: task.id, ...r.values }).then(() => ({})) as Promise<{ request_id?: string | null }>,",
      },
    ],
  },
  {
    // Landing 33: the Responsible is offered Hand over only when they may give work at all (tasks.assign_own);
    // the plant offers it to every Responsible (it was: the Owner picker offered to every editor)
    name: 'task-owner-picker-is-offered-to-every-editor',
    breaks: [E2E],
    expect: 'a member who may not give work to others is not offered Hand over',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: '  const mayAssign = !closed && !!task.can_hand_over && mayGive;',
        replace: '  const mayAssign = !closed && !!task.can_hand_over;',
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
        find: '(c) => (c.includes(v) ? c : [...c, v]),',
        replace: '() => [v],',
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
        find: '(c) => c.filter((x) => x !== h),',
        replace: '(c) => c.filter(() => true),',
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
        find: "return (await rpc('task_helpers_set', {",
        replace: "return ((await rpc('task_helpers_set', {",
      },
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: '})) as Written;',
        replace: '})) as Written) && ({} as Written);',
      },
    ],
  },
  {
    // a tab that read the task earlier writes its own old list over a helper added since
    name: 'task-helper-add-uses-the-stale-list',
    breaks: [E2E],
    expect: 'both helpers are on the task',
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskPeople.tsx',
        find: 'change(now?.helpers ?? task.helpers)',
        replace: 'change(task.helpers)',
      },
    ],
  },
];
