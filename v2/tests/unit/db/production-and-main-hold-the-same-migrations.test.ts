import { describe, expect, it } from 'vitest';
import { compare, fileVersions, remoteVersions, report } from '../../../scripts/db/prod-sync.mjs';

// The production job's last step (V181): after `supabase db push`, production and main must hold the same migrations,
// or the job fails and names each one that differs. Sabotages: tests/sabotage/prod-sync-blind.mjs.
const FILES = ['.gitkeep', '20260929000000_core_foundation.sql', '20260929000100_core_people_audit.sql'];
const listed = (rows: Array<{ local: string; remote: string }>) =>
  JSON.stringify({ migrations: rows.map((r) => ({ ...r, time: '' })), message: 'Migrations listed' });

describe('production and main hold the same migrations', () => {
  it('agrees when every file is applied and nothing else is', () => {
    const local = fileVersions(FILES);
    const remote = remoteVersions(
      listed([
        { local: '20260929000000', remote: '20260929000000' },
        { local: '20260929000100', remote: '20260929000100' },
      ]),
    );
    const out = report(compare(local, remote), local.length, 'production');
    expect(out.ok).toBe(true);
    expect(out.lines).toEqual(['production and main agree: the same 2 migrations.']);
  });

  it('names a migration in main that production has not applied', () => {
    const local = fileVersions([...FILES, '20260930020000_core_accounts_in_no_team_and_supplier_types.sql']);
    const remote = remoteVersions(
      listed([
        { local: '20260929000000', remote: '20260929000000' },
        { local: '20260929000100', remote: '20260929000100' },
        { local: '20260930020000', remote: '' },
      ]),
    );
    const out = report(compare(local, remote), local.length, 'production');
    expect(out.ok).toBe(false);
    expect(out.lines).toContain('::error::20260930020000 is in main but not applied on production.');
  });

  it('names a migration production holds that is not a file in main', () => {
    const local = fileVersions(FILES);
    const remote = remoteVersions(
      listed([
        { local: '20260929000000', remote: '20260929000000' },
        { local: '20260929000100', remote: '20260929000100' },
        { local: '', remote: '20260930031356' },
      ]),
    );
    const out = report(compare(local, remote), local.length, 'production');
    expect(out.ok).toBe(false);
    expect(out.lines).toContain('::error::20260930031356 is applied on production but is not a file in main.');
  });

  it('reads the list around a notice the CLI prints, and refuses an answer with no list', () => {
    const noisy = `A new version of Supabase CLI is available\n${listed([{ local: '1', remote: '1' }])}\n`;
    expect(remoteVersions(noisy)).toEqual(['1']);
    expect(() => remoteVersions('{"message":"no list"}')).toThrow(/without a "migrations" list/);
  });
});
