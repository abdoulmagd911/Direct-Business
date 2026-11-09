import type { ReviewItem, WeeklyReviewAnswer } from './types';

/** Where a row leads: a task to its page, a note to its own page under My day. */
export const itemRoute = (i: Pick<ReviewItem, 'kind' | 'id' | 'number'>): string =>
  i.kind === 'task' && i.number ? `/tasks/${i.number}` : `/my-day/notes/${i.id}`;

/** A row's client, in the reader's language (the English name when there is no Arabic one). */
export const partnerName = (i: Pick<ReviewItem, 'partner_name_en' | 'partner_name_ar'>, locale: 'en' | 'ar') =>
  (locale === 'ar' ? i.partner_name_ar || i.partner_name_en : i.partner_name_en) ?? null;

/** Nothing at all this week: one empty state instead of four empty sections. */
export const weekIsEmpty = (a: WeeklyReviewAnswer): boolean =>
  a.done.total + a.slipped.total + a.next.total + a.notes.total === 0;

/** How many rows a list holds beyond those drawn (the read caps each list). */
export const moreThanShown = (list: { total: number; rows: unknown[] }): number =>
  Math.max(0, list.total - list.rows.length);

/** Thursday is review day (V632 Stage 3): `day` is Riyadh's date from the database (D20), never the browser's. */
export const isReviewDay = (day: string): boolean => new Date(`${day}T12:00:00Z`).getUTCDay() === 4;

/**
 * FIX-29: the Sunday the week of `day` starts on — the WeekDoor's dismiss key. It follows the default
 * work.week_starts_on (Sunday, D20); if an admin moves the week start, the dismissal lifts up to a day early or
 * late — the review page itself always reads the server's week.
 */
export const weekStartOf = (day: string): string => {
  const d = new Date(`${day}T12:00:00Z`);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return start.toISOString().slice(0, 10);
};
