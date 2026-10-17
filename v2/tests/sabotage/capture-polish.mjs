// Sabotages for the capture polish of 16 Oct: the checklist card counts its task's items; the note page has no Turned
// into label before a conversion; the save message names the kind.
const E2E = 'e2e:tests/e2e/capture-polish.spec.ts';
const UNIT = 'unit:tests/unit/my-day/a-checklist-card-counts-the-items-of-its-task.test.ts';

export const sabotages = [
  {
    name: 'checklist-card-ignores-its-task-items',
    breaks: [UNIT],
    expect: "counts the task's action items once it made some",
    edits: [
      {
        file: 'src/modules/my-day/logic.ts',
        find: 'return n.task_items?.total ? n.task_items : checklistCount(n);',
        replace: 'return checklistCount(n);',
      },
    ],
  },
  {
    name: 'note-page-says-turned-into-before-anything',
    breaks: [E2E],
    expect: 'the save message names the kind',
    edits: [
      {
        file: 'src/modules/my-day/screens/NotePage.tsx',
        find: '{note.links.length ? (\n            <div className="flex flex-col gap-2" data-note-links>',
        replace: '{true ? (\n            <div className="flex flex-col gap-2" data-note-links>',
      },
    ],
  },
  {
    name: 'save-message-says-captured-again',
    breaks: [E2E],
    expect: 'the save message names the kind',
    edits: [{ file: 'messages/en.json', find: '"saved": "{kind} saved",', replace: '"saved": "{kind} captured",' }],
  },
  {
    name: 'my-notes-row-names-no-kind',
    breaks: ['unit:tests/unit/my-day/a-captured-item-names-its-kind-on-my-notes.test.tsx'],
    expect: 'names the kind it was captured as',
    edits: [
      {
        file: 'src/modules/my-day/screens/NoteBits.tsx',
        find: 'data-note-captured-as={captured}',
        replace: 'data-note-kind-hidden={captured}',
      },
    ],
  },
  {
    name: 'my-notes-ignores-the-kind-asked-for',
    breaks: ['e2e:tests/e2e/my-notes-find.spec.ts'],
    expect: 'one of each kind is found on My day',
    edits: [
      {
        file: 'src/app/(app)/my-day/page.tsx',
        find: 'const kind = CAPTURE_KINDS.find((k) => k === sp.kind);',
        replace: 'const kind = CAPTURE_KINDS.find((k) => k === sp.kind && false);',
      },
    ],
  },
];
