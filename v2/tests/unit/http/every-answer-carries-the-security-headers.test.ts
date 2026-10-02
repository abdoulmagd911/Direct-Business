import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from '@/core/http/security-headers';

// W31: the security headers, as next.config.ts sends them on every answer. Made-up project address.
const DB = 'https://madeupproject.supabase.co';
const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('every answer carries the security headers', () => {
  it('sends each header once', () => {
    const names = securityHeaders(DB).map((h) => h.key);
    expect(names).toEqual([
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
      'Cross-Origin-Opener-Policy',
    ]);
    const value = (k: string) => securityHeaders(DB).find((h) => h.key === k)?.value;
    expect(value('X-Frame-Options')).toBe('DENY');
    expect(value('X-Content-Type-Options')).toBe('nosniff');
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(value('Permissions-Policy')).toContain('camera=()');
  });
  it('no other site may frame the app, and nothing loads from anywhere but the app and its database', () => {
    const csp = contentSecurityPolicy(DB);
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'connect-src')).toBe(`connect-src 'self' ${DB} wss://madeupproject.supabase.co`);
    expect(directive(csp, 'img-src')).toBe(`img-src 'self' data: blob: ${DB}`);
  });
  it('only development may evaluate code', () => {
    expect(directive(contentSecurityPolicy(DB), 'script-src')).not.toContain('unsafe-eval');
    expect(directive(contentSecurityPolicy(DB, true), 'script-src')).toContain("'unsafe-eval'");
  });
  it('the local stack, over plain http, is reached over ws', () => {
    expect(directive(contentSecurityPolicy('http://127.0.0.1:54321'), 'connect-src')).toBe(
      "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321",
    );
  });
});
