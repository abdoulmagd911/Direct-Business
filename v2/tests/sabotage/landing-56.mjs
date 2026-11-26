// Landing 56 (26 Nov) — "Own clients only" on Finance (the owner's approval of 26 Nov 2026). The Team member role
// starts at Own on Finance; Own types an invoice and changes the entries of the clients that are theirs. Each
// sabotage takes one promise back, and the test named must go red for it. The database's own rules are proven in
// supabase/tests/sabotage (OWN-02).
const RULE = 'src/modules/finance/own-clients.ts';
const MODULE = 'src/modules/finance/module.ts';
const UNIT = 'unit:tests/unit/finance/landing-56-own-clients-only-on-finance.test.ts';

export const sabotages = [
  {
    name: 'l56-a-team-member-starts-at-full-on-finance',
    breaks: [UNIT],
    expect: '> starts at Own on Finance and on an organisation’s Finance tab',
    edits: [
      {
        file: MODULE,
        find: "member: 'own', viewer: 'view' },",
        replace: "member: 'full', viewer: 'view' },",
      },
    ],
  },
  {
    name: 'l56-own-types-no-invoice',
    breaks: [UNIT],
    expect: '> Own and Full do; View and None do not',
    edits: [
      { file: RULE, find: "  return level === 'full' || level === 'own';", replace: "  return level === 'full';" },
    ],
  },
  {
    name: 'l56-own-changes-a-colleagues-clients-entry',
    breaks: [UNIT],
    expect: '> never a colleague’s client’s, nor an entry under no organisation',
    edits: [
      {
        file: RULE,
        find: '  return !!partnerId && mine.partners.includes(partnerId);',
        replace: '  return !!partnerId;',
      },
    ],
  },
  {
    name: 'l56-all-clients-open-is-not-heard',
    breaks: [UNIT],
    expect: '> every client, when the database says all are open',
    edits: [{ file: RULE, find: '  if (mine.all) return true;\n', replace: '' }],
  },
  {
    name: 'l56-an-unread-answer-opens-every-client',
    breaks: [UNIT],
    expect: '> nothing, until the database has answered or when its answer is not one',
    edits: [{ file: RULE, find: '    all: a.all === true,', replace: '    all: a.all !== false,' }],
  },
];
