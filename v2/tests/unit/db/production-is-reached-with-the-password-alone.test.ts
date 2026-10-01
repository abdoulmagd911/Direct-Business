import { describe, expect, it } from 'vitest';
import { candidates, hide, pick, reason } from '../../../scripts/db/prod-url.mjs';

// The production job reaches the database with its password alone, through the region's pooler (V181). The values
// here are made up. Sabotages: tests/sabotage/prod-url-blind.mjs.
const PASSWORD = 'made-up p@ss/word:1';

describe('production is reached with the database password alone', () => {
  it("tries the region's newer pooler first, in session mode, with the password encoded", () => {
    const list = candidates('abcdefghijklmnopqrst', 'eu-central-1', PASSWORD);
    expect(list.map((c) => c.host)).toEqual([
      'aws-1-eu-central-1.pooler.supabase.com',
      'aws-0-eu-central-1.pooler.supabase.com',
    ]);
    expect(list[0]?.url).toBe(
      // check-allow: rule-7 — a made-up ref and password in the pooler address's shape
      'postgresql://postgres.abcdefghijklmnopqrst:made-up%20p%40ss%2Fword%3A1@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    );
  });

  it('keeps the first pooler that knows the project, and names each refusal when none does', () => {
    const list = candidates('abcdefghijklmnopqrst', 'eu-central-1', PASSWORD);
    const second = pick(list, (c) =>
      c.host.startsWith('aws-0') ? { ok: true } : { ok: false, error: '\nTenant or user not found\n' },
    );
    expect(second.found?.host).toBe('aws-0-eu-central-1.pooler.supabase.com');
    const none = pick(list, () => ({ ok: false, error: 'Tenant or user not found' }));
    expect(none.found).toBeNull();
    expect(none.refusals).toEqual([
      'aws-1-eu-central-1.pooler.supabase.com: Tenant or user not found',
      'aws-0-eu-central-1.pooler.supabase.com: Tenant or user not found',
    ]);
  });

  it("says why a pooler refused: the CLI's own message, not its greeting", () => {
    const cli =
      'Connecting to remote database...\n' +
      '{"_tag":"Error","error":{"code":"DbConnectError","message":"failed to connect to postgres: Tenant or user not found"}}\n';
    expect(reason(cli)).toBe('failed to connect to postgres: Tenant or user not found');
    expect(reason('Connecting to remote database...\nsome plain failure\n')).toBe('some plain failure');
    expect(reason('')).toBe('no answer');
  });

  it('never prints the password, as typed or as encoded', () => {
    const url = candidates('abcdefghijklmnopqrst', 'eu-central-1', PASSWORD)[0]?.url ?? '';
    const said = hide(`failed to connect to ${url} (password ${PASSWORD})`, PASSWORD);
    expect(said).not.toContain(PASSWORD);
    expect(said).not.toContain(encodeURIComponent(PASSWORD));
    expect(said).toContain('***');
  });
});
