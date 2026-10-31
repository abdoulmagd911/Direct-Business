// The rules that suggest a file's name from what it says (V655 B, V648). Plain rules, run in the person's own browser
// after the upload has finished; the text is read here and never kept. The pattern of V534 still leads: this only
// proposes the kind, the date and a short title, and the person accepts or edits.

export type NameKind = { key: string; keywordsEn: string[]; keywordsAr: string[]; neverRead: boolean };

export type NameSuggestion =
  | { skipped: 'never_read' | 'image' | 'sensitive' }
  | { skipped: null; kind: string | null; date: string | null; title: string | null };

/** Letters that look alike are one letter, marks and the stretching line are dropped, case does not count. */
export function plain(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '') // check-allow: one-copy — the text is read in the browser and must never leave it (V655 B)
    .replace(/[أإآ]/g, 'ا') // check-allow: one-copy — the text is read in the browser and must never leave it (V655 B)
    .replace(/ى/g, 'ي') // check-allow: one-copy — the text is read in the browser and must never leave it (V655 B)
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

// an identity or payment number found in the text: nothing at all is suggested from such a file
const SENSITIVE = [
  /\b[a-z]{2}\d{2}(?:\s?[a-z0-9]{4}){3,7}(?:\s?[a-z0-9]{1,4})?\b/i, // an IBAN
  /\b(?:\d[ -]?){15}\d\b/, // a card number
  /(?<![\d])[12]\d{9}(?![\d])/, // a Saudi national or residence ID
  /\bpassport\s*(?:no|number|#)?[\s.:]*[a-z]\d{7,8}\b/i,
  /جواز\s*السفر\s*(?:رقم)?[\s.:]*[a-z]?\d{7,9}/i,
];

const asciiDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

function validDay(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The first valid day in the text: 2026-09-28, 28/09/2026 or 28-09-2026. */
export function firstDate(text: string): string | null {
  const t = asciiDigits(text);
  for (const m of t.matchAll(
    /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?!\d)/g,
  )) {
    const day = m[1] ? validDay(+m[1], +m[2]!, +m[3]!) : validDay(+m[6]!, +m[5]!, +m[4]!);
    if (day) return day;
  }
  return null;
}

/** The kind whose keywords the text names most; a tie names none. */
export function kindOf(text: string, kinds: NameKind[]): string | null {
  const t = plain(text);
  let best: string | null = null;
  let top = 0;
  let tied = false;
  for (const k of kinds) {
    let n = 0;
    for (const w of [...k.keywordsEn, ...k.keywordsAr]) {
      const p = plain(w).trim();
      if (p) n += t.split(p).length - 1;
    }
    if (n > top) {
      top = n;
      best = k.key;
      tied = false;
    } else if (n === top && n > 0) tied = true;
  }
  return tied ? null : best;
}

/** The first heading-like line: short, not a sentence, not just numbers. */
export function titleOf(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 3 || line.length > 80) continue;
    if (/[.:;,،؛]$/.test(line) || !/\p{L}/u.test(line)) continue;
    if (line.split(' ').length > 10) continue;
    return line;
  }
  return null;
}

export function suggestName(input: {
  text: string;
  mime: string;
  kinds: NameKind[];
  /** the kind the person already chose, if any: a kind marked never-read is not read at all */
  chosenKind?: string | null;
  recordDate?: string | null;
}): NameSuggestion {
  if (input.chosenKind && input.kinds.some((k) => k.key === input.chosenKind && k.neverRead))
    return { skipped: 'never_read' };
  // an image, or a scan with no text layer, waits for a text reader that is free: the pattern name only
  if (input.mime.startsWith('image/') || input.text.trim() === '') return { skipped: 'image' };
  if (SENSITIVE.some((r) => r.test(asciiDigits(input.text)))) return { skipped: 'sensitive' };
  const kind = kindOf(
    input.text,
    input.kinds.filter((k) => !k.neverRead),
  );
  return { skipped: null, kind, date: firstDate(input.text) ?? input.recordDate ?? null, title: titleOf(input.text) };
}
