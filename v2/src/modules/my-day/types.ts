/**
 * My day's notes (V433, spec §3.3a) as builder A's P3-13 serves them (V183–V188; migration 20260930172400_my_day_notes):
 *
 * - `api.my_day(p_scope, p_limit, p_offset)` → `{ scope, day, notes, more, reminders }` — Me: my open notes; My team: what
 *   my team shares with the team; Workspace: what everyone shares. "Open" is not done and due on or before today.
 * - `api.note(p_id)` — one note, when the reader may see it (a private one: its author alone, admins included — V454).
 * - `api.note_capture(p_kind, p_values, p_mentions)` · `api.note_update(p_id, p_values, p_version, p_mentions)` ·
 *   `api.note_remove(p_ids, p_reason)`; `p_values` takes title, body, items, visibility, happened_on, meeting_partner_id,
 *   meeting_on.
 * - `api.note_turn_into(p_id, p_into, p_values)` — `call` or `meeting` ({ partner_id, outcome, happened_on, body }) and
 *   `reminder` ({ remind_at, text }); a task, an action item and an achievement answer `note.turn_into_not_yet`.
 * - `api.note_finish_meeting(p_id, p_values)` · `api.note_wrap_up(p_day, p_steps)` — steps `[{ id, action }]`, the action
 *   `carry`, `done` or `turn_into`.
 * - `api.reminder_remove(p_ids, p_reason)`.
 * - `api.notes` rows (an organisation's timeline) carry `from_notes` — the notes the reader may see it came from.
 */

export type NoteKind = 'sticky' | 'meeting' | 'checklist';
export type Visibility = 'private' | 'team' | 'workspace';
export type Scope = 'me' | 'team' | 'workspace';

export const NOTE_KINDS: NoteKind[] = ['sticky', 'meeting', 'checklist'];
export const VISIBILITIES: Visibility[] = ['private', 'team', 'workspace'];
export const SCOPES: Scope[] = ['me', 'team', 'workspace'];

export type NoteItem = { text: string; done: boolean; owner_id?: string | null; due_on?: string | null };

/** What a note was turned into (my.note_link), live and visible to the reader: a logged call or meeting, or a reminder. */
export type TurnedInto = {
  /** `note` — an activity on an organisation (type call or meeting) — or `reminder`. */
  entity: 'note' | 'reminder';
  id: string;
  made_at: string;
  made_by: string;
  partner_id: string | null;
  /** The activity's type key (call, meeting …). */
  type: string | null;
  happened_on: string | null;
  remind_at: string | null;
  sent_at: string | null;
};

export type PartnerRef = { id: string; number: string; trade_name_en: string; trade_name_ar: string | null };

export type MyNote = {
  id: string;
  version: number;
  kind: NoteKind;
  title: string | null;
  body: string | null;
  items: NoteItem[];
  visibility: Visibility;
  happened_on: string;
  logged_at: string;
  author_id: string;
  mine: boolean;
  meeting_partner_id: string | null;
  meeting_on: string | null;
  finished_at: string | null;
  carried_to: string | null;
  done_at: string | null;
  mentions: string[];
  turned_into: TurnedInto[];
};

export type PendingReminder = { id: string; note_id: string | null; remind_at: string; text: string | null };

export type MyDayAnswer = {
  scope: Scope;
  day: string;
  notes: MyNote[];
  /** More notes than this answer holds. */
  more: boolean;
  reminders: PendingReminder[];
};

/** A note a record came from (api.notes `from_notes`), for a reader who may see that note. */
export type FromNote = { note_id: string; kind: NoteKind; title: string | null; author_id: string; made_at: string };

/** Turn into (V433): each kind arrives with its own door. `activity` is a logged call or meeting. */
export type TurnKind = 'activity' | 'reminder' | 'task' | 'action_item' | 'achievement';
export const TURN_KINDS: TurnKind[] = ['activity', 'reminder', 'task', 'action_item', 'achievement'];

export type WrapChoice = 'carry' | 'done';
