// The global refetch (TECH-SPEC §2.4 point 3): after any successful command every open screen refetches, so "one
// screen forgot to refresh" cannot exist as a class of bug. Screens are server-rendered, so the one listener that
// matters is the shell's RefetchBridge (router.refresh()); the bell and any live hook may listen too.

type Listener = () => void;
const listeners = new Set<Listener>();
let last = 0;
// How many command() writes are in flight: a focus refetch must not fire while a write is pending (F131) — the
// refresh would re-read the record the write is still changing, and a slow read during it threw the whole page.
let busy = 0;

/** Called by `command()` after every successful write and its Undo; the shell refreshes on it. */
export function refetchAll() {
  last = Date.now();
  for (const l of listeners) l();
}

/** When the last refetch ran (ms since epoch; 0 before any). */
export function lastRefetchAt() {
  return last;
}

/** True while any command() write is in flight. */
export function commandBusy() {
  return busy > 0;
}

/** Called by `command()` around the write; always paired (finally), so a failed write releases it too. */
export function commandStarted() {
  busy += 1;
}
export function commandFinished() {
  busy = Math.max(0, busy - 1);
}

export function onRefetch(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
