/**
 * The browser's own question "show notifications?", asked once, the first time a person sets a reminder (a tap they
 * just made, so the browser accepts the question) — no setting, no button of ours. A refusal is final and the alert in
 * the page is all they get. Nothing is asked when the browser has no notifications or has already been answered.
 */
export function askToNotify(): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission();
  } catch {
    // an older browser that only takes a callback, or one that refuses outright: nothing to do
  }
}
