// @ts-check
// W-daily 13 (V638): a date is written one way everywhere — `14 Oct 2026`, a three-letter month, the year — by the one
// shared formatter, formatDate in src/core/i18n/format.ts. Refused in src/: another way of writing a date for the
// screen (toLocaleDateString / toLocaleTimeString / toLocaleString, Intl.DateTimeFormat — except the `en-CA` idiom that
// computes a YYYY-MM-DD day, never shown), a long month beside a day or a long date style in an options object, and a
// raw date input that would show the browser's own format (use <Input type="date">, which shows the same format).
// A month on its own (a period's name) is a label, not a date: waive it with `check-allow: one-date-format — reason`.
import ts from 'typescript';
import { defineCheck, lineOfNode, parseSource, select, walkAst } from './lib.mjs';

const CHECK = 'one-date-format';
const HOME = 'src/core/i18n/format.ts';
const INPUT_HOME = 'src/ui/Input.tsx';
const LOCALE_METHODS = new Set(['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']);
const DATE_INPUTS = new Set(['date', 'datetime-local', 'time']);

/** @param {ts.Expression | undefined} e */
const isEnCa = (e) => !!e && ts.isStringLiteralLike(e) && e.text === 'en-CA';

/** @param {ts.ObjectLiteralExpression} o @param {string} name */
function propOf(o, name) {
  for (const p of o.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === name) return p.initializer;
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) return p.name;
  }
  return undefined;
}
/** @param {ts.Expression | undefined} e @param {string[]} words */
const isWord = (e, words) => !!e && ts.isStringLiteralLike(e) && words.includes(e.text);
/** @param {ts.Expression | undefined} e */
const isSet = (e) => !!e && !(ts.isIdentifier(e) && e.text === 'undefined');

export default defineCheck({
  name: CHECK,
  rule: 'W-daily 13: one date format everywhere (14 Oct 2026) — formatDate only; no browser-formatted date inputs',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    for (const file of select(ctx, ['src/**/*.{ts,tsx}'], [HOME])) {
      const sf = parseSource(file, ctx.read(file));
      /** @param {ts.Node} n @param {string} message */
      const add = (n, message) => out.push({ check: CHECK, file, line: lineOfNode(sf, n), message });
      walkAst(sf, (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
          const name = n.expression.name.text;
          if (LOCALE_METHODS.has(name) && !isEnCa(n.arguments[0]))
            add(n, `${name} writes a date its own way — use formatDate (src/core/i18n/format.ts)`);
          if (name === 'DateTimeFormat' && n.expression.expression.getText() === 'Intl' && !isEnCa(n.arguments[0]))
            add(n, 'Intl.DateTimeFormat writes a date its own way — use formatDate (src/core/i18n/format.ts)');
        }
        if (
          ts.isNewExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'DateTimeFormat' &&
          n.expression.expression.getText() === 'Intl' &&
          !isEnCa(n.arguments?.[0])
        )
          add(n, 'Intl.DateTimeFormat writes a date its own way — use formatDate (src/core/i18n/format.ts)');
        if (ts.isObjectLiteralExpression(n)) {
          if (isWord(propOf(n, 'dateStyle'), ['long', 'full']))
            add(n, "a long date style — dates are written `14 Oct 2026` (dateStyle: 'medium')");
          if (isWord(propOf(n, 'month'), ['long']) && isSet(propOf(n, 'day')))
            add(n, "a long month beside a day — dates are written `14 Oct 2026` (month: 'short')");
        }
        if (file !== INPUT_HOME && (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n))) {
          if (n.tagName.getText() !== 'input') return;
          for (const a of n.attributes.properties) {
            if (
              ts.isJsxAttribute(a) &&
              a.name.getText() === 'type' &&
              a.initializer &&
              ts.isStringLiteral(a.initializer) &&
              DATE_INPUTS.has(a.initializer.text)
            )
              add(
                a,
                a.initializer.text === 'time'
                  ? 'a raw time input shows the browser clock (9:30 AM) — use <TimeInput> (src/ui/Input.tsx)'
                  : 'a raw date input shows the browser format — use <Input type="date"> (src/ui/Input.tsx)',
              );
          }
        }
      });
    }
    return out;
  },
});
