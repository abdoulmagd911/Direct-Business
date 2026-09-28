/**
 * --accent is a FILL only (V7): text in that colour uses --link, a filled button uses --primary.
 *  - `text-accent` is refused everywhere.
 *  - `bg-accent` is allowed only in the kit files that draw marks, tabs, bars and selection,
 *    and never on the same element as `text-on-accent` with a label (that would be white on orange in Direct).
 *  - `text-on-accent` is allowed only on icon-only indicators (Checkbox).
 */
import { ROOT, read, rel, report, stripComments, walk } from './lib.mjs';

const FILL_FILES = new Set(['src/ui/Chip.tsx', 'src/ui/Tabs.tsx', 'src/ui/Checkbox.tsx', 'src/ui/KpiTile.tsx', 'src/ui/AvatarStack.tsx', 'src/ui/EntityLink.tsx', 'src/ui/shell/ProfileMenu.tsx']);
const ON_ACCENT_FILES = new Set(['src/ui/Checkbox.tsx']);
const files = walk(`${ROOT}/src`, ['.ts', '.tsx', '.css']).filter((f) => !f.endsWith('src/ui/tokens.css') && !f.endsWith('src/ui/globals.css'));
const problems = [];
for (const f of files) {
  const r = rel(f);
  stripComments(read(f)).split('\n').forEach((line, i) => {
    if (/(?<![\w-])text-accent(?:-hover)?(?![\w-])/.test(line) || /color\s*:\s*var\(--accent(?:-hover)?\)/.test(line)) problems.push(`${r}:${i + 1}: text in --accent (use text-link)`);
    const fill = /(?<![\w-])bg-accent(?:-hover)?(?![\w-])|background(?:-color)?\s*:\s*var\(--accent(?:-hover)?\)/.test(line);
    if (fill && !FILL_FILES.has(r)) problems.push(`${r}:${i + 1}: bg-accent outside the fill-only kit files (buttons use bg-primary)`);
    if (fill && /text-on-accent/.test(line)) problems.push(`${r}:${i + 1}: a label on the accent fill`);
    if (/text-on-accent/.test(line) && !ON_ACCENT_FILES.has(r)) problems.push(`${r}:${i + 1}: text-on-accent outside icon-only indicators`);
  });
}
process.exit(report('accent-fill-only (--accent never behind text)', problems) ? 0 : 1);
