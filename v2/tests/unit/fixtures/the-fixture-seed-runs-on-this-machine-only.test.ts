import { describe, expect, it } from 'vitest';
import { notLocal, notMadeUp } from '../../../scripts/fixtures/guard.mjs';

// The fixture seed (scripts/fixtures/seed-local.mjs) writes a made-up world, so it refuses any address that is not on
// this machine, and any database that already allows an address outside @example.test. Sabotages:
// tests/sabotage/fixtures-guard.mjs.
describe('the fixture seed runs on this machine only', () => {
  it('runs against the local stack', () => {
    expect(
      notLocal({ api: 'http://127.0.0.1:54321', db: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' }),
    ).toBeNull();
    expect(notLocal({ api: 'http://localhost:54321' })).toBeNull();
  });
  it('refuses a cloud project, whichever address points at it', () => {
    expect(notLocal({ api: 'https://abcdefghijklmnop.supabase.co', db: 'postgresql://x@127.0.0.1:54322/p' })).toMatch(
      /not this machine/,
    );
    expect(notLocal({ api: 'http://127.0.0.1:54321', db: 'postgresql://postgres@db.cloud.example:5432/p' })).toMatch(
      /not this machine/,
    );
  });
  it('refuses when an address is missing', () => {
    expect(notLocal({ api: undefined })).toMatch(/not set/);
  });
  it('refuses a database that allows an address it did not make up', () => {
    expect(notMadeUp(['fixture.admin@example.test', 'someone@example.com'])).toMatch(/not a made-up one/);
    expect(notMadeUp(['fixture.admin@example.test', 'test.e2e-1@EXAMPLE.TEST'])).toBeNull(); // check-allow: rule-7 — a made-up address in capitals
    expect(notMadeUp([])).toBeNull();
  });
});
