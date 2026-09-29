// @ts-check
// V11 / A19 — screens carry data and controls only. The kit has no banner, callout, hint or helper-text component,
// and no screen may add one: such a component, an export of one, a hint/helper prop, a class named like one, or a
// "Note:" / "Tip:" / "Hint:" sentence in JSX or in a wording catalog is refused.
import { defineCheck, lineOf, select } from './lib.mjs';

const COMPONENT = /<(?:Banner|Callout|Hint|HelperText|InfoBox|Notice|Tip|Explainer|Announcement|Disclaimer)\b/g;
const EXPORT =
  /export\s+(?:default\s+)?(?:function|const)\s+(?:Banner|Callout|Hint|HelperText|InfoBox|Notice|Tip|Explainer|Announcement|Disclaimer)\b/g;
const PROP = /\s(?:hint|helperText|helper|hintText|explanation)=/g;
const CLASS = /class(?:Name)?=["'`{][^"'`}]*\b(?:banner|callout|hint|helper-text|notice|explainer)\b/g;
const SENTENCE = /(?:^|[>"'`])\s*(?:Note|Tip|Hint|Please note|Important)\s*:/g;
const AR_SENTENCE = /^(?:ملاحظة|تلميح|تنبيه)\s*:/;

export default defineCheck({
  name: 'ui-no-hints',
  rule: 'V11: no banner, callout, hint or helper text in any screen, component or catalog',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'ui-no-hints';
    for (const file of select(ctx, ['src/**/*.{ts,tsx,js,jsx}'])) {
      const text = ctx.read(file);
      for (const [re, what] of /** @type {[RegExp, string][]} */ ([
        [COMPONENT, 'a hint or banner component'],
        [EXPORT, 'a hint or banner component is exported'],
        [PROP, 'a hint or helper prop'],
        [CLASS, 'a class named like a banner or hint'],
        [SENTENCE, 'an explanatory sentence'],
      ])) {
        re.lastIndex = 0;
        for (let m; (m = re.exec(text));)
          out.push({ check, file, line: lineOf(text, m.index), message: `${what}: "${m[0].trim()}"` });
      }
    }
    for (const file of select(ctx, ['messages/*.json'])) {
      const text = ctx.read(file);
      /** @param {unknown} node @param {string} path */
      const visit = (node, path) => {
        if (typeof node === 'string') {
          if (/^(?:Note|Tip|Hint|Please note|Important)\s*:/i.test(node) || AR_SENTENCE.test(node)) {
            const at = text.indexOf(JSON.stringify(node));
            out.push({ check, file, line: at >= 0 ? lineOf(text, at) : 0, message: `hint sentence at ${path}` });
          }
        } else if (node && typeof node === 'object')
          for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}.${k}` : k);
      };
      visit(JSON.parse(text), '');
    }
    return out;
  },
});
