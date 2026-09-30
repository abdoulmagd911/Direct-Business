/**
 * My day's notes (V433, spec §3.3a) as the screens read them. Builder A's P3-13 serves them; until it lands these are
 * the plan's interface, the one place the screens name it, so a change to a door's shape is a change here:
 *
 * - `api.my_day(p_scope, p_limit)` — the page: the scope's notes (Me: my open ones; My team: what my team shares with
 *   the team; Workspace: what everyone shares), their total, and the counters since my last visit.
 * - `api.my_note(p_id)` — one note, when the reader may see it (a private one: its author alone, admins included — V454).
 * - `api.note_capture(p_kind, p_title, p_body, p_items, p_visibility, p_happened_on, p_meeting_partner)` → `{ id }`.
 * - `api.note_update(p_id, p_values, p_version)`; `api.my_notes_remove(p_ids, p_reason)`.
 * - `api.note_turn_into(p_note, p_kind, p_values)` — `activity` ({ partner, type, outcome, happened_on, body }) and
 *   `reminder` ({ remind_at, text }) now; `task` and `action_item` with P5-1, `achievement` with P5-4.
 * - `api.note_finish_meeting(p_note, p_values)` — logs the meeting ({ partner, outcome, happened_on }) with the points.
 * - `api.note_wrap_up(p_day, p_choices)` — `[{ note, choice: 'carry' | 'done' }]`; nothing is deleted.
 * - `api.my_day_seen()` — Mark all seen.
 * - `api.notes` rows (an organisation's timeline) carry `from_note` — `{ id, title }`, or null for a reader who may not
 *   see the note (spec §3.3a: the chip hides).
 */

export type NoteKind = 'sticky' | 'meeting' | 'checklist';
export type Visibility = 'private' | 'team' | 'workspace';
export type Scope = 'me' | 'team' | 'workspace';

export const NOTE_KINDS: NoteKind[] = ['sticky', 'meeting', 'checklist'];
export const VISIBILITIES: Visibility[] = ['private', 'team', 'workspace'];
export const SCOPES: Scope[] = ['me', 'team', 'workspace'];

export type NoteItem = { text: string; done: boolean; owner_id?: string | null; due_on?: string | null };

/** What a note was turned into (my.note_link), with what its chip says and where it leads. */
export type NoteLink = {
  entity: TurnKind;
  id: string;
  /** An activity's organisation; the chip opens its record. */
  partner_id?: string | null;
  partner_name_en?: string | null;
  partner_name_ar?: string | null;
  /** An activity's type in both languages ("Call" · "مكالمة"). */
  type_en?: string | null;
  type_ar?: string | null;
  /** A reminder's time. */
  remind_at?: string | null;
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
  links: NoteLink[];
};

export type SinceCount = { kind: string; count: number };

export type MyDayAnswer = {
  scope: Scope;
  day: string;
  last_visit_at: string | null;
  since: SinceCount[];
  notes: MyNote[];
  notes_total: number;
};

/** Turn into (V433): each kind arrives with its own door. */
export type TurnKind = 'activity' | 'reminder' | 'task' | 'action_item' | 'achievement';
export const TURN_KINDS: TurnKind[] = ['activity', 'reminder', 'task', 'action_item', 'achievement'];

export type WrapChoice = 'carry' | 'done';
