/**
 * No colour outside src/ui/tokens.css: no hex, rgb()/hsl(), and no Tailwind palette class
 * (`text-red-500`, `bg-white`). Components name tokens only (spec §2.5).
 */
import { ROOT, read, rel, report, stripComments, walk } from './lib.mjs';

const files = walk(`${ROOT}/src`, ['.ts', '.tsx', '.css']).filter((f) => !f.endsWith('src/ui/tokens.css'));
const HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;
const PALETTE = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|shadow|accent|caret|placeholder)-(?:white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)(?:-\d{2,3})?\b/g;
const problems = [];
for (const f of files) {
  const lines = stripComments(read(f)).split('\n');
  lines.forEach((line, i) => {
    const code = line;
    // an id or anchor like href="#main" is not a colour
    const stripped = code.replace(/(?:href|id|aria-\w+|data-[\w-]+|key|name|value)=["'{][^"'}]*["'}]/g, '');
    for (const re of [HEX, FUNC, PALETTE]) {
      re.lastIndex = 0;
      const m = re.exec(stripped);
      if (m) problems.push(`${rel(f)}:${i + 1}: colour outside tokens.css → "${m[0]}"`);
    }
  });
}
process.exit(report('no-hex (colours only in tokens.css)', problems) ? 0 : 1);
