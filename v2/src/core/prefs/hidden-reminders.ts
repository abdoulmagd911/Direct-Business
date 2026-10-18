/**
 * Lives in core/prefs because this is the one place that may touch browser storage (A13). Hide for now (ruling of 18 Oct): the reminders the person put away from the alert bar, kept in this browser only —
 * no database change. A reminder that is not in the set shows; a new one that comes due is never in it.
 */
export const hiddenKey = (personId: string) => `reminder-alert-hidden:${personId}`;

export function readHidden(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeHidden(key: string, ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // storage refused (private window): the bar stays hidden for this page load only
  }
}
