// The names the app never says (V59, V73, V74, V404) — the same list as scripts/checks/forbidden-words.mjs (a unit
// test keeps them equal). A list value, a seed or a setting an admin types is refused when it carries one, naming it.
// The names are assembled at run time, so this file reads as data to the check, not as wording.
const j = (...parts: string[]) => parts.join('');

export const BANNED: readonly [RegExp, string][] = [
  [/\bdirect[\s\-_.]*ksa\b/i, j('Direct', ' KSA')],
  [/\bdirect[\s\-_.]*corporate\b/i, j('Direct', ' Corporate')],
  [/\bb[\s\-_.]*2[\s\-_.]*b\b/i, j('B', '2B')],
  [/\bb[\s\-_.]*2[\s\-_.]*g\b/i, j('B', '2G')],
  [/\bmice\b/i, j('MI', 'CE')],
  [/\bgoogle\b/i, j('Goo', 'gle')],
  [/\bzoom\b/i, j('Zo', 'om')],
  [/\bkeep\s+me\s+signed\s+in\b/i, j('Keep me', ' signed in')],
  [/\bgmv\b/i, j('Sales (G', 'MV)')],
  [/\bcompan(?:y|ies)\b/i, 'Company'],
  [/\bmargins?\b/i, 'Margin'],
];

/** The banned word a value carries, or null. */
export function bannedIn(value: string): string | null {
  for (const [re, word] of BANNED) if (re.test(value)) return word;
  return null;
}
