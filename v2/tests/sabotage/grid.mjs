// @ts-check
// Builder C's Past work grid (P5-2c, V306): every grid test goes red under a planted defect, for its reason (V100).
const unit = (/** @type {string} */ f) => `unit:tests/unit/grid/${f}`;
const BLOCK = unit('a-pasted-block-of-20-rows-maps-to-20-rows-and-one-request.test.ts');
const PREVIEW = unit('the-preview-refuses-a-future-date-a-missing-title-and-an-unknown-organisation-by-name.test.ts');
const PASTE = unit('pastes-from-excel-and-google-sheets-read-the-same.test.ts');
const ZONES = unit('a-pasted-date-and-riyadhs-today-read-the-same-in-every-time-zone-and-from-an-arabic-sheet.test.ts');
const GRID = unit('the-grid-previews-every-row-and-saves-the-ready-ones-as-one-request-with-one-undo.test.tsx');
const ROWS = 'src/ui/grid/rows.ts';
const DATES = 'src/ui/grid/dates.ts';
const READ = 'src/ui/grid/paste.ts';
const COMPONENT = 'src/ui/grid/PastWorkGrid.tsx';

/** @type {{ name: string, breaks: string[], expect: string, edits: { file: string, find: string, replace: string }[] }[]} */
export const sabotages = [
  {
    name: 'grid-forgets-the-origin',
    breaks: [BLOCK],
    expect: 'marked backfill',
    edits: [{ file: ROWS, find: "    origin: 'backfill',", replace: "    origin: 'ui' as 'backfill'," }],
  },
  {
    name: 'grid-reads-the-header-as-a-row',
    breaks: [BLOCK],
    expect: 'maps its header to the fields',
    edits: [{ file: ROWS, find: 'if (found >= 2) return', replace: 'if (found >= 99) return' }],
  },
  {
    name: 'grid-lets-a-future-date-in',
    breaks: [PREVIEW],
    expect: 'names each refused row with its reasons',
    edits: [{ file: ROWS, find: 'else if (date.day > o.today)', replace: "else if (date.day > '9999')" }],
  },
  {
    name: 'grid-takes-an-unknown-organisation',
    breaks: [PREVIEW],
    expect: 'names each refused row with its reasons',
    edits: [
      {
        file: ROWS,
        find: "      else if (match.kind === 'none') problems.push('organisation_unknown');\n",
        replace: '',
      },
    ],
  },
  {
    name: 'grid-sends-a-refused-row',
    breaks: [PREVIEW, GRID],
    expect: 'only the ready',
    edits: [{ file: ROWS, find: '.filter((r) => r.problems.length === 0)', replace: ".filter((r) => r.title !== '')" }],
  },
  {
    name: 'grid-guesses-an-ambiguous-date',
    breaks: [PREVIEW],
    expect: 'refuses one that could be two days',
    edits: [
      {
        file: DATES,
        find: "if (!chosen) return { problem: 'date_ambiguous' };",
        replace: 'if (!chosen) return found(calendarDay(y, b, a));',
      },
    ],
  },
  {
    name: 'grid-reads-dates-month-first',
    breaks: [PREVIEW],
    expect: 'reads in the order the person chose',
    edits: [
      {
        file: DATES,
        find: "chosen === 'dmy' ? calendarDay(y, b, a) : calendarDay(y, a, b)",
        replace: "chosen === 'dmy' ? calendarDay(y, a, b) : calendarDay(y, b, a)",
      },
    ],
  },
  {
    name: 'paste-splits-a-quoted-line-break',
    breaks: [PASTE],
    expect: 'reads Excel',
    edits: [{ file: READ, find: "if (ch === '\"' && !started) {", replace: "if (ch === '\"' && !started && false) {" }],
  },
  {
    name: 'paste-keeps-empty-rows',
    breaks: [PASTE],
    expect: 'drops empty rows',
    edits: [{ file: READ, find: ".filter((r) => r.some((c) => c !== ''))", replace: '.filter(() => true)' }],
  },
  {
    name: 'grid-offers-no-undo',
    breaks: [GRID],
    expect: 'one request with one Undo',
    edits: [
      {
        file: COMPONENT,
        find: 'undo: requestId && undo ? { label: labels.undo, onUndo: () => undo(requestId) } : undefined,',
        replace: 'undo: undefined,',
      },
    ],
  },
  {
    name: 'grid-sends-a-request-per-row',
    breaks: [GRID],
    expect: 'one request with one Undo',
    edits: [
      {
        file: COMPONENT,
        find: 'const { requestId } = await props.save(request);',
        replace:
          'for (const one of request.rows.slice(1)) await props.save({ ...request, rows: [one] });\n      const { requestId } = await props.save({ ...request, rows: request.rows.slice(0, 1) });',
      },
    ],
  },
  {
    name: 'grid-today-in-the-computers-zone',
    breaks: [ZONES],
    expect: "Riyadh's day",
    edits: [
      {
        file: COMPONENT,
        find: 'for (const part of riyadhDay.formatToParts(now)) p[part.type] = part.value;',
        replace:
          "Object.assign(p, { year: String(now.getFullYear()), month: String(now.getMonth() + 1).padStart(2, '0'), day: String(now.getDate()).padStart(2, '0') });",
      },
    ],
  },
  {
    name: 'grid-keeps-direction-marks',
    breaks: [ZONES],
    expect: 'an Arabic sheet date is read',
    edits: [{ file: DATES, find: "    .replace(DIRECTION_MARKS, '')\n", replace: '' }],
  },
  {
    name: 'grid-reads-no-arabic-month',
    breaks: [ZONES],
    expect: 'is read as 2026-01-07',
    edits: [{ file: DATES, find: 'AR_MONTHS.indexOf(m[2]!) + 1', replace: '0' }],
  },
];
