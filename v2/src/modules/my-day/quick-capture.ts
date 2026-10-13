/** Quick capture from anywhere (productivity stage 1): the Create menu, the phone + and Ctrl K ask the one sheet in the shell to open. */
export const QUICK_CAPTURE_EVENT = 'quick-capture:open';

export const openQuickCapture = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUICK_CAPTURE_EVENT));
};

export type CaptureKind = 'note' | 'idea' | 'checklist' | 'reminder';
export const CAPTURE_KINDS: CaptureKind[] = ['note', 'idea', 'checklist', 'reminder'];

export type QuickValues = { kind: 'sticky' | 'idea' | 'checklist' | 'reminder'; values: Record<string, unknown> };

/**
 * What the sheet sends to `api.note_capture`: the first line is the title; Note, Idea and Reminder keep the rest as
 * the body; a Checklist makes every further line an item (a single line is its own item). Private unless chosen
 * otherwise (V454). A Reminder needs its time — the sheet refuses to save without one.
 */
export function quickCaptureArgs(
  kind: CaptureKind,
  text: string,
  opts: { visibility: string; day: string; remindAt?: string },
): QuickValues | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines[0];
  if (!title) return null;
  const rest = lines.slice(1);
  const base = { visibility: opts.visibility, happened_on: opts.day };
  if (kind === 'checklist') {
    const items = (rest.length ? rest : [title]).map((t) => ({ text: t, done: false }));
    return { kind: 'checklist', values: { ...base, title, items } };
  }
  const values: Record<string, unknown> = {
    ...base,
    title: title.slice(0, 200),
    ...(rest.length ? { body: rest.join('\n') } : {}),
  };
  if (kind === 'reminder') {
    if (!opts.remindAt) return null;
    return { kind: 'reminder', values: { ...values, remind_at: opts.remindAt } };
  }
  return { kind: kind === 'idea' ? 'idea' : 'sticky', values };
}

/** `datetime-local`'s value ("2026-10-14T09:00") read as Riyadh time (UTC+3, no daylight saving). */
export const riyadhInstant = (local: string): string | undefined => (local ? `${local}:00+03:00` : undefined);

/** The next morning at 9:00 in Riyadh, as `datetime-local` writes it, from today's Riyadh date. */
export function tomorrowMorning(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T09:00`;
}
