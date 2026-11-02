// Sabotage for the refused status move (the Architect's order of 2 Nov, the revert of 4cfaca77; builder A).
const E2E = 'e2e:tests/e2e/a-refused-status-move-leaves-the-task-as-it-was.spec.ts';

export const sabotages = [
  {
    // the chip shows the chosen move at once, whatever the database answers (as 4cfaca77 did)
    name: 'status-move-shown-before-the-answer',
    breaks: [E2E],
    expect: 'a refused move is not shown as made',
    edits: [
      {
        file: 'src/modules/tasks/screens/StatusControl.tsx',
        find: '  const view = statusView(task);\n  const chip = (',
        replace:
          '  const [picked, setPicked] = useState<string | null>(null);\n  const view = (picked ?? statusView(task)) as ReturnType<typeof statusView>;\n  const chip = (',
      },
      {
        file: 'src/modules/tasks/screens/StatusControl.tsx',
        find: 'onSelect={() => void move.choose(m)}',
        replace:
          "onSelect={() => {\n                setPicked(m.kind === 'block' ? 'blocked' : m.status.meaning);\n                void move.choose(m);\n              }}",
      },
    ],
  },
];
