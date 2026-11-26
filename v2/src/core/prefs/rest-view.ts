/**
 * Lives in core/prefs because this is the one place that may touch browser storage (A13). How a person likes "The rest
 * of today" grouped on My day — by kind or by priority (the four boxes) — kept in this browser only; no database change.
 */
const KEY = 'my-day-rest-view';

export function readRestView<T extends string>(allowed: readonly T[]): T | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return allowed.find((a) => a === v) ?? null;
  } catch {
    return null;
  }
}

export function writeRestView(view: string): void {
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    // storage refused (private window): the choice holds for this page load only
  }
}
