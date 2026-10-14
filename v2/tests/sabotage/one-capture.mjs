// Sabotages for one way to capture (V633, builder B): each breaks one promise of tests/e2e/one-capture.spec.ts.
const E2E = 'e2e:tests/e2e/one-capture.spec.ts';
const DOOR = 'My day has one capture door';

export const sabotages = [
  {
    name: 'note-only-box-comes-back',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/modules/my-day/screens/CaptureButton.tsx',
        find: '<section data-capture>',
        replace: '<section data-capture>\n      <input data-capture-input aria-label="Capture a note" />',
      },
    ],
  },
  {
    name: 'capture-button-opens-nothing',
    breaks: [E2E],
    expect: DOOR,
    edits: [
      {
        file: 'src/modules/my-day/screens/CaptureButton.tsx',
        find: 'onClick={openQuickCapture}',
        replace: 'onClick={() => undefined}',
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
        file: 'src/modules/my-day/screens/CaptureButton.tsx',
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
    expect: 'a viewer: the pages their access opens',
    edits: [
      {
        file: 'src/ui/shell/CreateMenu.tsx',
        find: "at: ['view', 'own', 'full'], sheet: true",
        replace: "at: ['own', 'full'], sheet: true",
      },
    ],
  },
];
