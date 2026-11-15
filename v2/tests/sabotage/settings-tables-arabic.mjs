// QA-592: the People and Teams tables of Settings fit their box in Arabic at 1,280 and 1,440 px.
// Landing 30: with a TEST person listed too — the wide People table carries no "Sign in as test user" column.
const E2E = 'e2e:tests/e2e/app-settings.alone.spec.ts';
export const sabotages = [
  {
    name: 'the-people-table-keeps-its-words-on-one-line',
    breaks: [E2E],
    expect: 'the people table fits its box in Arabic',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: `sm:block">
        <table className="w-full table-auto text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium [overflow-wrap:break-word]">
                {t('settings.people.name')}`,
        replace: `sm:block">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium [overflow-wrap:break-word]">
                {t('settings.people.name')}`,
      },
    ],
  },
  {
    // Landing 30: the switch column is back in the wide People table, for the TEST rows
    name: 'the-people-table-carries-the-test-switch-column',
    breaks: [E2E],
    expect: 'the people table fits its box in Arabic',
    edits: [
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: `                {t('settings.people.status')}
              </th>
`,
        replace: `                {t('settings.people.status')}
              </th>
              {rows.some(offered) ? <th className="px-4 py-2.5" aria-hidden="true" /> : null}
`,
      },
      {
        file: 'src/modules/org/screens/OrgAccess.tsx',
        find: `                    <PersonStatus row={p} today={today} />
                  </td>
`,
        replace: `                    <PersonStatus row={p} today={today} />
                  </td>
                  {rows.some(offered) ? (
                    <td className="px-4 py-2.5">
                      {offered(p) ? (
                        <Button onClick={() => void sw.start(p.id)} disabled={sw.busy} data-test-switch-start={p.id}>
                          {t('testSwitch.start')}
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
`,
      },
    ],
  },
];
