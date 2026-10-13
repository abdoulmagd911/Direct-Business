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
