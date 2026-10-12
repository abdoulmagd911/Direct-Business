'use client';
import { useCallback, useEffect, useState } from 'react';
import { onRefetch } from '@/core/commands/refetch';
import { browserDb } from '@/core/db/client';
import { DbError, unwrap } from '@/core/db/errors';
import type { ApiArgs, ApiFunction } from '@/core/db/rpc';

// The Finance Overview's reads (P4-5; the oversight's defect of 12 Oct). Every figure on the page is a view over every
// unit, so a read costs time in proportion to the data, and six of them at once — times each period tab the person
// flicks through — pile up past the database's 8-second limit and fail ("could not be loaded"). So the page does not
// ask for everything together: at most TWO reads are in flight from this browser at any moment (the rest wait their
// turn, first asked first served), a read the person has moved away from is cancelled before it starts or while it
// runs, a read that fails for the database's timeout or a dropped connection is asked once more after a pause, and
// each block fails and retries on its own — Try again repeats that one read, never the page.

/** How many Finance reads this browser has in flight at once. */
export const LIMIT = 2;
/** The pause before the one automatic second ask of a read that failed for time or transport. */
export const RETRY_AFTER_MS = 1200;
/** A result is kept this long, so flicking back to a period just seen costs nothing; any write clears it. */
const KEEP_MS = 20_000;

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

async function once<T>(fn: ApiFunction, args: unknown, signal: AbortSignal): Promise<T> {
  const done = await acquire(signal);
  try {
    const result = await browserDb()
      .rpc(fn as never, args as never)
      .abortSignal(signal);
    return unwrap(result as never) as T;
  } finally {
    done();
  }
}

/** One read: its turn in the queue, one more ask after a pause when it failed for time or transport. */
export async function readFinance<T>(fn: ApiFunction, args: unknown, signal: AbortSignal): Promise<T> {
  const key = `${fn}|${JSON.stringify(args)}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.data as T;
  let data: T;
  try {
    data = await once<T>(fn, args, signal);
  } catch (e) {
    if (isCancel(e) || signal.aborted) throw e;
    // only a database that could not answer in time (or could not be reached) is worth asking again
    if (!(e instanceof DbError) || e.kind !== 'Unavailable') throw e;
    await pause(RETRY_AFTER_MS, signal);
    data = await once<T>(fn, args, signal);
  }
  kept.set(key, { at: Date.now(), data });
  return data;
}

/** Nothing is kept after a write: the next ask goes to the database (a month closed, an invoice typed). */
export const forgetFinanceReads = () => kept.clear();

export type Block<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed' };

/**
 * One block of the page: loading, then ready or failed, for one read. The state belongs to the read it was asked
 * for (`key`), so a block never shows another period's figures; `retry` repeats this read only.
 */
export function useFinanceRead<T, F extends ApiFunction>(
  fn: F,
  args: ApiArgs<F>,
  key: string,
): { block: Block<T>; retry: () => void } {
  const [state, setState] = useState<{ key: string; block: Block<T> }>({ key, block: { status: 'loading' } });
  const [turn, setTurn] = useState(0);
  const argsKey = JSON.stringify(args);
  useEffect(() => {
    const controller = new AbortController();
    readFinance<T>(fn, JSON.parse(argsKey), controller.signal).then(
      (data) => setState({ key, block: { status: 'ready', data } }),
      (e) => {
        if (!isCancel(e)) setState({ key, block: { status: 'failed' } });
      },
    );
    return () => controller.abort();
  }, [fn, argsKey, key, turn]);
  // a write anywhere clears what was kept and every block asks again
  useEffect(
    () =>
      onRefetch(() => {
        forgetFinanceReads();
        setTurn((n) => n + 1);
      }),
    [],
  );
  const retry = useCallback(() => {
    setState({ key, block: { status: 'loading' } });
    setTurn((n) => n + 1);
  }, [key]);
  // what is on screen is the answer for this read; after a write the old figures stay until the new ones arrive
  return { block: state.key === key ? state.block : { status: 'loading' }, retry };
}
