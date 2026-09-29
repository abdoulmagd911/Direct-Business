import fs from 'node:fs';
import path from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

/**
 * The Arabic catalog (P3-11, builder C's lane — V410, V305). `messages/en.json` is the source; every key
 * `messages/ar.json` holds must:
 * - format in Arabic — a count takes Arabic's plural forms, and the message never falls back to its key;
 * - carry exactly the English message's placeholders (a lost `{name}` drops a name from the screen);
 * - read in Arabic, with Latin digits (V40), except the few values that are names in another script;
 * - never say the words the app never says (V59: "Direct KSA", "B2B", "MICE" …, and "B2G"), nor «شركة» (in any form) for a partner
 *   or «هامش» for profit (V52, V73);
 * - keep «المسؤول» for the KPI lead alone (V405) — an admin is «مسؤول النظام», never «مدير النظام» («مدير» is the
 *   Manager role; the oversight's Arabic check, 29 Sep 23:40);
 * - put the tanween fatha on the letter before the alif («متأخرًا»), never after it («متأخراً»).
 * A key still missing from ar.json is builder C's queue (the catalog check says so), not a failure here.
 * Sabotages: `ar-drops-a-placeholder`, `ar-breaks-a-plural`, `ar-prints-arabic-digits`, `ar-says-a-banned-word`,
 * `ar-calls-an-admin-al-masool`, `ar-says-company`, `ar-leaves-english` (tests/sabotage/arabic.mjs).
 */
const V2 = path.resolve(import.meta.dirname, '../../..');
const read = (lang: string) => JSON.parse(fs.readFileSync(path.join(V2, `messages/${lang}.json`), 'utf8'));

function flat(o: Record<string, unknown>, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else flat(v as Record<string, unknown>, `${prefix}${k}.`, out);
  }
  return out;
}

const arTree = read('ar');
const en = flat(read('en'));
const ar = flat(arTree);

/** The arguments a message takes (`{name}`, `{count, plural, …}`); plural branches' words are not arguments. */
const argsOf = (message: string) =>
  [...new Set([...message.matchAll(/\{([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1]!))].sort();

/** Values that are names in another script by design: the other language's name, file formats. */
const NOT_ARABIC = new Set([
  'app.name_other',
  'app.brand_line_other',
  'locale.en',
  'sign_in.switch_to_en',
  'settings.values.app.export_formats.csv',
  'settings.values.app.export_formats.xlsx',
]);
const ARABIC_LETTER = /[\u{0621}-\u{064A}]/u;
/** A message with words of its own — not one made only of its arguments, like "{name}: {state}". */
const hasOwnWords = (message: string) => /\p{L}/u.test(message.replace(/\{[A-Za-z_]\w*\}/g, ''));
const ARABIC_DIGIT = /[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/u;
const BANNED = /direct\s*ksa|direct\s*corporate|\bb2b\b|\bb2g\b|\bmice\b/i;
const KPI_LEAD_KEY = /(^|\.)kpi\.lead$|kpi_lead/;

const t = createTranslator({
  locale: 'ar',
  messages: arTree,
  onError: (e) => {
    throw e;
  },
});
const sample = (arg: string, count: number): string | number =>
  arg === 'count' ? count : arg === 'date' ? '2026-09-29' : arg === 'email' ? 'test.am1@example.com' : 'Test Co A';

describe('the Arabic catalog', () => {
  it('holds only keys the English catalog has', () => {
    expect([...ar.keys()].filter((k) => !en.has(k))).toEqual([]);
  });

  it('formats every message in Arabic, for every plural form, with Latin digits', () => {
    for (const [key, message] of ar) {
      const args = argsOf(message);
      for (const count of args.includes('count') ? [0, 1, 2, 3, 11, 100, 1234] : [0]) {
        const values = Object.fromEntries(args.map((a) => [a, sample(a, count)]));
        let out = '';
        expect(() => (out = t(key as never, values as never)), `${key} formats`).not.toThrow();
        expect(out, `${key} is not its own key`).not.toBe(key);
        expect(ARABIC_DIGIT.test(out), `${key} prints Latin digits: ${out}`).toBe(false);
        if (!NOT_ARABIC.has(key) && hasOwnWords(message))
          expect(ARABIC_LETTER.test(out), `${key} reads in Arabic: ${out}`).toBe(true);
        if (args.includes('count') && count === 1234) expect(out, `${key} shows the count`).toMatch(/1,?234/);
      }
    }
  });

  it('carries exactly the English placeholders', () => {
    const wrong = [...ar]
      .filter(([k, m]) => en.has(k) && argsOf(m).join() !== argsOf(en.get(k)!).join())
      .map(([k, m]) => `${k}: [${argsOf(m).join()}] ≠ [${argsOf(en.get(k)!).join()}]`);
    expect(wrong).toEqual([]);
  });

  it('says a count in its Arabic form: one, two, a few, many', () => {
    const count = (key: string, n: number) => t(key as never, { count: n, name: 'Test Co A' } as never);
    expect(count('settings.people.people', 1)).toBe('شخص واحد');
    expect(count('settings.people.people', 2)).toBe('شخصان');
    expect(count('settings.people.people', 3)).toBe('3 أشخاص');
    expect(count('settings.people.people', 11)).toBe('11 شخصًا');
    expect(count('settings.people.people', 100)).toBe('100 شخص');
    expect(count('table.selected', 2)).toBe('عنصران محددان');
  });

  it('never says what the app never says, nor «شركة» or «هامش»', () => {
    const found = [...ar]
      .filter(([, m]) => BANNED.test(m) || /شرك[ةت]|شركات|هامش/.test(m))
      .map(([k, m]) => `${k}: ${m}`);
    expect(found).toEqual([]);
  });

  it('keeps «المسؤول» for the KPI lead (V405); an admin is «مسؤول النظام»', () => {
    const found = [...ar].filter(([k, m]) => /المسؤول/.test(m) && !KPI_LEAD_KEY.test(k)).map(([k, m]) => `${k}: ${m}`);
    expect(found).toEqual([]);
  });

  it('never calls an admin «مدير النظام» — «مدير» is the Manager role', () => {
    const found = [...ar].filter(([, m]) => /(ال|ل)?مدير(ي)? النظام/.test(m)).map(([k, m]) => `${k}: ${m}`);
    expect(found, 'an admin is «مسؤول النظام»').toEqual([]);
  });

  it('never says a form V490 retired: each term has one Arabic word', () => {
    // The old form, and the one word that replaced it (V490; the oversight's check of the whole catalog, 29 Sep).
    const RETIRED: [RegExp, string][] = [
      [/رئيس القسم|مدير الإدارة/, 'رئيس الإدارة'],
      [/الإثنين/, 'الاثنين'],
      [/غير مقيس/, 'غير متاح'],
      [/الخاص به/, 'سجلاته فقط'],
      [/الذراع التجاري(?!ة)/, 'الذراع التجارية'],
    ];
    const found = [...ar].flatMap(([k, m]) =>
      RETIRED.filter(([old]) => old.test(m)).map(([, now]) => `${k}: ${m} (say «${now}»)`),
    );
    expect(found, 'one word for each term (V490)').toEqual([]);
  });

  it('puts the tanween fatha before the alif, as every other word does', () => {
    const found = [...ar].filter(([, m]) => /اً/.test(m)).map(([k, m]) => `${k}: ${m}`);
    expect(found, 'tanween sits before the alif').toEqual([]);
  });
});
