// @ts-check
// §2.5 tokens — every colour comes from the design tokens in src/ui/tokens.css (four themes, one set). A hex value,
// a functional colour (rgb(), hsl(), oklch() …), a named colour in a style, or a Tailwind palette colour (bg-red-500,
// text-white …) anywhere else in src/ is refused: it would not follow the theme.
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

const TOKENS_FILE = 'src/ui/tokens.css';
const HEX = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNCTIONAL = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const PALETTE_NAMES =
  'slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white|mauve|olive|mist|taupe';
const PALETTE = new RegExp(
  `^(?:bg|text|border(?:-[xytrblse])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|inset-ring|drop-shadow)-(?:${PALETTE_NAMES})(?:-\\d{2,3})?(?:\\/\\d+)?$`,
);
const NAMED = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'gray',
  'grey',
  'brown',
  'cyan',
  'magenta',
  'lime',
  'navy',
  'teal',
  'maroon',
  'olive',
  'silver',
  'gold',
  'aqua',
  'fuchsia',
  'indigo',
  'violet',
]);
const COLOUR_STYLE_PROPS = new Set([
  'color',
  'background',
  'backgroundColor',
  'borderColor',
  'outlineColor',
  'fill',
  'stroke',
  'caretColor',
  'accentColor',
  'textDecorationColor',
  'columnRuleColor',
  'borderBlockColor',
  'borderInlineColor',
]);
const COLOUR_CSS_PROP =
  /(?:^|[;{\s])((?:color|background|background-color|border(?:-[a-z]+)*-color|border|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color|box-shadow))\s*:\s*([^;}]*)/g;

export default defineCheck({
  name: 'no-hex',
  rule: '§2.5: colours only from src/ui/tokens.css — no hex, functional or named colours, no Tailwind palette colours',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'no-hex';
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'])) {
      const sf = parseSource(file, ctx.read(file));
      for (const lit of literals(sf)) {
        if (lit.kind === 'regex') continue;
        for (const re of [HEX, FUNCTIONAL]) {
          re.lastIndex = 0;
          for (let m; (m = re.exec(lit.text));)
            out.push({ check, file, line: lit.line, message: `colour "${m[0]}" outside ${TOKENS_FILE} — use a token` });
        }
        if (lit.kind !== 'jsx')
          for (const tok of classTokens(lit.text))
            if (PALETTE.test(tok))
              out.push({ check, file, line: lit.line, message: `palette colour "${tok}" — use a token utility` });
      }
      walkAst(sf, (n) => {
        if (
          ts.isPropertyAssignment(n) &&
          COLOUR_STYLE_PROPS.has(n.name.getText(sf).replace(/['"]/g, '')) &&
          ts.isStringLiteralLike(n.initializer) &&
          NAMED.has(n.initializer.text.trim().toLowerCase())
        )
          out.push({
            check,
            file,
            line: lineOfNode(sf, n),
            message: `named colour "${n.initializer.text}" — use a token`,
          });
      });
    }
    for (const file of select(ctx, ['src/**/*.{css,scss}'], [TOKENS_FILE])) {
      const code = cssCode(ctx.read(file));
      for (const re of [HEX, FUNCTIONAL]) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(code));)
          out.push({ check, file, line: lineOf(code, m.index), message: `colour "${m[0]}" outside ${TOKENS_FILE}` });
      }
      COLOUR_CSS_PROP.lastIndex = 0;
      for (let m; (m = COLOUR_CSS_PROP.exec(code));) {
        const value = /** @type {string} */ (m[2]);
        const words = value.toLowerCase().split(/[\s,()]+/);
        const named = words.find((w) => NAMED.has(w));
        if (named)
          out.push({
            check,
            file,
            line: lineOf(code, m.index + m[0].indexOf(value)),
            message: `named colour "${named}" in ${m[1]} — use a token`,
          });
      }
    }
    return out;
  },
});
