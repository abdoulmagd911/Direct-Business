import { describe, expect, it } from 'vitest';
import { deviceLabel } from '../../../src/core/auth/device-label';
import { maskEmail } from '../../../src/core/auth/mask';
import { refusalOf } from '../../../src/core/auth/me';
import { safeNext } from '../../../src/core/auth/safe-next';
import { toDbError } from '../../../src/core/db/errors';

// P3-2's small rules, one promise each. Sabotages: tests/sabotage/blind-sign-in-helpers.mjs turn each red.
describe('the sign-in helpers mask, return and name safely', () => {
  it('masks an email to its first letters and ending', () => {
    expect(maskEmail('test.am1@example.com')).toBe('t•••••••@e••••••.com');
    expect(maskEmail('test@cd.example')).toBe('t•••••@c•••.example');
    expect(maskEmail('not-an-email')).toBe('•••••');
  });

  it('returns only to an address on this site, never to the sign-in page', () => {
    expect(safeNext('/partners/7?tab=files')).toBe('/partners/7?tab=files');
    for (const bad of [
      '//evil.example/x',
      'https://evil.example',
      '/\\evil.example',
      'partners',
      '/sign-in?next=/x',
      '/auth/sign-out',
      '/a\nb',
      null,
      '',
    ])
      expect(safeNext(bad)).toBe('/');
  });

  it('names a device by its browser and system only', () => {
    const chromeWindows =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
    const safariIphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const edgeMac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0';
    expect(deviceLabel(chromeWindows)).toBe('Chrome · Windows');
    expect(deviceLabel(safariIphone)).toBe('Safari · iPhone');
    expect(deviceLabel(edgeMac)).toBe('Edge · Mac');
    expect(deviceLabel('curl/8.0')).toBeNull();
    expect(deviceLabel(null)).toBeNull();
  });

  it('turns a database refusal into its typed error and key', () => {
    expect(toDbError({ code: '42501', message: 'access.needs_admin' })).toMatchObject({
      kind: 'PermissionDenied',
      key: 'access.needs_admin',
    });
    expect(toDbError({ code: 'P0001', message: 'person.manager_cycle' })).toMatchObject({
      kind: 'RuleBroken',
      key: 'person.manager_cycle',
    });
    expect(toDbError({ code: '23505', message: 'person_email.taken' })).toMatchObject({ kind: 'RuleBroken' });
    expect(toDbError({ code: 'P0002', message: 'common.not_found' })).toMatchObject({ kind: 'NotFound' });
    expect(toDbError({ code: '42501', message: 'permission denied for schema api' })).toMatchObject({
      kind: 'PermissionDenied',
      key: 'access.denied',
    });
    expect(toDbError({ code: 'PGRST202', message: 'Could not find the function' })).toMatchObject({
      kind: 'Unavailable',
    });
  });

  it('shows the right line for each refusal the gate reports', () => {
    expect(refusalOf({ status: 'signed_out', reason: 'inactive' })).toBe('inactive');
    expect(refusalOf({ status: 'signed_out', reason: 'admin' })).toBe('signed_out_by_admin');
    expect(refusalOf({ status: 'signed_out', reason: 'person' })).toBe('signed_out_elsewhere');
    expect(refusalOf({ status: 'switched_off' })).toBe('switched_off');
    expect(refusalOf({ status: 'signed_out', reason: 'unknown' })).toBeNull();
  });
});
