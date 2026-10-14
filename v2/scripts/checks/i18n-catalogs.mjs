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
/**
 * The keys written twice in one object of a catalog, as dotted paths. JSON.parse keeps the last and drops the earlier
 * block silently, so two merged branches that each add `errors` or `partners` hide each other's Arabic without a test
 * noticing (main held two such blocks on 2 Oct, until the catalog was rebuilt). Reads the text, not the parsed value.
 * @param {string} text
 * @returns {string[]}
 */
export function duplicateKeys(text) {
  /** @type {string[]} */
  const found = [];
  /** @type {{ kind: 'o' | 'a', keys: Set<string>, path: string, key: string }[]} */
  const stack = [];
  const here = () => {
    const top = stack[stack.length - 1];
    return top && top.kind === 'o' ? (top.path ? `${top.path}.${top.key}` : top.key) : (top?.path ?? '');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      let str = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') str += text[j++];
        str += text[j++];
      }
      let k = j + 1;
      while (/\s/.test(text[k] ?? '')) k++;
      const top = stack[stack.length - 1];
      if (top && top.kind === 'o' && text[k] === ':') {
        if (top.keys.has(str)) found.push(top.path ? `${top.path}.${str}` : str);
        top.keys.add(str);
        top.key = str;
      }
      i = j;
    } else if (c === '{') stack.push({ kind: 'o', keys: new Set(), path: here(), key: '' });
    else if (c === '[') stack.push({ kind: 'a', keys: new Set(), path: here(), key: '' });
    else if (c === '}' || c === ']') stack.pop();
  }
  return found;
}

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
      for (const file of ['messages/en.json', 'messages/ar.json'])
        for (const k of duplicateKeys(ctx.read(file)))
          out.push({
            check,
            file,
            line: 0,
            message: `"${k}" is written twice — the later block hides the earlier one`,
          });
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
