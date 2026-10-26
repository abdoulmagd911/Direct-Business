// QA-592: the People and Teams tables of Settings fit their box in Arabic at 1,280 and 1,440 px.
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
        <table className="w-full table-fixed text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="w-[24%]`,
        replace: `sm:block">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="text-xs text-muted">
            <tr>
              <th className="w-[24%]`,
      },
    ],
  },
];
