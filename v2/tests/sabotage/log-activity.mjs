// Sabotages for the Architect's order of 16 Oct (builder B): Log activity's reason line and in-place header, and the
// Tier box that is not shown while it has no choices.
const UNIT = 'unit:tests/unit/partners/a-box-with-no-choices-is-not-shown-and-a-disabled-save-says-why.test.tsx';
export const sabotages = [
  {
    name: 'an-empty-tier-box-is-shown',
    breaks: [UNIT],
    expect: 'an empty Tier box is not drawn',
    edits: [
      {
        file: 'src/modules/partners/screens/NewPartnerDialog.tsx',
        find: '        {tiers.length ? (',
        replace: '        {tiers ? (',
      },
    ],
  },
  {
    name: 'a-disabled-save-says-nothing',
    breaks: [UNIT, 'e2e:tests/e2e/log-activity.spec.ts'],
    expect: 'the line under the form',
    edits: [
      {
        file: 'src/modules/partners/screens/record/LogActivityDialog.tsx',
        find: '        {!ok && why ? (',
        replace: '        {false && !ok && why ? (',
      },
    ],
  },
  {
    name: 'the-header-stays-old-after-saving',
    breaks: ['e2e:tests/e2e/log-activity.spec.ts'],
    expect: 'Last activity shows a day',
    edits: [
      {
        file: 'src/modules/partners/screens/PartnerRecord.tsx',
        find: '        outcomes={lists.outcomes}\n        onDone={refresh}',
        replace: '        outcomes={lists.outcomes}\n        onDone={() => undefined}',
      },
      // the shell's own refresh after every command is the other road to a fresh header; both are cut
      {
        file: 'src/core/commands/refetch.ts',
        find: '  for (const l of listeners) l();',
        replace: '  void listeners;',
      },
    ],
  },
];
