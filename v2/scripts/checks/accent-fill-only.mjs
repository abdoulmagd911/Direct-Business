// @ts-check
// V60 (V7) — `--accent` is a fill or mark only, never text and never under a label: in Direct it is the brand orange,
// whose contrast with white is 3.13:1. Text in the accent colour uses `--link`; a filled button uses `--primary`
// with `--on-primary`. Refused: `text-accent`, `color: var(--accent)`; `bg-accent` outside the kit files that draw
// marks, tabs, bars and selection; `bg-accent` on the same element as `text-on-accent`; `text-on-accent` outside an
// icon-only indicator. The runtime half is the E2E walk "Direct never puts text on the accent fill".
import { defineCheck, select } from './lib.mjs';

/** Kit files allowed to fill with the accent (marks, tabs, bars, selection, the check mark). */
export const FILL_FILES = new Set([
  'src/ui/Chip.tsx',
  'src/ui/Tabs.tsx',
  'src/ui/Checkbox.tsx',
  'src/ui/KpiTile.tsx',
  'src/ui/AvatarStack.tsx',
  'src/ui/EntityLink.tsx',
  'src/ui/shell/ProfileMenu.tsx',
]);
/** Files allowed to put something on the accent — an icon, never a label. */
export const ON_ACCENT_FILES = new Set(['src/ui/Checkbox.tsx']);

const TEXT_ACCENT = /(?<![\w-])text-accent(?:-hover)?(?![\w-])|color\s*:\s*var\(--accent(?:-hover)?\)/g;
const FILL = /(?<![\w-])bg-accent(?:-hover)?(?![\w-])|background(?:-color)?\s*:\s*var\(--accent(?:-hover)?\)/g;
const ON_ACCENT = /(?<![\w-])text-on-accent(?![\w-])/g;

export default defineCheck({
  name: 'accent-fill-only',
  rule: 'V60: --accent is a fill or mark only — text uses --link, a filled button uses --primary',
  run(ctx) {
    /** @type {import('./lib.mjs').Finding[]} */
    const out = [];
    const check = 'accent-fill-only';
    for (const file of select(ctx, ['src/**/*.{ts,tsx,css}'], ['src/ui/tokens.css', 'src/ui/globals.css'])) {
      const text = ctx.read(file);
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        const n = i + 1;
        TEXT_ACCENT.lastIndex = 0;
        if (TEXT_ACCENT.test(line)) out.push({ check, file, line: n, message: 'text in --accent — use text-link' });
        FILL.lastIndex = 0;
        const fill = FILL.test(line);
        if (fill && !FILL_FILES.has(file))
          out.push({
            check,
            file,
            line: n,
            message: 'bg-accent outside the fill-only kit files — a button uses bg-primary',
          });
        ON_ACCENT.lastIndex = 0;
        const onAccent = ON_ACCENT.test(line);
        if (fill && onAccent) out.push({ check, file, line: n, message: 'a label on the accent fill' });
        if (onAccent && !ON_ACCENT_FILES.has(file))
          out.push({ check, file, line: n, message: 'text-on-accent outside an icon-only indicator' });
      });
    }
    return out;
  },
});
