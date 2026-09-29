// @ts-check
// §2.5 / BUILD-PLAN — every string has a key in messages/en.json and the same key in messages/ar.json, and screens
// carry no hard-coded sentences: a JSX text node of two or more words in src/app, src/modules or src/ui/shell is
// refused. The kit gallery (src/app/(app)/kit, development only — V202) is exempt.
import { defineCheck, literals, parseSource, select } from './lib.mjs';

/** @param {unknown} o @param {string} p @param {string[]} out */
const flat = (o, p = '', out = []) => {
  if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') out.push(p + k);
      else flat(v, `${p}${k}.`, out);
    }
  return out;
};
const SENTENCE = /[A-Za-z؀-ۿ][^\n]*\s[A-Za-z؀-ۿ]/;
const ALLOWED_TEXT = new Set(['Ctrl K']);

export default defineCheck({
  name: 'i18n-catalogs',
  rule: 'V410: en.json and ar.json carry the same keys (en is the source; builder C writes the Arabic); no hard-coded sentence in a screen',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'i18n-catalogs';
    if (ctx.exists('messages/en.json') && ctx.exists('messages/ar.json')) {
      const en = flat(JSON.parse(ctx.read('messages/en.json')));
      const ar = flat(JSON.parse(ctx.read('messages/ar.json')));
      // en.json is the source: builder B adds keys there; builder C writes their Arabic (V410). Both ways are findings
      // (restored by the oversight on 29 Sep, once ar.json was complete): a key with no Arabic, and a key in ar.json
      // alone (a typo, a removed key). The app still shows English for a key with no Arabic (core/i18n/messages.ts).
      for (const k of en)
        if (!ar.includes(k)) out.push({ check, file: 'messages/ar.json', line: 0, message: `missing "${k}"` });
      for (const k of ar)
        if (!en.includes(k)) out.push({ check, file: 'messages/en.json', line: 0, message: `missing "${k}"` });
    }
    const screens = select(
      ctx,
      ['src/app/**/*.tsx', 'src/modules/**/*.tsx', 'src/ui/shell/**/*.tsx'],
      ['src/app/**/kit/**'],
    );
    for (const file of screens) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind !== 'jsx') continue;
        const words = lit.text.trim();
        if (!words || ALLOWED_TEXT.has(words) || !SENTENCE.test(words)) continue;
        out.push({ check, file, line: lit.line, message: `hard-coded text "${words}" — use the catalog` });
      }
    }
    return out;
  },
});
