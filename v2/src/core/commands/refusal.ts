import type { CommandWords } from './command';

/** The key a database refusal for "your level on this page is too low" arrives under (`access.needs_level`). */
export const NEEDS_LEVEL = 'errors.access.needs_level';

/**
 * A dialog that is not a page says its own sentence for "not enough access" instead of the general one, which talks of a
 * page ("You need more access on this page"). Every other refusal keeps the words it had.
 */
export function withRefusal(words: CommandWords, line: string): CommandWords {
  return { ...words, failed: (key, detail) => (key === NEEDS_LEVEL ? line : words.failed(key, detail)) };
}
