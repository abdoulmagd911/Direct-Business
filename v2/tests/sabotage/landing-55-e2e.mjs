// Landing 55 (26 Nov) — a team member changes their own organisations only, on the real stack. Each sabotage puts
// one button back where it was found on live (a colleague's organisation), or takes one from where it belongs, and
// the browser test must go red for it. The rule itself: tests/sabotage/landing-55.mjs; the database: OWN-01.
const RECORD = 'src/modules/partners/screens/PartnerRecord.tsx';
const LIST = 'src/modules/partners/screens/PartnersList.tsx';
const E2E = 'e2e:tests/e2e/landing-55-own-organisations-only.spec.ts';

export const sabotages = [
  {
    name: 'e2e-l55-a-colleague-is-offered-edit',
    breaks: [E2E],
    expect: 'a colleague is not offered Edit',
    edits: [
      {
        file: RECORD,
        find: '  const full = rule.mayChangeOrganisation(me, sidesOn);',
        replace: '  const full = sidesOn.length > 0;',
      },
    ],
  },
  {
    name: 'e2e-l55-a-colleague-is-offered-the-file-picker',
    breaks: [E2E],
    expect: 'nor the file picker',
    edits: [{ file: RECORD, find: '              mayWrite={mayWrite}', replace: '              mayWrite={!archived}' }],
  },
  {
    name: 'e2e-l55-a-team-member-is-not-offered-new',
    breaks: [E2E],
    expect: 'a team member is offered New on the list',
    edits: [{ file: LIST, find: '  const mayAdd = mayAddOrganisation(me, side);', replace: '  const mayAdd = full;' }],
  },
];
