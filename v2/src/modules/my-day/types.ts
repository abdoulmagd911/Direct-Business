/**
 * My day's notes (V433, spec §3.3a) as builder A's P3-13 serves them (V183–V188; migration 20260930172400_my_day_notes):
 *
 * - `api.my_day(p_scope, p_limit, p_offset, p_since)` → `{ scope, day, notes, notes_total, more, since, reminders }` — Me: my
 *   open notes; My team: what my team shares with the team; Workspace: what everyone shares. "Open" is not done and due on
 *   or before today. `since` counts the team's and everyone's notes made after `p_since`, never a private one.
 * - `api.my_note(p_id)` — one note, when the reader may see it (a private one: its author alone, admins included — V454).
 * - `api.note_capture(p_kind, p_values, p_mentions)` · `api.note_update(p_id, p_values, p_version, p_mentions)` ·
 *   `api.my_notes_remove(p_ids, p_reason)`; `p_values` takes title, body, items, visibility, happened_on,
 *   meeting_partner_id, meeting_on.
 * - `api.note_turn_into(p_note, p_kind, p_values)` — `activity` ({ partner_id, type call|meeting, outcome, happened_on,
 *   body }) and `reminder` ({ remind_at, text }); an action item answers `note.turn_into_not_yet` until its dialog lands.
 *   A `task` takes the task door's values (title, owner_id, due_on, partner_id, project_id) and
 *   `action_items: true` to bring the checklist (V605 (3)); it answers `{ id, number, entity: 'task', action_item_ids }`.
 * - `api.note_finish_meeting(p_note, p_values)` · `api.note_wrap_up(p_day, p_choices)` — choices `[{ note, choice }]`, the
 *   choice `carry` or `done`.
 * - `api.reminders_remove(p_ids, p_reason)`; `api.page_seen('my_day')` answers the previous visit and records this one.
 * - `api.notes` rows (an organisation's timeline) carry `from_note` — the note it came from, or null for a reader who may
 *   not see it.
 */

export type NoteKind = 'sticky' | 'meeting' | 'checklist';
export type Visibility = 'private' | 'team' | 'workspace';
export type Scope = 'me' | 'team' | 'workspace';

export const NOTE_KINDS: NoteKind[] = ['sticky', 'meeting', 'checklist'];
export const VISIBILITIES: Visibility[] = ['private', 'team', 'workspace'];
export const SCOPES: Scope[] = ['me', 'team', 'workspace'];

export type NoteItem = { text: string; done: boolean; owner_id?: string | null; due_on?: string | null };

/** What a note was turned into (my.note_link), live and visible to the reader: a logged call or meeting, or a reminder. */
export type NoteLink = {
  entity: 'activity' | 'reminder' | 'achievement' | 'task';
  id: string;
  made_at: string;
  made_by: string;
  /** An activity's organisation, named in both languages. */
  partner_id: string | null;
  partner_name_en: string | null;
  partner_name_ar: string | null;
  /** The activity's type (call, meeting …) and its words. */
  type: string | null;
  type_en: string | null;
  type_ar: string | null;
  happened_on: string | null;
  remind_at: string | null;
  sent_at: string | null;
  /** A task's number and title (the chip of a note turned into a task). */
  number?: string | null;
  title?: string | null;
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
  meeting_partner: PartnerRef | null;
  meeting_on: string | null;
  finished_at: string | null;
  carried_to: string | null;
  done_at: string | null;
  mentions: string[];
  links: NoteLink[];
};

export type SinceCount = { kind: 'team_notes' | 'workspace_notes'; count: number };

export type PendingReminder = { id: string; note_id: string | null; remind_at: string; text: string | null };

export type MyDayAnswer = {
  scope: Scope;
  day: string;
  notes: MyNote[];
  notes_total: number;
  /** More notes than this answer holds. */
  more: boolean;
  /** Notes shared with the team or everyone since `p_since`. */
  since: SinceCount[];
  reminders: PendingReminder[];
};

/** The note a record came from (api.notes `from_note`), for a reader who may see that note. */
export type FromNote = { id: string; kind: NoteKind; title: string | null; author_id: string; made_at: string };

/** Turn into (V433): each kind arrives with its own door. `activity` is a logged call or meeting. */
export type TurnKind = 'activity' | 'reminder' | 'task' | 'action_item' | 'achievement';
export const TURN_KINDS: TurnKind[] = ['activity', 'reminder', 'task', 'action_item', 'achievement'];

export type WrapChoice = 'carry' | 'done';
