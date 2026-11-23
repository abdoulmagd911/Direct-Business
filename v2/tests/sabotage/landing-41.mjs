// Landing 41 (23 Nov) — the Finance page lists the achievements of the period, apart from the money (the owner,
// 22 Nov). Each sabotage takes one promise back, and the test named must go red for it. The database's own rule is
// proven in supabase/tests/sabotage (FAC-01).
const LIST = 'src/modules/finance/screens/FinanceAchievements.tsx';
const SECTION = 'src/modules/finance/screens/FinanceLedgerSection.tsx';
const UNIT = 'unit:tests/unit/finance/finance-lists-the-periods-achievements-apart-from-the-money.test.tsx';
const E2E = 'e2e:tests/e2e/landing-41-finance-achievements.spec.ts';

export const sabotages = [
  {
    name: 'finance-achievements-card-forgets-it-is-not-money',
    breaks: [UNIT],
    expect: '> is titled for the period and says it is not money',
    edits: [{ file: LIST, find: "      source={t('finance.achievements.notMoney')}\n", replace: '' }],
  },
  {
    name: 'finance-achievements-title-opens-nothing',
    breaks: [UNIT],
    expect: '> the title opens the achievement’s own record',
    edits: [
      {
        file: LIST,
        find: '                href={`/kpis/achievements/${a.id}`}',
        replace: '                href="/kpis/achievements"',
      },
    ],
  },
  {
    name: 'finance-achievements-empty-draws-nothing',
    breaks: [UNIT],
    expect: '> an empty period says so',
    edits: [{ file: LIST, find: "        {t('finance.achievements.empty')}", replace: "        {''}" }],
  },
  {
    name: 'finance-achievements-a-bad-answer-is-an-empty-list',
    breaks: [UNIT],
    expect: '> is not an answer when it has no rows: a failed read, never an empty list',
    edits: [
      {
        file: LIST,
        find: '  if (!Array.isArray(a.rows)) return null;',
        replace: '  if (!Array.isArray(a.rows)) return { rows: [], total: 0, more: false };',
      },
    ],
  },
  {
    name: 'e2e-l41-finance-draws-no-achievements',
    breaks: [E2E],
    expect: 'the card is on Finance',
    edits: [
      {
        file: SECTION,
        find: '      <FinanceAchievements from={ask.from} to={ask.to} ready={ready} />\n',
        replace: '',
      },
    ],
  },
  {
    name: 'e2e-l41-the-list-ignores-the-period',
    breaks: [E2E],
    expect: 'another month lists none of it',
    edits: [
      {
        file: LIST,
        find: '    { p_from: from, p_to: to },',
        replace: "    { p_from: '2000-01-01', p_to: '2100-01-01' },",
      },
    ],
  },
];
