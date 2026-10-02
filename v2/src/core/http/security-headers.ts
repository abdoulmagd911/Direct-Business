// The headers every answer carries (W31). The page may load only its own files and talk only to its own server and
// the Supabase project; no other site may frame it; the browser never guesses a file's type; another site is told the
// origin only; camera, microphone, location and payment are off. Read by next.config.ts at build time, so the
// project's address must be in the build's environment (it already is: the browser bundle needs it too).
//
// Next.js writes its own small inline scripts (the page's data for hydration), so scripts may be inline; a nonce for
// each would cost every page its caching for little gain in an internal app. Development adds 'unsafe-eval' for React.

export interface Header {
  key: string;
  value: string;
}

/** The Content-Security-Policy for an app whose database is at `supabaseUrl`. */
export function contentSecurityPolicy(supabaseUrl: string, dev = false): string {
  const db = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const live = db ? db.replace(/^http/, 'ws') : '';
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', db]],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', ["'self'", db, live]],
    ['frame-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ];
  return directives.map(([name, sources]) => [name, ...sources.filter(Boolean)].join(' ')).join('; ');
}

/** Every security header, in the order they are sent. */
export function securityHeaders(supabaseUrl: string, dev = false): Header[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(supabaseUrl, dev) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}
