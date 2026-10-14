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
        find: "['note', 'idea', 'checklist', 'reminder']",
        replace: "['note', 'checklist', 'reminder']",
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
];
