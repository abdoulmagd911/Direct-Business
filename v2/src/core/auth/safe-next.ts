// The address a signed-out deep link returns to after sign-in (?next=…). Only an address on this site: a path that
// starts with one "/" — never "//host", a scheme, or a backslash trick — and never back to the sign-in page itself.
// It is judged as the browser will read it (QA-562): resolved, so dot segments ("/.//host", "/%2e%2e//host") that
// collapse into "//host" are refused, and what comes back is the resolved, percent-encoded path.
// The app's own first segments (src/app/(app)/… plus the set-password page): a return address to any other first
// segment names a route that does not exist — a stale ?next=%2Fforgot-password used to pass validation and land
// on a 404 (F-B5-09) — so it falls back to My day ('/') instead. '/' itself (no first segment) is allowed.
const KNOWN_FIRST = new Set([
  'achievements',
  'activity',
  'appraisal',
  'clients',
  'codes',
  'files',
  'finance',
  'kit',
  'kpis',
  'my-day',
  'overview',
  'partners',
  'people',
  'pipeline',
  'profile',
  'projects',
  'recently-deleted',
  'reports',
  'set-password',
  'settings',
  'suppliers',
  'tasks',
]);

export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  const path = sitePath(next);
  if (!path) return fallback;
  if (path === '/sign-in' || path.startsWith('/sign-in?') || path.startsWith('/auth/')) return fallback;
  const first = path.split(/[?#]/)[0]?.split('/')[1] ?? '';
  if (first !== '' && !KNOWN_FIRST.has(first)) return fallback;
  return path;
}

const PLACEHOLDER = 'http://placeholder.invalid';

/**
 * A path as the browser will resolve it on this site — pathname, query and fragment, percent-encoded — or null when it
 * would leave the site: another origin, or a path that resolves to start with "//" or "/\" (read by the browser as
 * another host). Used for every relative redirect (QA-561, QA-562).
 */
export function sitePath(path: string): string | null {
  let url: URL;
  try {
    url = new URL(path, PLACEHOLDER);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER) return null;
  if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\')) return null;
  return url.pathname + url.search + url.hash;
}
