import JSZip from 'jszip';
import { cellOf, plainNumber, type Cell, type ExportColumn, type ExportKind } from './columns';
import { csvGuard } from './csvGuard';

/**
 * A list as an Excel workbook (spec §3.11 Export; V303) — written here, on JSZip, in the same parts and order as
 * ExcelJS writes them (shared strings, one style sheet, one sheet), without ExcelJS's 87 packages. One sheet: the
 * header row bold, frozen and filterable; the sheet right-to-left when the person works in Arabic.
 *
 * - Numbers are number cells; money shows two decimals; percent points show a "%" (87.5 stays 87.5, as in the CSV).
 * - Dates and moments are date cells holding the **Riyadh** calendar day and wall clock (D20): Excel has no time zone,
 *   so the cell is built from Riyadh's figures, never from the moment in UTC.
 * - Text and IDs are text cells in Text-formatted (`@`) columns: a workbook never evaluates a text cell, and an ID keeps
 *   its leading zeros. CP5: a text `csvGuard` would prefix is marked with Excel's own **quote prefix** — the apostrophe
 *   Excel stores when a person types one, invisible in the cell, and kept when the cell is edited — so it stays text
 *   even when edited, and reads exactly as stored.
 * - What a workbook cannot carry is refused or escaped, never changed silently: a text over Excel's 32,767 characters
 *   refuses the export (the CSV holds it); control characters are written as Excel's `_xHHHH_` escapes and a literal
 *   `_xHHHH_` is escaped in turn, so Excel shows both as typed.
 */
export const XLSX_TEXT_LIMIT = 32_767;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class XlsxCellTooLong extends Error {
  constructor(
    readonly column: string,
    readonly row: number,
  ) {
    super(`export: column "${column}", row ${row} holds more than ${XLSX_TEXT_LIMIT} characters — export CSV instead`);
    this.name = 'XlsxCellTooLong';
  }
}

/** Excel's sheet names: at most 31 characters, none of `[]:*?/\`, not starting or ending with an apostrophe. */
export function sheetName(name: string): string {
  const clean = name
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '');
  return Array.from(clean).slice(0, 31).join('').trim() || 'Export';
}

// ---------------------------------------------------------------- styles

/** Custom number formats (ids from 164, as Excel numbers them). */
const NUM_FMT = { percent: 164, date: 165, datetime: 166 } as const;
const NUM_FMT_CODE: Record<number, string> = { 164: '0.0"%"', 165: 'yyyy-mm-dd', 166: 'yyyy-mm-dd hh:mm:ss' };

/** The cell styles (`cellXfs`), by index. 49 is Excel's built-in Text (`@`), 4 its "#,##0.00". */
const XF = [
  { numFmt: 0 }, // 0 default (numbers, booleans)
  { numFmt: 49, bold: true }, // 1 header
  { numFmt: 49 }, // 2 text, IDs
  { numFmt: 49, quotePrefix: true }, // 3 a text csvGuard would prefix (CP5)
  { numFmt: 4 }, // 4 money
  { numFmt: NUM_FMT.percent }, // 5 percent points
  { numFmt: NUM_FMT.date }, // 6 date
  { numFmt: NUM_FMT.datetime }, // 7 date and time
] as const;
const S = { default: 0, header: 1, text: 2, guarded: 3, money: 4, percent: 5, date: 6, datetime: 7 } as const;

const COLUMN_STYLE: Record<ExportKind, number> = {
  text: S.text,
  id: S.text,
  number: S.default,
  money: S.money,
  percent: S.percent,
  date: S.date,
  datetime: S.datetime,
  boolean: S.default,
};

const WIDTH: Record<ExportKind, number> = {
  text: 28,
  id: 18,
  number: 12,
  money: 16,
  percent: 10,
  date: 12,
  datetime: 20,
  boolean: 9,
};

// ---------------------------------------------------------------- xml

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A text as Excel stores it: a literal `_xHHHH_` escaped first (`_x005F_` is "_"), then the characters XML 1.0 cannot
 * hold written as `_xHHHH_` — Excel reads both back as typed. A lone surrogate has no character to keep: it becomes
 * U+FFFD, as any UTF-8 writer makes it.
 */
export function excelText(s: string): string {
  return (
    s
      .replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1')
      .replace(
        /[\u{0000}-\u{0008}\u{000B}\u{000C}\u{000E}-\u{001F}\u{FFFE}\u{FFFF}]/gu,
        (c) => `_x${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}_`,
      )
      // With the u flag a well-formed pair is one astral character, so this range matches lone halves only.
      .replace(/[\u{D800}-\u{DFFF}]/gu, '\u{FFFD}')
  );
}

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Excel's serial day number (the 1900 system, days since 1899-12-30) of a Riyadh wall clock. */
function serial(c: { y: number; m: number; d: number; h?: number; mi?: number; s?: number }): number {
  const ms = Date.UTC(c.y, c.m - 1, c.d, c.h ?? 0, c.mi ?? 0, c.s ?? 0) - Date.UTC(1899, 11, 30);
  return Math.round((ms / 86_400_000) * 1e10) / 1e10;
}

function stylesXml(): string {
  const fmts = Object.entries(NUM_FMT_CODE)
    .map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${attr(code)}"/>`)
    .join('');
  const xfs = XF.map((x) => {
    const bold = 'bold' in x && x.bold;
    const quote = 'quotePrefix' in x && x.quotePrefix;
    return (
      `<xf numFmtId="${x.numFmt}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"` +
      (x.numFmt ? ' applyNumberFormat="1"' : '') +
      (bold ? ' applyFont="1"' : '') +
      (quote ? ' quotePrefix="1"' : '') +
      '/>'
    );
  }).join('');
  return (
    XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    `<numFmts count="${Object.keys(NUM_FMT_CODE).length}">${fmts}</numFmts>` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${XF.length}">${xfs}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
    '</styleSheet>'
  );
}

// ---------------------------------------------------------------- the workbook

export interface XlsxOptions {
  /** The list's name — the sheet's name. */
  sheet: string;
  /** Right-to-left sheet (the person works in Arabic). */
  rtl: boolean;
  /** The export time: the workbook's created and modified time, and every part's date in the zip. */
  at: Date;
}

export async function toXlsx<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  opts: XlsxOptions,
): Promise<Uint8Array> {
  const strings = new Map<string, number>();
  let stringCells = 0;
  const str = (s: string) => {
    stringCells++;
    let i = strings.get(s);
    if (i === undefined) {
      i = strings.size;
      strings.set(s, i);
    }
    return i;
  };

  const last = columnName(Math.max(columns.length, 1) - 1);
  const lastRow = rows.length + 1;
  const out: string[] = [];

  out.push(
    `<row r="1">${columns.map((c, i) => `<c r="${columnName(i)}1" s="${S.header}" t="s"><v>${str(c.header)}</v></c>`).join('')}</row>`,
  );
  rows.forEach((row, ri) => {
    const r = ri + 2;
    let cells = '';
    columns.forEach((c, ci) => {
      const cell: Cell = cellOf(c, c.value(row));
      const ref = `${columnName(ci)}${r}`;
      switch (cell.t) {
        case 'empty':
          return;
        case 'text': {
          if (cell.v.length > XLSX_TEXT_LIMIT) throw new XlsxCellTooLong(c.key, ri + 1);
          const s = csvGuard(cell.v) === cell.v ? S.text : S.guarded;
          cells += `<c r="${ref}" s="${s}" t="s"><v>${str(cell.v)}</v></c>`;
          return;
        }
        case 'number':
          cells += `<c r="${ref}" s="${COLUMN_STYLE[c.kind]}"><v>${plainNumber(cell.v)}</v></c>`;
          return;
        case 'date':
          cells += `<c r="${ref}" s="${S.date}"><v>${serial(cell)}</v></c>`;
          return;
        case 'datetime':
          cells += `<c r="${ref}" s="${S.datetime}"><v>${plainNumber(serial(cell))}</v></c>`;
          return;
        case 'bool':
          cells += `<c r="${ref}" t="b"><v>${cell.v ? 1 : 0}</v></c>`;
          return;
      }
    });
    out.push(`<row r="${r}">${cells}</row>`);
  });

  const range = `A1:${last}${lastRow}`;
  const cols = columns.length
    ? `<cols>${columns
        .map(
          (c, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? WIDTH[c.kind]}" style="${COLUMN_STYLE[c.kind]}" customWidth="1"/>`,
        )
        .join('')}</cols>`
    : '';
  const sheet =
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${columns.length ? range : 'A1'}"/>` +
    `<sheetViews><sheetView workbookViewId="0" tabSelected="1"${opts.rtl ? ' rightToLeft="1"' : ''}>` +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${out.join('')}</sheetData>` +
    (columns.length ? `<autoFilter ref="${range}"/>` : '') +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>';

  const name = sheetName(opts.sheet);
  const filterName = columns.length
    ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">` +
      `${attr(`'${name.replace(/'/g, "''")}'!$A$1:$${last}$${lastRow}`)}</definedName></definedNames>`
    : '';
  const workbook =
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><workbookPr/>` +
    `<sheets><sheet name="${attr(name)}" sheetId="1" r:id="rId1"/></sheets>` +
    filterName +
    '<calcPr calcId="171027"/></workbook>';

  const shared =
    XML_HEAD +
    `<sst xmlns="${NS_MAIN}" count="${stringCells}" uniqueCount="${strings.size}">` +
    Array.from(strings.keys(), (s) => `<si><t xml:space="preserve">${attr(excelText(s))}</t></si>`).join('') +
    '</sst>';

  const stamp = opts.at.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const core =
    XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${attr(excelText(name))}</dc:title>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>` +
    '</cp:coreProperties>';

  const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  const parts: [string, string][] = [
    [
      '[Content_Types].xml',
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        `<Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${ct}.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="${ct}.styles+xml"/>` +
        `<Override PartName="/xl/sharedStrings.xml" ContentType="${ct}.sharedStrings+xml"/>` +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>',
    ],
    ['docProps/core.xml', core],
    ['xl/workbook.xml', workbook],
    [
      'xl/_rels/workbook.xml.rels',
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId3" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
        '</Relationships>',
    ],
    ['xl/styles.xml', stylesXml()],
    ['xl/sharedStrings.xml', shared],
    ['xl/worksheets/sheet1.xml', sheet],
  ];

  const zip = new JSZip();
  for (const [path, body] of parts) zip.file(path, body, { date: opts.at, createFolders: false });
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: XLSX_MIME,
  });
}
