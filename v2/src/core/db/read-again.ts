import { DbError } from './errors';

/**
 * F-B3-04: one more try for a read the gateway held and dropped. serverRpc already tries twice, 250 ms
 * apart (readTwice, W43); a stall that outlasts both still answers on a third try a second later, so an
 * intermittent 555 no longer drops a read into a failed state. Only a failure in transit is retried —
 * a refusal the database gave (an answer, never a stall) returns null at once. A page gives each of its
 * reads its own readAgain, so one failing read never takes the whole page down (Landing 28: the Activity
 * page awaited three reads with no catch, and one refusal drew the full-page error).
 *
 * `onFail` is handed the error that ended the read (Landing 28), so the failed state can say what failed
 * instead of only that something did.
 */
export async function readAgain<T>(call: () => Promise<T>, onFail?: (e: unknown) => void): Promise<T | null> {
  try {
    return await call();
  } catch (e) {
    if (!(e instanceof DbError) || e.kind !== 'Unavailable') {
      onFail?.(e);
      return null;
    }
    await new Promise((done) => setTimeout(done, 1000));
    try {
      return await call();
    } catch (again) {
      onFail?.(again);
      return null;
    }
  }
}

const CODE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/;

/**
 * A failed read's reference for the screen (Landing 28): the typed error's kind and its code — the database's
 * or the gateway's own code for a failure in transit ("Unavailable · 57014"), the wording key for a refusal
 * ("PermissionDenied · access.denied"). Never the error's free text: only a kind, a code or a key reaches the
 * screen, so nothing from the data can ride along.
 */
export function failureRef(e: unknown): string {
  if (!(e instanceof DbError)) return 'Unknown';
  if (e.kind !== 'Unavailable') return `${e.kind} · ${e.key}`;
  const code = (e.detail ?? '').split(' ')[0] ?? '';
  return CODE.test(code) ? `${e.kind} · ${code}` : e.kind;
}
