import JSZip from 'jszip';

/**
 * Reads back a workbook the way Excel does, for the tests — run under jsdom for its XML parser, which also refuses
 * a part that is not well-formed (Excel's "We found a problem with some content"). Shared strings are decoded with
 * Excel's `_xHHHH_` rule; a cell reports its number format, quote prefix and bold from the style sheet.
 */
export interface ReadCell {
  ref: string;
  type: 's' | 'n' | 'b';
  value: string | number | boolean;
  numFmt: string;
  quotePrefix: boolean;
  bold: boolean;
  formula: boolean;
}

export interface ReadBook {
  parts: string[];
  sheetName: string;
  rtl: boolean;
  frozenRows: number;
  autoFilter: string | null;
  filterDatabase: string | null;
  widths: number[];
  created: string | null;
  /** Rows by their number (1-based); a row holds its cells by column letter. */
  rows: Map<number, Map<string, ReadCell>>;
}

const BUILTIN: Record<number, string> = { 0: 'General', 4: '#,##0.00', 49: '@' };

function parse(xml: string, part: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) throw new Error(`${part} is not well-formed XML: ${error.textContent}`);
  return doc;
}

/** Excel's reading of `_xHHHH_`: left to right, `_x005F_` being "_". */
export function unexcel(s: string): string {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** An Excel serial day number as the ISO time of its wall clock. */
export function fromSerial(n: number): string {
  return new Date(Math.round(n * 86_400_000) + Date.UTC(1899, 11, 30)).toISOString();
}

export async function readXlsx(bytes: Uint8Array): Promise<ReadBook> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files);
  const text = async (p: string) => {
    const f = zip.file(p);
    if (!f) throw new Error(`the workbook has no ${p}`);
    return parse(await f.async('string'), p);
  };
  const [types, workbook, sheet, styles, shared, core] = await Promise.all([
    text('[Content_Types].xml'),
    text('xl/workbook.xml'),
    text('xl/worksheets/sheet1.xml'),
    text('xl/styles.xml'),
    text('xl/sharedStrings.xml'),
    text('docProps/core.xml'),
  ]);
  if (!types.documentElement.getAttribute('xmlns')) throw new Error('content types without a namespace');

  const strings = Array.from(shared.getElementsByTagName('si'), (si) => unexcel(si.textContent ?? ''));
  const sst = shared.documentElement;
  if (Number(sst.getAttribute('uniqueCount')) !== strings.length) throw new Error('uniqueCount is wrong');

  const formats = new Map<number, string>(Object.entries(BUILTIN).map(([k, v]) => [Number(k), v]));
  for (const f of Array.from(styles.getElementsByTagName('numFmt')))
    formats.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode')!);
  const fonts = Array.from(styles.getElementsByTagName('fonts')[0]!.getElementsByTagName('font'), (f) =>
    Boolean(f.getElementsByTagName('b').length),
  );
  const xfs = Array.from(styles.getElementsByTagName('cellXfs')[0]!.getElementsByTagName('xf'), (xf) => ({
    numFmt: formats.get(Number(xf.getAttribute('numFmtId'))) ?? `?${xf.getAttribute('numFmtId')}`,
    quotePrefix: xf.getAttribute('quotePrefix') === '1',
    bold: fonts[Number(xf.getAttribute('fontId'))] ?? false,
  }));
  if (Number(styles.getElementsByTagName('cellXfs')[0]!.getAttribute('count')) !== xfs.length)
    throw new Error('cellXfs count is wrong');

  let stringCells = 0;
  const rows = new Map<number, Map<string, ReadCell>>();
  let lastRow = 0;
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r'));
    if (!(r > lastRow)) throw new Error(`row ${r} out of order`);
    lastRow = r;
    const cells = new Map<string, ReadCell>();
    let lastCol = '';
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r')!;
      const m = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!m || Number(m[2]) !== r) throw new Error(`cell ${ref} is not in row ${r}`);
      const col = m[1]!;
      if (lastCol && (col.length < lastCol.length || (col.length === lastCol.length && col <= lastCol)))
        throw new Error(`cell ${ref} out of order`);
      lastCol = col;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const style = xfs[Number(c.getAttribute('s') ?? 0)];
      if (!style) throw new Error(`cell ${ref} has no style ${c.getAttribute('s')}`);
      const type = t === 's' ? 's' : t === 'b' ? 'b' : t === null ? 'n' : null;
      if (!type) throw new Error(`cell ${ref} has type ${t}`);
      if (type === 's') stringCells++;
      cells.set(col, {
        ref,
        type,
        value: type === 's' ? strings[Number(v)]! : type === 'b' ? v === '1' : Number(v),
        ...style,
        formula: c.getElementsByTagName('f').length > 0,
      });
    }
    rows.set(r, cells);
  }
  if (Number(sst.getAttribute('count')) !== stringCells) throw new Error('shared string count is wrong');

  const view = sheet.getElementsByTagName('sheetView')[0]!;
  const pane = sheet.getElementsByTagName('pane')[0];
  return {
    parts,
    sheetName: workbook.getElementsByTagName('sheet')[0]!.getAttribute('name')!,
    rtl: view.getAttribute('rightToLeft') === '1',
    frozenRows: pane?.getAttribute('state') === 'frozen' ? Number(pane.getAttribute('ySplit')) : 0,
    autoFilter: sheet.getElementsByTagName('autoFilter')[0]?.getAttribute('ref') ?? null,
    filterDatabase: workbook.getElementsByTagName('definedName')[0]?.textContent ?? null,
    widths: Array.from(sheet.getElementsByTagName('col'), (c) => Number(c.getAttribute('width'))),
    created: core.getElementsByTagName('dcterms:created')[0]?.textContent ?? null,
    rows,
  };
}

/** Blob bytes under jsdom (its Blob has no `arrayBuffer`) and under Node alike. */
export function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
