'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { commandBusy, onRefetch } from '@/core/commands/refetch';
import { attemptKind, logAttempt } from '@/core/db/attempt-log';
import { browserDb } from '@/core/db/client';
import { DbError, unwrap } from '@/core/db/errors';
import type { ApiArgs, ApiFunction } from '@/core/db/rpc';

// The Finance Overview's reads (P4-5; the oversight's defect of 12 Oct). Every figure on the page is a view over every
// unit, so a read costs time in proportion to the data, and six of them at once — times each period tab the person
// flicks through — pile up past the database's 8-second limit and fail ("could not be loaded"). So the page does not
// ask for everything together: at most TWO reads are in flight from this browser at any moment (the rest wait their
// turn, first asked first served), a read the person has moved away from is cancelled before it starts (once sent it runs on and
// its answer is dropped, so the database is never asked for more than two statements at once), a read that fails for the database's timeout or a dropped connection is asked once more after a pause, and
// each block fails and retries on its own — Try again repeats that one read, never the page.
//
// L15 (F-B3-06): the limit stays TWO. A stalled read's own fail-and-retry cycle is the time to its error, not the
// queue — the other blocks fill in seconds either way, so raising the limit would not shorten the failure and would
// risk the 8-second pile-up again.
//
// Landing 34 (the 19 Nov test round — "Loading" for ever, a Try again that did nothing): every read now SETTLES.
// These reads bypass `rpc()`, so nothing bounded them: a request the network never answered held its slot for good,
// two of them held both slots, and every later read — a Try again too — waited behind them with no end. A request
// with no answer after DEADLINE_MS is now let go and its block fails in words. The deadline is far past the
// database's own 8-second limit and the gateway's 10, so by then no statement of this read is still working and the
// slot can be handed on (QA-552 stands: a slot is never released under a statement that may still run). A read that
// ran into the deadline is not asked a second time on its own — that would be another DEADLINE_MS of "Loading"; the
// person's Try again asks it.
//
// And a window that only comes BACK (the shell asks every screen to refetch on focus, after 15 s away) no longer
// throws the page's reads away: before, each of the page's eight reads dropped its answer — one still on its way
// too — and asked again, so looking at another tab during a slow first load started the whole load over. Now only a
// write does that; a window coming back re-asks an answer that has gone old, and leaves a read in flight alone.
//
// Landing 34, the follow-up ("What needs attention" stuck on Loading): that last fix never worked in the real app.
// The window coming back was told from a write by a mark that lasted until the end of the browser's own focus event —
// and the same landing made the shell wait FOCUS_SETTLE_MS (400 ms) after that event before it asks for the refetch.
// The mark was long gone by then, so every return of the window still counted as a write: all the reads thrown away
// and asked again, one still on its way too. A block that had answered kept its figures meanwhile; the one that had
// not — the health line, asked last and the heaviest — began again at the back of the queue each time, and sat on
// "Loading" for as long as the person kept coming back to the window. Now the moment the window came back is kept
// (BACK_WINDOW_MS), and a write says that it is one (commandBusy, or financeWrote from this module's own screens).
// A block also knows a REFUSAL from a failure (`refused`), and Try again never answers from what was kept.

/** How many Finance reads this browser has in flight at once. */
export const LIMIT = 2;
/** The pause before the one automatic second ask of a read that failed for time or transport. */
export const RETRY_AFTER_MS = 1200;
/** A result is kept this long, so flicking back to a period just seen costs nothing; any write clears it. */
const KEEP_MS = 20_000;
/** A request with no answer after this long is let go: the block fails in words, with Try again (see the note above). */
export const DEADLINE_MS = 20_000;
/** A window brought back re-asks an answer older than this; a fresher one, or a read still on its way, is left alone. */
export const BACK_STALE_MS = 60_000;

let running = 0;
const waiting: { start: () => void }[] = [];
const kept = new Map<string, { at: number; data: unknown }>();

function release() {
  running -= 1;
  waiting.shift()?.start();
}

function acquire(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new DOMException('cancelled', 'AbortError'));
    if (signal.aborted) return aborted();
    const start = () => {
      running += 1;
      resolve(release);
    };
    if (running < LIMIT) return start();
    const entry = { start };
    waiting.push(entry);
    signal.addEventListener(
      'abort',
      () => {
        const at = waiting.indexOf(entry);
        if (at >= 0) {
          waiting.splice(at, 1);
          aborted();
        }
      },
      { once: true },
    );
  });
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('cancelled', 'AbortError'));
      },
      { once: true },
    );
  });

const isCancel = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** The errors of requests that ran into the deadline: such a read is not asked a second time on its own. */
const noAnswer = new WeakSet<object>();

/**
 * One request to the database, bounded: it answers, fails, or — with no answer after DEADLINE_MS — is let go and
 * fails as "could not be reached". It always settles, so the slot it holds is always handed on.
 */
function ask<T>(fn: ApiFunction, args: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = new AbortController();
    const timer = setTimeout(() => {
      const late = new DbError('Unavailable', 'common.unavailable', `${fn} gave no answer in ${DEADLINE_MS / 1000}s`);
      noAnswer.add(late);
      reject(late);
      stop.abort();
    }, DEADLINE_MS);
    const call = browserDb().rpc(fn as never, args as never) as unknown as PromiseLike<unknown> & {
      abortSignal?: (signal: AbortSignal) => PromiseLike<unknown>;
    };
    Promise.resolve(typeof call.abortSignal === 'function' ? call.abortSignal(stop.signal) : call).then(
      (result) => {
        clearTimeout(timer);
        try {
          resolve(unwrap(result as never) as T);
        } catch (e) {
          reject(e);
        }
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Reads sent and not yet settled, by key: a second ask for the same read waits for the first, it does not send another. */
const inFlight = new Map<string, Promise<unknown>>();
/** Counts the writes seen: an answer that was asked for before a write is never kept after it. */
let epoch = 0;

/** The person may move on before the answer arrives: they stop waiting at once, the request itself runs on. */
function whileWaiting<T>(request: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancelled = () => reject(new DOMException('cancelled', 'AbortError'));
    if (signal.aborted) return cancelled();
    signal.addEventListener('abort', cancelled, { once: true });
    request.then(
      (v) => {
        signal.removeEventListener('abort', cancelled);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', cancelled);
        reject(e);
      },
    );
  });
}

/**
 * One request, from its slot to its end. A request that has been sent is NEVER cancelled: cancelling the browser's
 * request does not end the statement the database is running, so letting go of the slot then would start the next read
 * beside a statement that is still working (QA-552). The slot is held until the request has settled; a person who
 * moved on simply stops waiting, and the answer is kept for a quick return. Only a read still waiting for its turn is
 * cancelled outright.
 */
async function once<T>(key: string, fn: ApiFunction, args: unknown, signal: AbortSignal): Promise<T> {
  const sent = inFlight.get(key);
  if (sent) return whileWaiting(sent as Promise<T>, signal);
  const queuedAt = Date.now();
  const done = await acquire(signal);
  const meanwhile = inFlight.get(key);
  if (meanwhile) {
    done();
    return whileWaiting(meanwhile as Promise<T>, signal);
  }
  // Landing 29: the same read, asked by another block, was sent AND answered while this one waited for its turn —
  // that answer is this one's answer too; sending the read a second time would be a duplicate request.
  const landed = kept.get(key);
  if (landed && landed.at >= queuedAt) {
    done();
    return landed.data as T;
  }
  const asked = epoch;
  const request: Promise<T> = ask<T>(fn, args)
    .then((data) => {
      // an answer of nothing is never kept: the block says it could not be read, and its Try again must ask again
      if (asked === epoch && data !== null && data !== undefined) kept.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
      done();
    });
  inFlight.set(key, request);
  return whileWaiting(request, signal);
}

/**
 * One read: its turn in the queue, one more ask after a pause when it failed for time or transport. `fresh` is the
 * person's own Try again: it always goes to the database, never to what was kept.
 */
export async function readFinance<T>(fn: ApiFunction, args: unknown, signal: AbortSignal, fresh = false): Promise<T> {
  const key = `${fn}|${JSON.stringify(args)}`;
  if (fresh) kept.delete(key);
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.data as T;
  // Landing 29: every attempt logs its own line. A person who moved on is not an outcome of the read, so a wait
  // that was cancelled logs nothing; an answer from what was kept sends nothing and logs nothing either.
  const attempt = async (n: number): Promise<T> => {
    const started = Date.now();
    try {
      const answer = await once<T>(key, fn, args, signal);
      logAttempt({ fn, ms: Date.now() - started, outcome: 'ready', attempt: n, retry: n > 1 });
      return answer;
    } catch (e) {
      if (!isCancel(e) && !signal.aborted)
        logAttempt({ fn, ms: Date.now() - started, outcome: 'failed', kind: attemptKind(e), attempt: n, retry: n > 1 });
      throw e;
    }
  };
  let data: T;
  try {
    data = await attempt(1);
  } catch (e) {
    if (isCancel(e) || signal.aborted) throw e;
    // only a database that could not answer in time (or could not be reached) is worth asking again
    if (!(e instanceof DbError) || e.kind !== 'Unavailable') throw e;
    // a request that got no answer at all has already cost the whole deadline: the person's Try again asks it
    if (noAnswer.has(e)) throw e;
    await pause(RETRY_AFTER_MS, signal);
    data = await attempt(2);
  }
  return data;
}

/** Nothing is kept after a write: the next ask goes to the database (a month closed, an invoice typed). */
export const forgetFinanceReads = () => {
  epoch += 1;
  kept.clear();
  inFlight.clear();
};

/**
 * How long after the window came back a refetch still counts as that return. The shell asks for its focus refetch
 * FOCUS_SETTLE_MS (400 ms) after the browser's focus event (src/ui/shell/RefetchBridge.tsx), so this must be longer
 * than that wait — a unit test holds the two together.
 */
export const BACK_WINDOW_MS = 2_000;

/** When the window last came back (focus, or the tab shown again); null once a refetch or a write has used it up. */
let cameBackAt: number | null = null;

/** The window came back: the shell's refetch that follows is not a write. */
export function windowCameBack(now = Date.now()) {
  cameBackAt = now;
}

/**
 * A write was made from a Finance screen that does not go through `command()`: the refetch asked for right after it
 * is a write, whatever the window did a moment ago. Called just before `refetchAll()`.
 */
export function financeWrote() {
  cameBackAt = null;
}

/**
 * Why the shell is asking every screen to refetch: 'back' when the window came back a moment ago and no write is in
 * flight, 'write' for everything else — a doubt is always a write, so figures are never left old after one.
 */
export function refetchCause(at: { cameBackAt: number | null; now: number; busy: boolean }): 'write' | 'back' {
  if (at.busy || at.cameBackAt === null) return 'write';
  const since = at.now - at.cameBackAt;
  return since >= 0 && since <= BACK_WINDOW_MS ? 'back' : 'write';
}

/** The cause of the refetch being asked for now; a return of the window counts once, for the blocks of one refetch. */
function causeNow(): 'write' | 'back' {
  const cause = refetchCause({ cameBackAt, now: Date.now(), busy: commandBusy() });
  // every block of the page hears the same refetch in one go; after it the return is used up, so a write that
  // follows within the window is a write
  if (cause === 'back')
    setTimeout(() => {
      cameBackAt = null;
    }, 0);
  return cause;
}

if (typeof window !== 'undefined') {
  // the same two signals the shell listens to, and only a window that is shown
  const back = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') windowCameBack();
  };
  window.addEventListener('focus', back, true);
  window.addEventListener('visibilitychange', back, true);
}

/**
 * What one block does when the shell asks every screen to refetch. After a write: ask again, always. When the window
 * only came back: ask again only for an answer that has gone old — a read still on its way, a failed block (it has
 * its own Try again) and a fresh answer are left as they are.
 */
export function refetchPlan(
  cause: 'write' | 'back',
  block: { status: 'loading' | 'ready' | 'failed'; answeredAt: number },
  now: number,
): 'ask' | 'leave' {
  if (cause === 'write') return 'ask';
  return block.status === 'ready' && now - block.answeredAt > BACK_STALE_MS ? 'ask' : 'leave';
}

/**
 * `refused` on a failed block: the database answered, and the answer was "you may not read this" (42501). That is
 * not a failure to say with Try again — asking again gets the same answer — so a block may simply not be drawn.
 */
export type Block<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed'; refused?: boolean };

/** True for the database's refusal of the reader; false for a read that could not be made or timed out. */
export const isRefusal = (e: unknown) => e instanceof DbError && e.kind === 'PermissionDenied';

/**
 * One block of the page: loading, then ready or failed, for one read. The state belongs to the read it was asked
 * for (`key`), so a block never shows another period's figures; `retry` repeats this read only.
 */
export function useFinanceRead<T, F extends ApiFunction>(
  fn: F,
  args: ApiArgs<F>,
  key: string,
  /** False holds the read: nothing is asked until it turns true (the ledger waits for the tiles). */
  enabled = true,
): { block: Block<T>; retry: () => void } {
  const [state, setState] = useState<{ key: string; block: Block<T> }>({ key, block: { status: 'loading' } });
  const [turn, setTurn] = useState(0);
  // the turn the person's own Try again asked for: that ask goes to the database, never to what was kept
  const freshTurn = useRef(-1);
  // what this block holds now and when it was answered, for the refetch listener below (it is registered once)
  const held = useRef<{ status: Block<T>['status']; answeredAt: number }>({ status: 'loading', answeredAt: 0 });
  const argsKey = JSON.stringify(args);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    held.current = { status: 'loading', answeredAt: 0 };
    const fresh = freshTurn.current === turn;
    freshTurn.current = -1;
    readFinance<T>(fn, JSON.parse(argsKey), controller.signal, fresh).then(
      (data) => {
        if (!controller.signal.aborted) held.current = { status: 'ready', answeredAt: Date.now() };
        if (!controller.signal.aborted) setState({ key, block: { status: 'ready', data } });
      },
      (e) => {
        // postgrest-js may hand back an aborted read as an ordinary error, so what counts is whether this effect is
        // still the latest one, not the shape of the error (QA-549)
        if (controller.signal.aborted || isCancel(e)) return;
        held.current = { status: 'failed', answeredAt: 0 };
        setState({ key, block: { status: 'failed', refused: isRefusal(e) } });
      },
    );
    return () => controller.abort();
  }, [fn, argsKey, key, turn, enabled]);
  // a write anywhere clears what was kept and every block asks again; a window that only came back does not (above)
  useEffect(
    () =>
      onRefetch(() => {
        const cause = causeNow();
        if (refetchPlan(cause, held.current, Date.now()) === 'leave') return;
        if (cause === 'write') forgetFinanceReads();
        held.current = { status: 'loading', answeredAt: 0 };
        setTurn((n) => n + 1);
      }),
    [],
  );
  const retry = useCallback(() => {
    held.current = { status: 'loading', answeredAt: 0 };
    setState({ key, block: { status: 'loading' } });
    freshTurn.current = turn + 1;
    setTurn(turn + 1);
  }, [key, turn]);
  // what is on screen is the answer for this read; after a write the old figures stay until the new ones arrive
  return { block: state.key === key ? state.block : { status: 'loading' }, retry };
}
