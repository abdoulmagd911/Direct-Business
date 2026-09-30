// The database answers every refusal with a key (V110), and the app turns it into one of five typed errors (TECH-SPEC
// §2.4) — never a silent "Saved". Screens show the key's wording; nothing parses English text.

export type DbErrorKind = 'PermissionDenied' | 'Conflict' | 'RuleBroken' | 'NotFound' | 'Unavailable';

export class DbError extends Error {
  constructor(
    readonly kind: DbErrorKind,
    /** The wording key, e.g. `access.needs_level` or `people.email_taken`. */
    readonly key: string,
    readonly detail?: string,
  ) {
    super(`${kind}: ${key}${detail ? ` (${detail})` : ''}`);
    this.name = 'DbError';
  }
}

/** The shape PostgREST (and supabase-js) report an error in. */
export interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

const KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

/** Maps one database error to its typed error. Unknown or transport errors are Unavailable, never "fine". */
export function toDbError(e: PostgrestLikeError): DbError {
  const code = e.code ?? '';
  const message = e.message ?? '';
  const key = KEY.test(message) ? message : 'common.unavailable';
  const detail = e.details ?? undefined;
  if (code === '42501') return new DbError('PermissionDenied', KEY.test(message) ? message : 'access.denied', detail);
  if (code === 'P0002') return new DbError('NotFound', KEY.test(message) ? message : 'common.not_found', detail);
  if (code === '40001') return new DbError('Conflict', KEY.test(message) ? message : 'common.conflict', detail);
  if (code === 'P0001' || code.startsWith('23')) return new DbError('RuleBroken', key, detail);
  return new DbError('Unavailable', 'common.unavailable', [code, message].filter(Boolean).join(' '));
}

/** Unwraps a supabase-js result: the data, or the typed error thrown. */
export function unwrap<T>(result: { data: T | null; error: PostgrestLikeError | null }): T {
  if (result.error) throw toDbError(result.error);
  return result.data as T;
}
