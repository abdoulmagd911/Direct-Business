// Sabotages for Follow up on a record (V632 Stage 2, V282, V283, builder D): each breaks one promise of its spec.
const E2E = 'e2e:tests/e2e/follow-up-on-a-record.spec.ts';
const CLIENT = 'on a client Follow up is visible, saves one follow-up, and Watch is named Watch';
const TASK = 'on a task Follow up is visible, saves one follow-up, and Escalate stays in the ⋯ menu';
const CHIP = "on My day a task's client chip opens the client";

export const sabotages = [
  {
    // QA-560: the record's name never goes into the note's title; the record shows only through `about`
    name: 'follow-up-prefills-the-record-name',
    breaks: [E2E],
    expect: CLIENT,
    edits: [
      {
        file: 'src/ui/record/FollowUp.tsx',
        find: 'onClick={() => openQuickCapture({ about })}',
        replace: 'onClick={() => openQuickCapture({ about, text: about.label })}',
      },
    ],
  },
  {
    // finding 2: Follow up is a visible action on the task, not hidden away
    name: 'task-follow-up-not-on-the-header',
    breaks: [E2E],
    expect: TASK,
    edits: [
      {
        file: 'src/modules/tasks/screens/TaskRecord.tsx',
        find: "      <FollowUpButton about={{ entity: 'task', id: task.id, label: `${task.number} · ${task.title}` }} />\n",
        replace: '',
      },
    ],
  },
  {
    // finding 4: the record shows its author their follow-up
    name: 'record-shows-no-follow-up',
    breaks: [E2E],
    expect: TASK,
    edits: [
      {
        file: 'src/ui/record/FollowUp.tsx',
        find: '{(rows ?? []).map((r) => (',
        replace: '{([] as MyFollowUp[]).map((r) => (',
      },
    ],
  },
  {
    // finding 3: watching a record is named Watch, so it is never confused with Follow up
    name: 'watch-is-named-follow-again',
    breaks: [E2E],
    expect: CLIENT,
    edits: [{ file: 'messages/en.json', find: '"follow": "Watch",', replace: '"follow": "Follow",' }],
  },
  {
    // finding 5: the client chip on My day opens the client
    name: 'today-client-chip-opens-the-task',
    breaks: [E2E],
    expect: CHIP,
    edits: [
      {
        file: 'src/modules/my-day/screens/TodayBlock.tsx',
        find: 'href={`/clients/${task.partner_id}`}',
        replace: 'href={`/tasks/${task.number}`}',
      },
    ],
  },
];
