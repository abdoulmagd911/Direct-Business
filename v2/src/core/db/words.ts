import { DbError } from './errors';

/**
 * The general line of a refused change carries its detail after a colon ("This change was refused: due_on"); with no
 * detail to give it has a line of its own, so it never ends on a bare colon (13 Nov: a database refusal with no words of
 * its own and no detail — `common.invalid`, among about 180 such keys — read "This change was refused:" and nothing).
 */
const bare = (key: string, detail: string) =>
  key === 'errors.kind.RuleBroken' && !detail.trim() ? 'errors.kind.RuleBrokenBare' : key;

/**
 * The catalog key for a refusal: `errors.<key>` when the catalog has the exact key, else the kind's general line
 * (`errors.kind.<kind>`). Screens pass the result to `t()`; the detail (a field, a name) fills `{detail}`.
 */
export function errorKey(e: unknown, has: (key: string) => boolean): { key: string; detail: string } {
  if (e instanceof DbError) {
    const detail = e.detail ?? '';
    // A database check with no wording key (23514 …) is a rule broken, said with its detail — not "the server did not answer".
    if (e.kind === 'RuleBroken' && e.key === 'common.unavailable')
      return { key: bare('errors.kind.RuleBroken', detail), detail };
    const exact = `errors.${e.key}`;
    return { key: has(exact) ? exact : bare(`errors.kind.${e.kind}`, detail), detail };
  }
  return { key: 'errors.kind.Unavailable', detail: e instanceof Error ? e.message : '' };
}
