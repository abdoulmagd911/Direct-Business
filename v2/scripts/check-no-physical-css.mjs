/**
 * Logical properties only (spec §2.5 RTL): no ml-/mr-/pl-/pr-/left-/right-/text-left/rounded-l …
 * utilities and no physical CSS properties, so Arabic is a `dir` flip, not a rewrite.
 */
import { ROOT, read, rel, report, stripComments, walk } from './lib.mjs';

const files = walk(`${ROOT}/src`, ['.ts', '.tsx', '.css']);
const UTIL = /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right|inset-l|inset-r|scroll-ml|scroll-mr|scroll-pl|scroll-pr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|divide-l|divide-r)-(?:\[[^\]]+\]|[\w.]+)|text-left|text-right|float-left|float-right|clear-left|clear-right|border-l|border-r|rounded-l|rounded-r|origin-left|origin-right|inset-l|inset-r)(?![\w-])/g;
const PROP = /(?<![\w-])(?:margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius|text-align\s*:\s*(?:left|right)|float\s*:\s*(?:left|right)|clear\s*:\s*(?:left|right))(?![\w-])|(?<![\w-])(?:left|right)\s*:/g;
const problems = [];
for (const f of files) {
  stripComments(read(f)).split('\n').forEach((line, i) => {
    const code = line;
    for (const re of [UTIL, PROP]) {
      re.lastIndex = 0;
      const m = re.exec(code);
      if (m) problems.push(`${rel(f)}:${i + 1}: physical direction → "${m[0].trim()}" (use ms/me/ps/pe/start/end)`);
    }
  });
}
process.exit(report('no-physical-css (logical properties only)', problems) ? 0 : 1);
