import { DbError } from '@/core/db/errors';
import { failureRef } from '@/core/db/read-again';

/**
 * Why a read did not answer, for the screen's failed state (Landing 34: a failed list or record used to say only
 * "could not load", or nothing at all): a refusal the database gave, a read the database cut off for time (live
 * stops a call at 8 seconds — SQLSTATE 57014), or a read that never got an answer. `ref` is the kind and the code
 * (core/db/read-again failureRef) — never the error's free text, so nothing from the data rides along.
 */
export type ReadFailure = { kind: 'refused' | 'timeout' | 'unavailable'; ref: string };

const TIMEOUT = /^57014\b|timed out|timeout|canceling statement/i;

export function readFailure(e: unknown): ReadFailure {
  const ref = failureRef(e);
  if (e instanceof DbError && e.kind === 'PermissionDenied') return { kind: 'refused', ref };
  if (e instanceof DbError && e.kind === 'Unavailable' && TIMEOUT.test(e.detail ?? '')) return { kind: 'timeout', ref };
  return { kind: 'unavailable', ref };
}
