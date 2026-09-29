// The global refetch (TECH-SPEC §2.4 point 3): after any successful command every open screen refetches, so "one
// screen forgot to refresh" cannot exist as a class of bug. Screens are server-rendered, so the one listener that
// matters is the shell's RefetchBridge (router.refresh()); the bell and any live hook may listen too.

type Listener = () => void;
const listeners = new Set<Listener>();
let last = 0;

/** Called by `command()` after every successful write and its Undo; the shell refreshes on it. */
export function refetchAll() {
  last = Date.now();
  for (const l of listeners) l();
}

/** When the last refetch ran (ms since epoch; 0 before any). */
export function lastRefetchAt() {
  return last;
}

export function onRefetch(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
