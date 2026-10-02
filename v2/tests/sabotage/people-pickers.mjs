// [shared] QA-515: the people a person picker offers (V465). Broken, the unit test turns red for the planted reason.
//   node scripts/sabotage.mjs --only pickers-offer-the-admin-account
export const sabotages = [
  {
    name: 'pickers-offer-the-admin-account',
    breaks: ['unit:tests/unit/org/a-person-picker-offers-only-team-members.test.ts'],
    expect: 'leaves out the admin account and the test account',
    edits: [
      {
        file: 'src/modules/org/pickers.ts',
        find: "people.filter((p) => !p.account || p.account === 'team_member')",
        replace: 'people.filter((p) => p !== null)',
      },
    ],
  },
];
