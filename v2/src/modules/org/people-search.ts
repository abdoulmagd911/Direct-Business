// The People list's own search (Settings → People & access), as one pure rule — the wide table and the phone cards
// both draw the rows this answers (Landing 34b).
//
// What it reads of a person: the English and the Arabic full name, both nicknames, both job titles and every allowed
// e-mail; the screen adds the names of the person's department and team. A field that is empty — a person with only
// an Arabic name, or only a nickname — is simply not read: it never stops the search and never matches by accident.
//
// How it compares: what is typed is cut into words, and a person is kept when EVERY word is somewhere in what is read
// of them, in any order ("alotaibi sara" finds Sara Alotaibi). Both sides are folded the same way first, so the
// comparison is about letters only: capitals, Latin accents, the hyphen or apostrophe inside a name (Al-Otaibi), any
// kind of space (a pasted name can carry a no-break one) and the marks a keyboard or a copied cell can leave that
// cannot be seen (zero-width and direction marks). Arabic is compared as it is written: the Arabic spelling rules
// (hamza forms, ta marbuta, vowels) live in the database alone (norm.*, A10), and this list is filtered in the
// browser, so they are not copied here.

/** The fields of a person the search reads. Every one may be missing. */
export type Searchable = {
  full_name_en?: string | null;
  full_name_ar?: string | null;
  nickname_en?: string | null;
  nickname_ar?: string | null;
  job_title_en?: string | null;
  job_title_ar?: string | null;
  emails?: readonly { email?: string | null }[] | null;
};

// what cannot be seen: zero-width space and joiners, direction marks and isolates, the word joiner, the byte-order
// mark, the soft hyphen
const UNSEEN = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD]/g;
// the combining marks left by the split of an accented Latin letter (é → e + ´)
const ACCENTS = /[\u0300-\u036F]/g;
// the hyphens and apostrophes written inside a name
const JOINS = /[-\u2010-\u2015'\u2018\u2019\u02BC`]/g;

/** Text as the search compares it: letters only, lower case, one plain space between words. */
export function foldForSearch(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFKD')
    .replace(UNSEEN, '')
    .replace(ACCENTS, '')
    .replace(JOINS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words typed, folded; none for an empty or blank box. */
export function searchWords(typed: string | null | undefined): string[] {
  const folded = foldForSearch(typed);
  return folded ? folded.split(' ') : [];
}

/** Everything the search reads of one person, folded, as one line. `more` is what the screen adds (department, team). */
export function personHaystack(person: Searchable, more: readonly (string | null | undefined)[] = []): string {
  return [
    person.full_name_en,
    person.full_name_ar,
    person.nickname_en,
    person.nickname_ar,
    person.job_title_en,
    person.job_title_ar,
    ...(person.emails ?? []).map((e) => e?.email),
    ...more,
  ]
    .map(foldForSearch)
    .filter(Boolean)
    .join(' ');
}

/** Every word is somewhere in the line, in any order. */
const hasEvery = (hay: string, words: readonly string[]) => words.every((w) => hay.includes(w));

/** Whether a person is kept for what was typed: an empty box keeps everyone; otherwise every word must be found. */
export function matchesPerson(
  person: Searchable,
  typed: string | null | undefined,
  more: readonly (string | null | undefined)[] = [],
): boolean {
  const words = searchWords(typed);
  return words.length === 0 || hasEvery(personHaystack(person, more), words);
}

/** The people kept for what was typed, in the order given. `more` names what the screen adds for each person. */
export function searchPeople<P extends Searchable>(
  people: readonly P[],
  typed: string | null | undefined,
  more: (person: P) => readonly (string | null | undefined)[] = () => [],
): P[] {
  const words = searchWords(typed);
  if (words.length === 0) return [...people];
  return people.filter((p) => hasEvery(personHaystack(p, more(p)), words));
}
