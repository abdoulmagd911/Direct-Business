/**
 * Every key in messages/en.json exists in messages/ar.json and vice versa, and screens carry no
 * hard-coded sentences: a JSX text node of two or more words in src/app, src/modules or src/ui/shell
 * is refused (the kit gallery is development-only and exempt — V202).
 */
import { ROOT, read, rel, report, walk } from './lib.mjs';

const flat = (o, p = '', out = []) => {
  for (const [k, v] of Object.entries(o)) typeof v === 'string' ? out.push(p + k) : flat(v, `${p}${k}.`, out);
  return out;
};
const en = flat(JSON.parse(read(`${ROOT}/messages/en.json`)));
const ar = flat(JSON.parse(read(`${ROOT}/messages/ar.json`)));
const problems = [];
for (const k of en) if (!ar.includes(k)) problems.push(`messages/ar.json is missing "${k}"`);
for (const k of ar) if (!en.includes(k)) problems.push(`messages/en.json is missing "${k}"`);

const dirs = [`${ROOT}/src/app`, `${ROOT}/src/modules`, `${ROOT}/src/ui/shell`];
const TEXT = />\s*([A-Za-z][^<>{}]*?\s[A-Za-z][^<>{}]*?)\s*</g;
for (const d of dirs) {
  for (const f of walk(d, ['.tsx'])) {
    if (rel(f).includes('/kit/')) continue;
    read(f).split('\n').forEach((line, i) => {
      TEXT.lastIndex = 0;
      const m = TEXT.exec(line);
      if (m && !/^Ctrl K$/.test(m[1].trim())) problems.push(`${rel(f)}:${i + 1}: hard-coded text "${m[1].trim()}" — use the catalog`);
    });
  }
}
process.exit(report('i18n (catalogs in step, no hard-coded sentences)', problems) ? 0 : 1);
