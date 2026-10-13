import type { Note } from './types';

/**
 * The words for a line the system wrote on a record's timeline (D5): the database sends a type and values, never a
 * sentence, so the line follows the reader's language. Null for a person's own note, or an event this screen has no
 * words for yet (the caller falls back to the note's kind).
 */
export function eventWords(
  event: Note['event'],
  t: { has: (key: string) => boolean; (key: string, values: { title: string }): string },
): string | null {
  if (!event) return null;
  const key = `partners.activity.event.${event.type}`;
  if (!t.has(key)) return null;
  return t(key, { title: event.values?.title ?? event.values?.number ?? '' });
}
