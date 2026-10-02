// QA-502: each guard of the production database job, deleted from the real workflow, must turn the production-job
// check red (QA-185 needs, QA-186 environment, the v2/main-only if:).
const WORKFLOW = '../.github/workflows/v2.yml';

export const sabotages = [
  {
    name: 'production-job-without-its-environment',
    breaks: ['check:production-job'],
    expect: 'environment "production"',
    edits: [{ file: WORKFLOW, find: '    environment: production\n', replace: '' }],
  },
  {
    name: 'production-job-without-needs',
    breaks: ['check:production-job'],
    expect: 'missing checks, db-plain, db-supabase',
    edits: [{ file: WORKFLOW, find: '    needs: [checks, db-plain, db-supabase]\n', replace: '' }],
  },
  {
    name: 'production-job-off-main',
    breaks: ['check:production-job'],
    expect: 'v2/main only',
    edits: [
      {
        file: WORKFLOW,
        find: "    if: github.ref == 'refs/heads/v2/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')\n",
        replace: "    if: github.ref == 'refs/heads/v2/main' || github.event_name == 'workflow_dispatch'\n",
      },
    ],
  },
];
