/**
 * Lives in core/prefs because this is the one place that may touch browser storage (A13). Log activity opens with the
 * type this person used last (ruling of 22 Oct), kept in this browser only — a missing or refused store just means the
 * first-time default, Call.
 */
export const lastActivityTypeKey = (personId: string) => `activity-last-type:${personId}`;

export function readLastActivityType(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLastActivityType(key: string, type: string): void {
  try {
    window.localStorage.setItem(key, type);
  } catch {
    // storage refused (private window): the next form opens on Call
  }
}
