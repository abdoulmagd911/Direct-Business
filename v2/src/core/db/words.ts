import { DbError } from './errors';

/**
 * The catalog key for a refusal: `errors.<key>` when the catalog has the exact key, else the kind's general line
 * (`errors.kind.<kind>`). Screens pass the result to `t()`; the detail (a field, a name) fills `{detail}`.
 */
export function errorKey(e: unknown, has: (key: string) => boolean): { key: string; detail: string } {
  if (e instanceof DbError) {
    // A database check with no wording key (23514 …) is a rule broken, said with its detail — not "the server did not answer".
    if (e.kind === 'RuleBroken' && e.key === 'common.unavailable')
      return { key: 'errors.kind.RuleBroken', detail: e.detail ?? '' };
    const exact = `errors.${e.key}`;
    return { key: has(exact) ? exact : `errors.kind.${e.kind}`, detail: e.detail ?? '' };
  }
  return { key: 'errors.kind.Unavailable', detail: e instanceof Error ? e.message : '' };
}
