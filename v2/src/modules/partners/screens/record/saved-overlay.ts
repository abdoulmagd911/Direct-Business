/**
 * What the record shows between a saved change and the re-read that confirms it (Landing 34). The record page is
 * server-rendered: after Save it kept showing the card it was read with until the re-read landed — seconds on a slow
 * day — so "Unarchived" was toasted over a record still marked Archived, and a saved note stayed "+ Add". The save's
 * own answer is now laid over the card at once; the re-read replaces it. Nothing here is guessed: the overlay holds
 * exactly the values the database accepted.
 */
export type SavedEdit = { version: number; changes: Record<string, unknown> } | null;

/** The card with a saved edit laid over it — until the card read is that version or newer. */
export function withSavedEdit<C extends { version: number }>(card: C, saved: SavedEdit): C {
  if (!saved || card.version >= saved.version) return card;
  return { ...card, ...saved.changes, version: saved.version };
}

/** True once the re-read has caught up with the saved edit, so the overlay can go. */
export function savedEditLanded(card: { version: number }, saved: SavedEdit): boolean {
  return !!saved && card.version >= saved.version;
}

/** Archived as the record shows it: what Archive / Unarchive just said, else what the card read says. */
export function archivedShown(archivedAt: string | null | undefined, said: boolean | null): boolean {
  return said ?? !!archivedAt;
}

/** True once the card read agrees with what Archive / Unarchive said, so the saying can go. */
export function archiveLanded(archivedAt: string | null | undefined, said: boolean | null): boolean {
  return said !== null && !!archivedAt === said;
}
