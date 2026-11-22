import { DbError } from './errors';

/**
 * Landing 29: every attempt of a browser read or write logs one line — the function, how long it took, how it ended
 * and which attempt it was — the browser's twin of the server's `[serverRpc]` line (server-rpc.ts) and the shell's
 * `[refetch]` line. Timings only, never data. A slow page can then be read off the console, attempt by attempt,
 * instead of being rebuilt from the network panel.
 */
export const BROWSER_RPC_TAG = '[browserRpc]';

/** How a failed attempt ended: the error's kind, or `Error` for anything that is not a database error. */
export const attemptKind = (e: unknown): string => (e instanceof DbError ? e.kind : 'Error');

export function logAttempt(at: {
  fn: string;
  ms: number;
  outcome: 'ready' | 'failed';
  /** The error kind of a failed attempt. */
  kind?: string;
  /** 1 for the first ask, 2 for the automatic second one. */
  attempt: number;
  /** True when this attempt is the automatic retry. */
  retry: boolean;
}) {
  const kind = at.outcome === 'failed' ? ` kind=${at.kind ?? 'Error'}` : '';
  console.log(
    `${BROWSER_RPC_TAG} fn=${at.fn} ms=${at.ms} outcome=${at.outcome}${kind} attempt=${at.attempt} retry=${at.retry}`,
  );
}
