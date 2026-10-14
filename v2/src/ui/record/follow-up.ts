import { QUICK_CAPTURE_EVENT } from '@/modules/my-day/quick-capture';

/** The record a follow-up is about: what `api.note_capture` takes as `about`, plus the words the sheet shows for it. */
export type FollowUpAbout = { entity: 'partner' | 'task' | 'invoice'; id: string; label: string };

/** What the one Capture sheet receives with its open event when a record page asks for a follow-up. */
export type FollowUpDetail = { kind: 'reminder'; about: FollowUpAbout };

/**
 * Follow up on a record (V632 Stage 2, the Architect's ruling of 14 Oct): the record page's ⋯ entry opens the one
 * Capture sheet — no second sheet — on Reminder, Only me, about this record. The sheet names the record from `label`
 * and sends `about: { entity, id }`; the note's own title stays the person's to write and never carries the record's
 * name (QA 2), since the record shows only through `about`, to readers who may see it (work.about_of, V454).
 */
export function openFollowUp(about: FollowUpAbout) {
  if (typeof window === 'undefined') return;
  const detail: FollowUpDetail = { kind: 'reminder', about };
  window.dispatchEvent(new CustomEvent(QUICK_CAPTURE_EVENT, { detail }));
}
