/**
 * The kit has no banner, callout, hint or helper-text component and no screen may add one (V11,
 * rule A19): screens carry data and controls only. This refuses such components, props and the
 * "Note:" / "Tip:" / "Hint:" sentences in JSX and in the wording catalogs.
 */
import { ROOT, read, rel, report, stripComments, walk } from './lib.mjs';

const files = walk(`${ROOT}/src`, ['.ts', '.tsx']);
const COMPONENT = /<(?:Banner|Callout|Hint|HelperText|InfoBox|Notice|Tip|Note|Alert|Explainer|Announcement|Disclaimer)\b/;
const EXPORT = /export\s+(?:function|const)\s+(?:Banner|Callout|Hint|HelperText|InfoBox|Notice|Tip|Explainer|Announcement|Disclaimer)\b/;
const PROP = /\b(?:hint|helperText|helper|hintText|explanation|note)=/;
const CLASS = /class(?:Name)?=["'`][^"'`]*\b(?:banner|callout|hint|helper-text|notice|explainer)\b/;
const SENTENCE = /(?:^|[>"'`\s])(?:Note|Tip|Hint|Please note|Remember|Important)\s*:/;
const problems = [];
for (const f of files) {
  stripComments(read(f)).split('\n').forEach((line, i) => {
    for (const re of [COMPONENT, EXPORT, PROP, CLASS, SENTENCE]) {
      const m = re.exec(line);
      if (m) problems.push(`${rel(f)}:${i + 1}: hint/banner content → "${m[0].trim()}"`);
    }
  });
}
for (const cat of ['en', 'ar']) {
  const json = JSON.parse(read(`${ROOT}/messages/${cat}.json`));
  const visit = (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (/^(?:Note|Tip|Hint|Please note|Important)\s*:/i.test(v) || /^(?:ملاحظة|تلميح|تنبيه)\s*:/.test(v)) problems.push(`messages/${cat}.json ${path}${k}: hint sentence`);
      } else visit(v, `${path}${k}.`);
    }
  };
  visit(json, '');
}
process.exit(report('ui-no-hints (no banner, callout or hint anywhere)', problems) ? 0 : 1);
