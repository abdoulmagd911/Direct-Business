import path from 'node:path';
import { describe, expect, it } from 'vitest';
import productionJob, { mainOnly } from '../../../scripts/checks/production-job.mjs';
import { findings, fixture } from './helpers';

// QA-502: the production database job keeps its three guards (QA-185, QA-186). Sabotage: tests/sabotage/blind-checks.mjs
// "production-job" turns this red; tests/sabotage/production-job.mjs plants each missing guard in the real workflow.
const job = (lines: string[]) =>
  [
    'jobs:',
    '  checks:',
    '    runs-on: ubuntu-latest',
    '  db-production:',
    '    name: production database applies main',
    ...lines,
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '  later:',
    '    runs-on: ubuntu-latest',
    '',
  ].join('\n');
const IF =
  "    if: github.ref == 'refs/heads/v2/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')";
const ENV = '    environment: production';
const NEEDS = '    needs: [checks, db-plain, db-supabase]';

async function run(workflow: string | null) {
  const root = fixture({ 'v2/README.md': 'made up', ...(workflow ? { '.github/workflows/v2.yml': workflow } : {}) });
  return (await findings(productionJob, path.join(root, 'v2'))).map((f) => f.message);
}

describe('the production-job check refuses a production job without its guards', () => {
  it('a job with its three guards is clean, in either way of writing the list', async () => {
    expect(await run(job([IF, ENV, NEEDS]))).toEqual([]);
    expect(
      await run(
        job([
          IF,
          '    environment:',
          '      name: production',
          '    needs:',
          '      - checks',
          '      - db-plain',
          '      - db-supabase',
        ]),
      ),
    ).toEqual([]);
  });
  it('refuses a job outside the environment that holds the password', async () => {
    expect(await run(job([IF, NEEDS]))).toEqual([expect.stringContaining('environment "production"')]);
    expect(await run(job([IF, '    environment: staging', NEEDS]))).toEqual([
      expect.stringContaining('environment "production"'),
    ]);
  });
  it('refuses a job that does not wait for the checks and both databases', async () => {
    expect(await run(job([IF, ENV]))).toEqual([expect.stringContaining('missing checks, db-plain, db-supabase')]);
    expect(await run(job([IF, ENV, '    needs: [checks, db-plain]']))).toEqual([
      expect.stringContaining('missing db-supabase'),
    ]);
  });
  it('refuses a job that may run off v2/main', async () => {
    expect(await run(job([ENV, NEEDS]))).toEqual([expect.stringContaining('v2/main only')]);
    expect(mainOnly("github.ref == 'refs/heads/v2/main'")).toBe(true);
    expect(mainOnly("${{ github.ref == 'refs/heads/v2/main' && (github.event_name == 'push') }}")).toBe(true);
    expect(mainOnly("github.ref == 'refs/heads/v2/main' || github.event_name == 'workflow_dispatch'")).toBe(false);
    expect(mainOnly("github.ref == 'refs/heads/v2/main' && (a) || (b)")).toBe(false);
    expect(mainOnly("github.event_name == 'push'")).toBe(false);
  });
  it('a workflow without the job is refused; a fixture without a workflow has nothing to check', async () => {
    expect(await run('jobs:\n  checks:\n    runs-on: ubuntu-latest\n')).toEqual([
      expect.stringContaining('db-production job is missing'),
    ]);
    expect(await run(null)).toEqual([]);
  });
});
