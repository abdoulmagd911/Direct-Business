// The one place that knows a move to another page of the app has begun (Landing 34, items 8 and 10). A click on a
// link is seen by NavProgress; a move made in code (`router.push` from the search, a row, a form) says so itself with
// `navStarted()`, so it shows the same bar at once — before, the search closed and NOTHING showed until the server
// had answered, which on a slow read looked like a result that does not open. The window-focus refetch
// (RefetchBridge) asks `navPending()` first: a page that is on its way is never followed by a second read of the page
// being left.

type Listener = () => void;
const listeners = new Set<Listener>();
/** The address the move left (`/path?query`); null when none is on its way. */
let leftFrom: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** A move can never show as pending longer than this (a lost answer must not leave the bar on for ever). */
export const NAV_PENDING_MAX_MS = 20_000;

/** The address as the store writes it: the path, `?`, and the query without its own `?`. */
export const addressOf = (l: Pick<Location, 'pathname' | 'search'>) => `${l.pathname}?${l.search.replace(/^\?/, '')}`;

const tell = () => {
  for (const l of listeners) l();
};

/** A move to another address has begun, from `from` (the address now, by default). */
export function navStarted(from?: string) {
  if (typeof window === 'undefined' && from === undefined) return;
  leftFrom = from ?? addressOf(window.location);
  clearTimeout(timer);
  timer = setTimeout(navSettled, NAV_PENDING_MAX_MS);
  tell();
}

/**
 * A move made in code is about to be asked of the router (`router.push(href)`): say so, unless `href` is the address
 * we are already on (nothing would arrive to clear the bar). Answers whether the address changes.
 */
export function navStartedTo(href: string): boolean {
  if (typeof window === 'undefined') return false;
  let to: URL;
  try {
    to = new URL(href, window.location.origin);
  } catch {
    return false;
  }
  if (to.origin !== window.location.origin) return false;
  if (to.pathname === window.location.pathname && to.search === window.location.search) return false;
  navStarted();
  return true;
}

/** The next page has arrived (or the move was given up). */
export function navSettled() {
  clearTimeout(timer);
  if (leftFrom === null) return;
  leftFrom = null;
  tell();
}

/** The address a move in flight left, or null. */
export function navLeftFrom(): string | null {
  return leftFrom;
}

/** Whether a move is on its way from the address we are still on. */
export function navPending(here?: string): boolean {
  if (leftFrom === null) return false;
  if (here !== undefined) return leftFrom === here;
  return typeof window === 'undefined' ? false : leftFrom === addressOf(window.location);
}

export function onNav(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
