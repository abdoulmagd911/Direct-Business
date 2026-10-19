/**
 * Lives in core/prefs because this is the one place that may touch browser storage (A13). Hide for now (ruling of 18
 * Oct): the reminders the person put away from the alert bar, kept in this browser only — no database change. Each is
 * remembered with the time it was due, so a reminder that is snoozed and comes due again at a new time is NEW (QA-579,
 * ruling of 19 Oct) and brings the bar back.
 */
export const hiddenKey = (personId: string) => `reminder-alert-hidden:${personId}`;

/** reminder id -> the remind_at it was hidden at */
export type Hidden = Record<string, string>;

export function readHidden(key: string): Hidden {
  try {
    const raw = window.localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch {
    return {};
  }
}

export function writeHidden(key: string, hidden: Hidden): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(hidden));
  } catch {
    // storage refused (private window): the bar stays hidden for this page load only
  }
}

/** Hidden only while the reminder is still due at the time it was hidden at. */
export const isHidden = (hidden: Hidden, id: string, remindAt: string) => hidden[id] === remindAt;
