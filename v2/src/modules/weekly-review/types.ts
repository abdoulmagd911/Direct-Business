/**
 * The Thursday weekly review (V632 Stage 3) as `api.weekly_review(p_day)` serves it (migration
 * 20261014090000_weekly_review_reads): the reader's own week — never anyone else's, admins included (V454).
 *
 * - `week` / `next_week`: the Riyadh days the week runs over, from the setting work.week_starts_on (D20).
 * - `done`: my tasks completed (Done, never Cancelled) and my notes marked done this week.
 * - `slipped`: still open, and carried over this week or overdue; `times` is how often I carried it.
 * - `next`: my open tasks due next week and my notes carried to it.
 * - `notes`: a short list (7) of my notes written this week, newest first; `total` counts them all.
 * Each list holds at most 50 rows; `total` says how many there are.
 */

export type ReviewItem = {
  kind: 'task' | 'note';
  id: string;
  /** A task's number; null for a note. */
  number: string | null;
  title: string;
  /** Done: the day it was done. Slipped: the day it stands on now. Next: the day it is due. */
  day: string;
  partner_name_en: string | null;
  partner_name_ar: string | null;
  /** How often I carried it over (tomorrow or next week). */
  times: number;
};

export type ReviewNote = {
  id: string;
  kind: 'sticky' | 'meeting' | 'checklist';
  idea: boolean;
  title: string;
  visibility: 'private' | 'team' | 'workspace';
  day: string;
  done: boolean;
};

export type ReviewList<T> = { total: number; rows: T[] };

export type WeeklyReviewAnswer = {
  today: string;
  week: { from: string; to: string };
  next_week: { from: string; to: string };
  done: ReviewList<ReviewItem>;
  slipped: ReviewList<ReviewItem>;
  next: ReviewList<ReviewItem>;
  notes: ReviewList<ReviewNote>;
};

export const SECTIONS = ['done', 'slipped', 'next'] as const;
export type Section = (typeof SECTIONS)[number];
