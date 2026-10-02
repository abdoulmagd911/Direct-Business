// @ts-check
// Builder C's list exports (P3-12, V303): every unit test in tests/unit/export/ for the list exports is seen to fail
// under a planted defect, for the reason it names (V100). The report exports' sabotages are in export.mjs.
const CSV = 'tests/unit/export/a-csv-export-opens-every-risky-cell-as-text.test.ts';
const PAGES = 'tests/unit/export/a-list-is-read-past-the-1000-row-cap-to-its-last-row.test.ts';
const FORMS = 'tests/unit/export/dates-numbers-and-ids-keep-their-form-in-csv-and-excel.test.ts';
const XLSX = 'tests/unit/export/an-excel-export-opens-as-typed-with-riyadh-dates-and-text-ids.test.ts';
const LIST = 'tests/unit/export/an-export-holds-exactly-the-lists-rows-and-is-named-with-the-list-and-time.test.ts';
const BUTTON = 'tests/unit/export/the-export-button-downloads-the-list-and-says-why-when-it-cannot.test.tsx';
const ROLES =
  'tests/unit/export/an-export-holds-the-columns-and-rows-each-role-sees-guarded-named-and-in-the-apps-own-words.test.ts';
const ZONES = 'tests/unit/export/an-export-is-the-same-file-in-every-time-zone-and-at-every-riyadh-midnight.test.ts';
const OLD =
  'tests/unit/export/an-export-leaves-money-to-finance-writes-list-values-in-the-readers-language-and-needs-columns.test.tsx';
const PHOTO = 'tests/unit/export/no-export-carries-a-profile-photo.test.ts';

const GUARD = 'src/core/export/csvGuard.ts';
const CSVW = 'src/core/export/csv.ts';
const FETCH = 'src/core/export/fetchAll.ts';
const COLS = 'src/core/export/columns.ts';
const XLSXW = 'src/core/export/xlsx.ts';
const NAME = 'src/core/export/fileName.ts';
const EXPORT = 'src/core/export/exportList.ts';
const BTN = 'src/core/export/ExportButton.tsx';

/** @type {{ name: string, breaks: string[], expect: string, edits: { file: string, find: string, replace: string }[] }[]} */
export const sabotages = [
  // ---------------------------------------------------------------- csvGuard and the CSV (CP5)
  {
    name: 'guard-lets-a-formula-through',
    breaks: [`unit:${CSV}`],
    expect: 'opens "=1+1" as text',
    edits: [{ file: GUARD, find: 'if (/^[=+@\\t\\r\\n]/.test(v))', replace: 'if (/^[+@\\t\\r\\n]/.test(v))' }],
  },
  {
    name: 'guard-lets-a-minus-formula-through',
    breaks: [`unit:${CSV}`],
    expect: 'opens "-2+3" as text',
    edits: [{ file: GUARD, find: "if (v.startsWith('-') && ", replace: "if (v.startsWith('-') && false && " }],
  },
  {
    name: 'csv-skips-the-guard-on-texts',
    breaks: [`unit:${CSV}`],
    expect: 'guards the headers, the texts and the IDs',
    edits: [{ file: CSVW, find: 'return field(csvGuard(cell.v));', replace: 'return field(cell.v);' }],
  },
  {
    name: 'csv-skips-the-guard-on-headers',
    breaks: [`unit:${CSV}`],
    expect: 'guards the headers, the texts and the IDs',
    edits: [{ file: CSVW, find: 'field(csvGuard(c.header))', replace: 'field(c.header)' }],
  },
  {
    name: 'csv-drops-its-quoting',
    breaks: [`unit:${CSV}`],
    expect: 'quotes a cell holding a comma',
    edits: [{ file: CSVW, find: 'return /[",\\r\\n]/.test(text) ?', replace: 'return false ?' }],
  },
  {
    name: 'csv-drops-the-byte-order-mark',
    breaks: [`unit:${CSV}`, `unit:${LIST}`],
    expect: 'byte-order mark',
    edits: [{ file: CSVW, find: "return BOM + lines.join('\\r\\n')", replace: "return lines.join('\\r\\n')" }],
  },

  // ---------------------------------------------------------------- fetchAll (A7)
  {
    name: 'fetchall-stops-at-a-short-page',
    breaks: [`unit:${PAGES}`],
    expect: 'reads to the last row when the server caps lower than asked',
    edits: [
      {
        file: FETCH,
        find: '    opts.onProgress?.(rows.length, total);\n',
        replace: '    opts.onProgress?.(rows.length, total);\n    if (got.length < pageSize) break;\n',
      },
    ],
  },
  {
    name: 'fetchall-steps-by-the-page-asked',
    breaks: [`unit:${PAGES}`],
    expect: 'reads to the last row when the server caps lower than asked',
    edits: [
      {
        file: FETCH,
        find: '  let total: number | null = null;\n',
        replace: '  let total: number | null = null;\n  let pages = 0;\n',
      },
      { file: FETCH, find: '    const from = rows.length;', replace: '    const from = pages++ * pageSize;' },
    ],
  },
  {
    name: 'fetchall-ignores-the-count',
    breaks: [`unit:${PAGES}`],
    expect: 'refuses a list that lost rows while it was read',
    edits: [
      {
        file: FETCH,
        find: '  if (total !== null && rows.length !== total)',
        replace: '  if (total !== null && false)',
      },
    ],
  },
  {
    name: 'fetchall-keeps-a-repeated-row',
    breaks: [`unit:${PAGES}`],
    expect: 'refuses a row read twice',
    edits: [{ file: FETCH, find: '        if (seen.has(k))', replace: '        if (seen.has(k) && false)' }],
  },
  {
    name: 'fetchall-swallows-a-failed-page',
    breaks: [`unit:${PAGES}`],
    expect: 'turns a failed page into the typed error',
    edits: [{ file: FETCH, find: 'if (res.error) throw toDbError(res.error);', replace: 'if (res.error) break;' }],
  },

  // ---------------------------------------------------------------- one cell: dates, numbers, IDs
  {
    name: 'export-dates-in-utc',
    breaks: [`unit:${FORMS}`],
    expect: 'writes a moment as its Riyadh day and wall clock',
    edits: [{ file: COLS, find: '  timeZone: TIME_ZONE,', replace: "  timeZone: 'UTC'," }],
  },
  {
    name: 'ids-become-numbers',
    breaks: [`unit:${FORMS}`],
    expect: 'keeps an ID exactly as stored',
    edits: [
      {
        file: COLS,
        find: 'A number is only taken while it is still exact.\n',
        replace:
          "A number is only taken while it is still exact.\n      if (/^\\d+$/.test(String(raw))) return { t: 'number', v: Number(raw) };\n",
      },
    ],
  },
  {
    name: 'numbers-print-exponents',
    breaks: [`unit:${FORMS}`],
    expect: 'never prints a number in exponent form',
    edits: [{ file: COLS, find: '  if (!m) return s;', replace: '  if (m || !m) return s;' }],
  },
  {
    name: 'columns-take-an-object',
    breaks: [`unit:${FORMS}`],
    expect: 'refuses a text column holding',
    edits: [
      {
        file: COLS,
        find: "      throw fail();\n    }\n    case 'id': {",
        replace: "      return { t: 'text', v: String(raw) };\n    }\n    case 'id': {",
      },
    ],
  },

  // ---------------------------------------------------------------- the workbook (V303)
  {
    name: 'xlsx-text-is-not-text',
    breaks: [`unit:${XLSX}`],
    expect: 'text-formatted ID cells',
    edits: [{ file: XLSXW, find: '  { numFmt: 49 }, // 2 text, IDs', replace: '  { numFmt: 0 }, // 2 text, IDs' }],
  },
  {
    name: 'xlsx-drops-the-quote-prefix',
    breaks: [`unit:${XLSX}`],
    expect: 'quote-prefixed where csvGuard would prefix it',
    edits: [
      {
        file: XLSXW,
        find: 'const s = csvGuard(cell.v) === cell.v ? S.text : S.guarded;',
        replace: 'const s = S.text;',
      },
    ],
  },
  {
    name: 'xlsx-dates-in-utc',
    breaks: [`unit:${XLSX}`],
    expect: 'Riyadh date cells',
    edits: [
      {
        file: XLSXW,
        find: 'Date.UTC(c.y, c.m - 1, c.d, c.h ?? 0,',
        replace: 'Date.UTC(c.y, c.m - 1, c.d, (c.h ?? 0) - 3,',
      },
    ],
  },
  {
    name: 'xlsx-decodes-a-literal-code',
    breaks: [`unit:${XLSX}`],
    expect: 'escapes what XML cannot hold and what Excel would decode',
    edits: [{ file: XLSXW, find: "      .replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1')\n", replace: '' }],
  },
  {
    name: 'xlsx-forgets-right-to-left',
    breaks: [`unit:${XLSX}`, `unit:${LIST}`],
    expect: 'right to left',
    edits: [{ file: XLSXW, find: `\${opts.rtl ? ' rightToLeft="1"' : ''}`, replace: '' }],
  },
  {
    name: 'xlsx-cuts-a-long-text',
    breaks: [`unit:${XLSX}`],
    expect: 'refuses a text longer than a cell holds',
    edits: [
      {
        file: XLSXW,
        find: 'if (cell.v.length > XLSX_TEXT_LIMIT) throw new XlsxCellTooLong(c.key, ri + 1);',
        replace: 'if (cell.v.length > XLSX_TEXT_LIMIT) cell.v = cell.v.slice(0, XLSX_TEXT_LIMIT);',
      },
    ],
  },
  {
    name: 'xlsx-miscounts-its-strings',
    breaks: [`unit:${XLSX}`],
    expect: 'shared string count is wrong',
    edits: [{ file: XLSXW, find: '    stringCells++;\n', replace: '' }],
  },
  {
    name: 'xlsx-writes-a-bare-ampersand',
    breaks: [`unit:${XLSX}`],
    expect: 'is not well-formed XML',
    edits: [{ file: XLSXW, find: "return s.replace(/&/g, '&amp;').", replace: 'return s.' }],
  },

  // ---------------------------------------------------------------- the whole export and its file name
  {
    name: 'export-reads-one-page',
    breaks: [`unit:${LIST}`],
    expect: 'writes every row of a 2,500-row list',
    edits: [
      {
        file: EXPORT,
        find: 'const rows = await fetchAll(input.page, {',
        replace: 'const rows = ((await input.page(0, 999)).data ?? []) || await fetchAll(input.page, {',
      },
    ],
  },
  {
    name: 'file-named-in-utc',
    breaks: [`unit:${LIST}`],
    expect: 'carries the list and the Riyadh time',
    edits: [
      {
        file: NAME,
        find: 'clockText(riyadhClock(at))',
        replace:
          'clockText({ y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate(), h: at.getUTCHours(), mi: at.getUTCMinutes(), s: at.getUTCSeconds() })',
      },
    ],
  },
  {
    name: 'file-name-keeps-a-slash',
    breaks: [`unit:${LIST}`],
    expect: 'drops what no system allows',
    edits: [{ file: NAME, find: ".replace(/[<>:\"/\\\\|?*\\u{0000}-\\u{001F}\\u{007F}]/gu, ' ')", replace: '' }],
  },

  // ---------------------------------------------------------------- the button
  {
    name: 'button-does-not-wait',
    breaks: [`unit:${BUTTON}`],
    expect: 'waits while it reads, and a second click starts nothing',
    edits: [
      { file: BTN, find: '    if (running.current) return;\n', replace: '' },
      { file: BTN, find: '        loading={busy}\n', replace: '' },
    ],
  },
  {
    name: 'button-says-done-on-a-failure',
    breaks: [`unit:${BUTTON}`],
    expect: 'says why when the list changed',
    edits: [
      {
        file: BTN,
        find: '      if (onError) onError(error);',
        replace: '      toast.done(labels.done(0));\n      if (onError) onError(error);',
      },
    ],
  },
  {
    name: 'button-names-no-reason',
    breaks: [`unit:${BUTTON}`],
    expect: 'says why when the list changed',
    edits: [
      {
        file: BTN,
        find: "    if (error.reason === 'changed' || error.reason === 'repeated') return labels.changed;\n",
        replace: '',
      },
    ],
  },
  {
    name: 'button-offers-one-format',
    breaks: [`unit:${BUTTON}`],
    expect: 'offers CSV and Excel from a menu',
    edits: [{ file: BTN, find: "formats: asked = ['csv', 'xlsx'],", replace: "formats: asked = ['csv']," }],
  },
  {
    name: 'moment-without-offset-read-as-local',
    breaks: [`unit:${ZONES}`],
    expect: "is refused, not read in the computer's zone",
    edits: [
      {
        file: COLS,
        find: "typeof v === 'string' && MOMENT.test(v)",
        replace: "typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}T/.test(v)",
      },
    ],
  },
  {
    name: 'file-name-in-the-computers-zone',
    breaks: [`unit:${ZONES}`],
    expect: 'named with the Riyadh clock in every zone',
    edits: [
      {
        file: NAME,
        find: 'clockText(riyadhClock(at))',
        replace:
          'clockText({ y: at.getFullYear(), m: at.getMonth() + 1, d: at.getDate(), h: at.getHours(), mi: at.getMinutes(), s: at.getSeconds() })',
      },
    ],
  },
  {
    name: 'export-writes-hidden-columns',
    breaks: [`unit:${ROLES}`],
    expect: "'s columns, in their order",
    edits: [
      {
        file: EXPORT,
        find: '  if (!visible) return { columns: [...columns], omitted: [] };',
        replace: '  return { columns: [...columns], omitted: [] };',
      },
    ],
  },
  {
    name: 'export-drops-a-visible-column-unseen',
    breaks: [`unit:${ROLES}`],
    expect: 'a visible column with no place in the file is refused',
    edits: [{ file: EXPORT, find: '    else throw new ExportColumnMissing(key);', replace: '    else continue;' }],
  },
  {
    name: 'button-hides-a-left-out-column',
    breaks: [`unit:${BUTTON}`],
    expect: 'the done toast names the column left out',
    edits: [
      {
        file: BTN,
        find: '      if (left) toast.done(',
        replace: '      if (left && false) toast.done(',
      },
    ],
  },
  {
    name: 'button-offers-an-empty-menu',
    breaks: [`unit:${BUTTON}`],
    expect: 'an empty formats list offers CSV',
    edits: [{ file: BTN, find: "asked.length ? asked : ['csv']", replace: 'asked' }],
  }, // ---------------------------------------------------------------- the old app's missed rows (round 13)
  {
    name: 'export-keeps-money-without-finance',
    breaks: [`unit:${OLD}`],
    expect: 'no money column',
    edits: [{ file: EXPORT, find: 'if (input.seesFinance) return planned;', replace: 'return planned;' }],
  },
  {
    name: 'export-names-no-money-column-left-out',
    breaks: [`unit:${OLD}`],
    expect: 'the money column is named, with its reason',
    edits: [
      {
        file: EXPORT,
        find: 'omitted: [...planned.omitted, ...money.map((c) => ({ key: c.key, reason: input.financeOnly }))],',
        replace: 'omitted: planned.omitted,',
      },
    ],
  },
  {
    name: 'export-writes-list-values-as-stored',
    breaks: [`unit:${OLD}`],
    expect: 'each status in the reader’s words',
    edits: [
      {
        file: COLS,
        find: 'const word = (v: string) => (column.words && Object.hasOwn(column.words, v) ? column.words[v]! : v);',
        replace: 'const word = (v: string) => v;',
      },
    ],
  },
  {
    name: 'export-button-shows-with-nothing-to-export',
    breaks: [`unit:${OLD}`],
    expect: 'no columns',
    edits: [{ file: BTN, find: '  if (nothing) return null;', replace: '' }],
  },
  // ---------------------------------------------------------------- V493: no profile photo in any export
  {
    name: 'export-writes-a-photo-column',
    breaks: [`unit:${PHOTO}`],
    expect: 'a photo column is refused (V493)',
    edits: [{ file: EXPORT, find: '  if (photo) throw new ExportPhotoRefused(photo.key);\n', replace: '' }],
  },
  {
    name: 'export-writes-a-picture',
    breaks: [`unit:${PHOTO}`],
    expect: 'a picture is refused (V493)',
    edits: [
      {
        file: COLS,
        find: "      if (typeof raw === 'string' && isPicture(raw)) throw new ExportPhotoRefused(column.key);\n",
        replace: '',
      },
    ],
  },
  {
    name: 'export-code-reads-a-photo',
    breaks: [`unit:${PHOTO}`],
    expect: 'no export code reads a photo (V493)',
    edits: [
      {
        file: CSVW,
        find: "import { csvGuard } from './csvGuard';\n",
        replace: "import { csvGuard } from './csvGuard';\n// the row's avatar_url\n",
      },
    ],
  },
];
