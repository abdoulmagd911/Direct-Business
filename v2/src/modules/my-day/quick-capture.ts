/** Quick capture from anywhere (productivity stage 1): the Create menu, the phone + and Ctrl K ask the one sheet in the shell to open. */
export const QUICK_CAPTURE_EVENT = 'quick-capture:open';

/** The record a Follow up is about: its entity (a client, a task or an invoice), id and the name to show. */
export type CaptureAbout = { entity: 'partner' | 'task' | 'invoice'; id: string; label: string };

/**
 * What a door can ask of the sheet. `about` opens it as a Follow up on that record (a Reminder in the record's name);
 * `kind` opens it on a kind; `text` carries words already typed.
 */
export type OpenOptions = { kind?: CaptureKind; about?: CaptureAbout; text?: string };

export const openQuickCapture = (opts?: OpenOptions) => {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT, { detail: opts ?? null }));
};

export type CaptureKind = 'note' | 'idea' | 'checklist' | 'reminder' | 'meeting';
export const CAPTURE_KINDS: CaptureKind[] = ['note', 'idea', 'checklist', 'reminder', 'meeting'];

export type QuickValues = {
  kind: 'sticky' | 'idea' | 'checklist' | 'reminder' | 'meeting';
  values: Record<string, unknown>;
};

/**
 * What the sheet sends to `api.note_capture`: the first line is the title; Note, Idea and Reminder keep the rest as
 * the body; a Checklist makes every further line an item (a single line is its own item). Private unless chosen
 * otherwise (V454). A Reminder needs its time — the sheet refuses to save without one.
 */
export function quickCaptureArgs(
  kind: CaptureKind,
  text: string,
  opts: { visibility: string; day: string; remindAt?: string; about?: { entity: string; id: string } },
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
    return {
      kind: 'reminder',
      values: { ...values, remind_at: opts.remindAt, ...(opts.about ? { about: opts.about } : {}) },
    };
  }
  return { kind: kind === 'idea' ? 'idea' : kind === 'meeting' ? 'meeting' : 'sticky', values };
}
