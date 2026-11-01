// Sabotage for the Time box font (tests/unit/ui/the-time-box-is-written-in-the-same-font-as-the-date-box.test.tsx):
// the Time box goes back to the monospace font.
export const sabotages = [
  {
    name: 'time-box-is-monospace',
    breaks: ['unit:tests/unit/ui/the-time-box-is-written-in-the-same-font-as-the-date-box.test.tsx'],
    expect: 'the Time box is not in the monospace font',
    edits: [
      {
        file: 'src/ui/Input.tsx',
        find: "className={cn(inputClass, 'h-[var(--control-h)]', className)}\n      {...rest}\n    />\n  );\n}",
        replace:
          "className={cn(inputClass, 'h-[var(--control-h)] font-data', className)}\n      {...rest}\n    />\n  );\n}",
      },
    ],
  },
];
