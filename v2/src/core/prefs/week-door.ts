/**
 * Lives in core/prefs because this is the one place that may touch browser storage (A13). The weekly-review door
 * the person put away from My day, kept in this browser only — no database change. Each is remembered by the Sunday
 * its week starts on, so the door comes back with the next week (FIX-29, D23).
 */
export const weekDoorKey = (weekStart: string) => `week-door-dismissed:${weekStart}`;

export function readWeekDoorDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeWeekDoorDismissed(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // storage refused (private window): the door stays hidden for this page load only
  }
}
