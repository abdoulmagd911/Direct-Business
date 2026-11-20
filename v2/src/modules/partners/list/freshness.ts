/**
 * Whether the list on screen was read before the last change to an organisation (Landing 34: after Add partner the
 * person lands on the new record, and going back showed the list as it was read before the add — 40, the new one
 * missing — until a reload). Every list render carries the stamp of its read; a change marks the read last seen as
 * stale, and a list that mounts with that same stamp reads again. A list that arrives with a newer read is left alone,
 * so a change never costs a second read where the first is already fresh.
 */
let seen: string | null = null;
let stale: string | null = null;

/** The list drew this read. */
export function sawList(stamp: string) {
  seen = stamp;
}

/** An organisation was added or changed: the read last drawn no longer tells the truth. */
export function markPartnersChanged() {
  stale = seen;
}

/** True when this read is the one a change has made stale. */
export function listIsStale(stamp: string): boolean {
  return stale !== null && stale === stamp;
}

/** The stale read is being replaced. */
export function clearStale() {
  stale = null;
}
