import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import check from '../../../scripts/checks/forward-only-migrations.mjs';
import { findings, fixture, git } from './helpers';

const M1 = 'supabase/migrations/20260929000000_core_init.sql';
const M2 = 'supabase/migrations/20260930000000_core_people.sql';

/** A repository whose branch "base" holds M1 and M2, checked out on a feature branch. */
function repoWithBase() {
  const root = fixture({ [M1]: 'create schema core;\n', [M2]: 'create table core.person (id uuid primary key);\n' });
  git(root, 'init', '-q', '-b', 'base');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'feature');
  return root;
}
const write = (root: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

// Sabotage: tests/sabotage/blind-checks.mjs "forward-only-migrations" turns this red.
describe('the migrations check refuses editing history or running out of order', () => {
  it('refuses a bad name, an impossible date, a shared timestamp, an empty file and pg_get_functiondef', async () => {
    const root = fixture({
      'supabase/migrations/001_init.sql': 'select 1;\n',
      'supabase/migrations/20261332000000_core_bad_date.sql': 'select 1;\n',
      'supabase/migrations/20261001000000_core_a.sql': 'select 1;\n',
      'supabase/migrations/20261001000000_core_b.sql': 'select 1;\n',
      'supabase/migrations/20261002000000_core_empty.sql': '-- nothing\n',
      'supabase/migrations/20261003000000_core_patch.sql': "select pg_get_functiondef('api.me'::regproc);\n",
    });
    const got = await findings(check, root);
    const files = got.map((f) => f.file.replace('supabase/migrations/', '')).sort();
    expect(files).toEqual([
      '001_init.sql',
      '20261001000000_core_b.sql',
      '20261002000000_core_empty.sql',
      '20261003000000_core_patch.sql',
      '20261332000000_core_bad_date.sql',
    ]);
  });

  it('refuses editing or deleting a migration the base has, and a new one older than the newest on the base', async () => {
    const root = repoWithBase();
    write(root, M1, 'create schema core; -- edited\n');
    fs.rmSync(path.join(root, M2));
    write(root, 'supabase/migrations/20260929120000_core_late.sql', 'select 1;\n');
    const got = await findings(check, root, { V2_BASE_REF: 'base' });
    expect(got.map((f) => `${f.file} ${f.message.split(' ')[0]}`).sort()).toEqual([
      `${M1} edits`,
      'supabase/migrations/20260929120000_core_late.sql new',
      `${M2} deletes`,
    ]);
  });

  it('allows a new migration after the newest on the base, and says so when the base cannot be read', async () => {
    const root = repoWithBase();
    write(root, 'supabase/migrations/20261001000000_core_next.sql', 'create table core.team (id uuid primary key);\n');
    expect(await findings(check, root, { V2_BASE_REF: 'base' })).toEqual([]);
    const missing = await findings(check, root, { V2_BASE_REF: 'origin/nowhere' });
    expect(missing).toHaveLength(1);
    expect(missing[0]?.message).toContain('cannot read the base origin/nowhere');
  });
});
