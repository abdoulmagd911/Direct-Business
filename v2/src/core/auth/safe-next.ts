// The address a signed-out deep link returns to after sign-in (?next=…). Only an address on this site: a path that
// starts with one "/" — never "//host", a scheme, or a backslash trick — and never back to the sign-in page itself.
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (next === '/sign-in' || next.startsWith('/sign-in?') || next.startsWith('/auth/')) return fallback;
  return next;
}
