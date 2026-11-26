// Landing 55 (26 Nov) — a team member changes their own organisations only (the owner's approved design of 22 Nov
// 2026). The Team member role starts at Own on the two organisation pages, and the screen offers a change only where
// the database allows it. Each sabotage takes one promise back, and the test named must go red for it.
// The database's own rules are proven in supabase/tests/sabotage (OWN-01).
const RULE = 'src/modules/partners/may-change.ts';
const MODULE = 'src/modules/partners/module.ts';
const UNIT = 'unit:tests/unit/partners/landing-55-a-team-member-changes-their-own-organisations-only.test.ts';
const OWNED = "  return level === 'own' && (side.owner_id === me.person.id || editsOthersWork(me));";

export const sabotages = [
  {
    name: 'l55-a-team-member-starts-at-full-on-partners',
    breaks: [UNIT],
    expect: '> starts at Own on Partners and on Suppliers & partners',
    edits: [
      {
        file: MODULE,
        find: "(the design of 22 Nov)\n      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },",
        replace:
          "(the design of 22 Nov)\n      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'full', viewer: 'view' },",
      },
    ],
  },
  {
    name: 'l55-own-changes-a-colleagues-organisation',
    breaks: [UNIT],
    expect: '> and never a colleague’s, nor one with no owner',
    edits: [{ file: RULE, find: OWNED, replace: "  return level === 'own';" }],
  },
  {
    name: 'l55-own-does-not-change-its-own-organisation',
    breaks: [UNIT],
    expect: '> a team member changes the one whose side they own',
    edits: [{ file: RULE, find: OWNED, replace: "  return level === 'own' && editsOthersWork(me);" }],
  },
  {
    name: 'l55-the-extra-opens-nothing-of-a-colleagues',
    breaks: [UNIT],
    expect: '> “Edit someone else’s work — Allowed” opens a colleague’s to a person at Own',
    edits: [{ file: RULE, find: OWNED, replace: "  return level === 'own' && side.owner_id === me.person.id;" }],
  },
  {
    name: 'l55-a-viewer-keeps-the-extra',
    breaks: [UNIT],
    expect: '> a Viewer changes nothing, whatever their record still says',
    edits: [
      {
        file: RULE,
        find: "  return role.key !== 'viewer' && me.capabilities.includes('records.edit_others');",
        replace: "  return me.capabilities.includes('records.edit_others');",
      },
    ],
  },
  {
    name: 'l55-adding-an-organisation-needs-full',
    breaks: [UNIT],
    expect: '> Own adds an organisation — it is theirs; View does not',
    edits: [
      {
        file: RULE,
        find: "  const level = levelOn(me, side);\n  return level === 'full' || level === 'own';",
        replace: "  const level = levelOn(me, side);\n  return level === 'full';",
      },
    ],
  },
  {
    name: 'l55-a-note-asks-whose-the-organisation-is',
    breaks: [UNIT],
    expect: '> a note or a logged activity stays open on a colleague’s organisation, never to a Viewer',
    edits: [
      {
        file: RULE,
        find: "    const level = levelOn(me, s.side);\n    return level === 'full' || level === 'own';",
        replace: '    return mayWriteSide(me, s);',
      },
    ],
  },
];
