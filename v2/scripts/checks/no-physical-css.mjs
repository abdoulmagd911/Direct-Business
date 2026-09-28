// @ts-check
// §2.5 right-to-left: only logical CSS (ms-/me-/ps-/pe-/start-/end-, text-start). Physical left/right utilities,
// properties and inline styles are refused in src/, so Arabic can be switched on without a hunt for leaks.
import ts from 'typescript';
import {
  classTokens,
  cssCode,
  defineCheck,
  lineOf,
  lineOfNode,
  literals,
  parseSource,
  select,
  walkAst,
} from './lib.mjs';

/** Tailwind utilities with a physical direction, and their logical replacement. */
const PHYSICAL_CLASSES = [
  [/^-?(m|p)(l|r)-/, 'ms-/me-/ps-/pe-'],
  [/^-?scroll-(m|p)(l|r)-/, 'scroll-ms-/scroll-me-/scroll-ps-/scroll-pe-'],
  [/^-?(left|right)-/, 'start-/end-'],
  [/^text-(left|right)$/, 'text-start/text-end'],
  [/^(float|clear)-(left|right)$/, 'float-start/float-end'],
  [/^rounded-(l|r|tl|tr|bl|br)(-|$)/, 'rounded-s/-e/-ss/-se/-es/-ee'],
  [/^border-(l|r)(-|$)/, 'border-s/border-e'],
  [/^origin-(left|right|top-left|top-right|bottom-left|bottom-right)$/, 'a logical origin'],
  [/^bg-(left|right)(-top|-bottom)?$/, 'a logical position'],
];

/** CSS declarations with a physical direction. */
const PHYSICAL_CSS = [
  /(?:^|[;{\s])((?:margin|padding|border|scroll-margin|scroll-padding|inset)-(?:left|right)(?:-[a-z]+)?)\s*:/g,
  /(?:^|[;{\s])((?:left|right))\s*:/g,
  /(?:^|[;{\s])(border-(?:top|bottom)-(?:left|right)-radius)\s*:/g,
  /(?:^|[;{\s])((?:text-align|float|clear)\s*:\s*(?:left|right))\b/g,
];

/** Inline style properties (React style objects) with a physical direction. */
const PHYSICAL_STYLE_PROPS = new Set([
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'borderLeft',
  'borderRight',
  'borderLeftWidth',
  'borderRightWidth',
  'borderLeftColor',
  'borderRightColor',
  'borderLeftStyle',
  'borderRightStyle',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'scrollMarginLeft',
  'scrollMarginRight',
  'scrollPaddingLeft',
  'scrollPaddingRight',
]);

/** @param {ts.Node} n */
function insideStyleAttribute(n) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return p.name.getText() === 'style';
    if (ts.isSourceFile(p)) return false;
  }
  return false;
}

export default defineCheck({
  name: 'no-physical-css',
  rule: '§2.5: logical CSS only (ms-/me-/ps-/pe-/start-/end-, text-start) — no physical left/right',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'no-physical-css';
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind === 'regex' || lit.kind === 'jsx') continue;
        for (const tok of classTokens(lit.text)) {
          const hit = PHYSICAL_CLASSES.find(([re]) => /** @type {RegExp} */ (re).test(tok));
          if (hit) out.push({ check, file, line: lit.line, message: `"${tok}" is physical — use ${hit[1]}` });
        }
      }
      walkAst(sf, (n) => {
        if (!ts.isPropertyAssignment(n) && !ts.isShorthandPropertyAssignment(n)) return;
        const name = n.name.getText(sf).replace(/['"]/g, '');
        const inStyle = insideStyleAttribute(n);
        if (PHYSICAL_STYLE_PROPS.has(name) || (inStyle && (name === 'left' || name === 'right')))
          out.push({
            check,
            file,
            line: lineOfNode(sf, n),
            message: `style "${name}" is physical — use its logical form`,
          });
        if (
          ts.isPropertyAssignment(n) &&
          ['textAlign', 'float', 'clear'].includes(name) &&
          ts.isStringLiteralLike(n.initializer) &&
          ['left', 'right'].includes(n.initializer.text)
        )
          out.push({
            check,
            file,
            line: lineOfNode(sf, n),
            message: `style ${name}: '${n.initializer.text}' is physical — use start/end`,
          });
      });
    }
    for (const file of select(ctx, ['src/**/*.{css,scss}'])) {
      const text = ctx.read(file);
      const code = cssCode(text);
      for (const re of PHYSICAL_CSS) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(code));) {
          const at = m.index + m[0].indexOf(/** @type {string} */ (m[1]));
          out.push({ check, file, line: lineOf(code, at), message: `"${m[1]}" is physical — use its logical form` });
        }
      }
    }
    return out;
  },
});
