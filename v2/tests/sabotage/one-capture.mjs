// Sabotages for one way to capture (V633, builder B; one add control per width, daily use 11): each breaks one promise
// of tests/e2e/one-capture.spec.ts.
const E2E = 'e2e:tests/e2e/one-capture.spec.ts';
const DOOR = 'My day has one capture door';
const PER_WIDTH = 'one add control per width';

export const sabotages = [
  {
    name: 'capture-button-comes-back-on-my-day',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/modules/my-day/screens/CaptureShortcut.tsx',
        find: '  return null;',
        replace: '  return <button data-capture-open>Capture</button>;',
      },
    ],
  },
  {
    name: 'create-capture-opens-nothing',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: 'onClick={() => (a.dialog ? a.dialog() : openQuickCapture())}',
        replace: 'onClick={() => (a.dialog ? a.dialog() : undefined)}',
      },
    ],
  },
  {
    name: 'create-shows-on-a-phone-too',
    breaks: [E2E],
    expect: PER_WIDTH,
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: '<Button variant="primary" icon={<Plus />} data-create className="hidden sm:inline-flex">',
        replace: '<Button variant="primary" icon={<Plus />} data-create>',
      },
    ],
  },
  {
    name: 'phone-plus-offers-a-shorter-menu',
    breaks: [E2E],
    expect: PER_WIDTH,
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: '        {actions.map((a) => {',
        replace: '        {actions.slice(0, bar ? -1 : undefined).map((a) => {',
      },
    ],
  },
  {
    name: 'capture-sheet-loses-the-idea-kind',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: "['note', 'idea', 'checklist', 'reminder', 'meeting']",
        replace: "['note', 'checklist', 'reminder', 'meeting']",
      },
    ],
  },
  {
    name: 'slash-no-longer-opens-the-sheet',
    breaks: [E2E],
    expect: '"/" on My day opens the same sheet from the keyboard',
    edits: [
      {
        file: 'src/modules/my-day/screens/CaptureShortcut.tsx',
        find: '        e.preventDefault();\n        openQuickCapture();',
        replace: '        e.preventDefault();',
      },
    ],
  },
  {
    name: 'capture-sheet-loses-the-meeting-kind',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: "['note', 'idea', 'checklist', 'reminder', 'meeting']",
        replace: "['note', 'idea', 'checklist', 'reminder']",
      },
    ],
  },
  {
    name: 'capture-files-a-meeting-as-a-plain-note',
    breaks: [E2E],
    expect: 'a Meeting captured from the sheet is a meeting note',
    edits: [
      {
        file: 'src/modules/my-day/quick-capture.ts',
        find: "kind === 'meeting' ? 'meeting' : 'sticky'",
        replace: "'sticky'",
      },
    ],
  },
  {
    name: 'capture-hidden-from-view-only-people',
    breaks: ['e2e:tests/e2e/employee-view.spec.ts'],
    expect: 'a viewer: the built pages their access opens',
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "at: ['view', 'own', 'full'], sheet: true",
        replace: "at: ['own', 'full'], sheet: true",
      },
    ],
  },
  {
    name: 'my-day-empty-line-points-nowhere',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'messages/en.json',
        find: '"me": "No notes yet. Notes you capture with Create appear here.",',
        replace: '"me": "No notes yet. What you capture here stays yours until you share it.",',
      },
    ],
  },
];
