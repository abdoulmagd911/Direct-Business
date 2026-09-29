import PptxGenJS from 'pptxgenjs';
import { PPTX_FONT } from '../../fonts';
import type { DocPalette } from '../../palette';
import {
  calendarDay,
  cellText,
  checkPrintable,
  change,
  figureParts,
  figureText,
  longDate,
  numberOf,
  periodLabel,
  reportTitle,
  textOf,
} from '../format';
import {
  printedIn,
  pick,
  type Column,
  type Lang,
  type LineGroup,
  type ReportDoc,
  type Section,
  type Status,
  type Tile,
} from '../model';
import { word } from '../words';
import { openPptx, writePptx } from './zip';

/**
 * A report as a PowerPoint deck (V301), from the same model as the PDF and in the same 16:9 layout (V34): native,
 * editable text, not pictures of pages. PowerPoint shapes Arabic itself; what the file must say is each paragraph's
 * direction (`rtl="1"`), its language (`ar-SA`) and the complex-script font — pptxgenjs writes all three from
 * `rtlMode` and `lang` — while tables and tiles are mirrored here, since PowerPoint does not mirror a table's columns.
 * The department's own template, when the owner supplies one, is filled through `template.ts` instead (V34).
 */

export interface PptxOptions {
  palette: DocPalette;
  /** The white logo for the slate cover as a PNG data URL (PowerPoint needs a PNG beside any SVG), or null. */
  logoPng: string | null;
  /** The logo's width ÷ height. */
  logoAspect: number;
}

const W = 13.333; // inches, 16:9 — the PDF's 960 × 540 pt
const H = 7.5;
const pt = (v: number) => v / 72;
/** Cell margins in points: top, end, bottom, start as PowerPoint takes them (top, right, bottom, left). */
type Margin4 = [number, number, number, number];
const M = pt(40);
const CONTENT_TOP = pt(96);
const CONTENT_BOTTOM = H - pt(60);
const CONTENT_W = W - 2 * M;

type Align = 'left' | 'right' | 'center';

interface Dir {
  rtl: boolean;
  lang: 'ar-SA' | 'en-GB';
  start: Align;
  end: Align;
  /** The x of a box of width `w` placed at `x` from the reading start. */
  x: (x: number, w: number) => number;
}

function dir(lang: Lang): Dir {
  const rtl = lang === 'ar';
  return {
    rtl,
    lang: rtl ? 'ar-SA' : 'en-GB',
    start: rtl ? 'right' : 'left', // check-allow: no-physical-css — PowerPoint aligns by side; mapped once here
    end: rtl ? 'left' : 'right', // check-allow: no-physical-css — PowerPoint aligns by side; mapped once here
    x: (x, w) => (rtl ? W - x - w : x),
  };
}

/** PowerPoint colours are six hex digits without "#"; the palette's values are tokens.css values. */
function hex(value: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) throw new Error(`pptx: colour "${value}" is not #rrggbb`);
  return (m[1] as string).toUpperCase();
}

// ------------------------------------------------------------------------------------------------ pagination

type PageOf =
  | { kind: 'tiles'; section: Extract<Section, { kind: 'tiles' }>; tiles: Tile[]; first: boolean }
  | { kind: 'lines'; section: Extract<Section, { kind: 'lines' }>; groups: LineGroup[] }
  | { kind: 'table'; section: Extract<Section, { kind: 'table' }>; rows: Extract<Section, { kind: 'table' }>['rows'] };

const TILES_PER_SLIDE = 10;
const ROWS_PER_SLIDE = 10;
/** Points one printed line of a bullet needs, and how many characters fit on one line at 11 pt. */
const LINE_PT = 22;
const CHARS_PER_LINE = { ar: 150, en: 140 } as const;

function paginate(section: Section, lang: Lang): PageOf[] {
  switch (section.kind) {
    case 'tiles': {
      const pages: PageOf[] = [];
      for (let i = 0; i < Math.max(section.tiles.length, 1); i += TILES_PER_SLIDE)
        pages.push({ kind: 'tiles', section, tiles: section.tiles.slice(i, i + TILES_PER_SLIDE), first: i === 0 });
      return pages;
    }
    case 'table': {
      const pages: PageOf[] = [];
      for (let i = 0; i < Math.max(section.rows.length, 1); i += ROWS_PER_SLIDE)
        pages.push({ kind: 'table', section, rows: section.rows.slice(i, i + ROWS_PER_SLIDE) });
      return pages;
    }
    case 'lines': {
      const room = (CONTENT_BOTTOM - CONTENT_TOP) * 72;
      const pages: PageOf[] = [];
      let groups: LineGroup[] = [];
      let used = 0;
      for (const g of section.groups) {
        let current: LineGroup = { title: g.title, lines: [] };
        let need = g.title ? 32 : 0;
        for (const line of g.lines) {
          const h = LINE_PT * Math.max(1, Math.ceil(pick(line.text, lang).length / CHARS_PER_LINE[lang])) + 6;
          if (used + need + h > room && (groups.length || current.lines.length)) {
            if (current.lines.length) groups.push(current);
            pages.push({ kind: 'lines', section, groups });
            groups = [];
            used = 0;
            current = { title: g.title, lines: [] };
            need = g.title ? 32 : 0;
          }
          current.lines.push(line);
          need += h;
        }
        groups.push(current);
        used += need + 14;
      }
      // A section with nothing in it still gets its slide, as it gets its page in the PDF: an empty section shows.
      if (groups.length || !pages.length) pages.push({ kind: 'lines', section, groups });
      return pages;
    }
  }
}

// ------------------------------------------------------------------------------------------------ the deck

export async function reportPptx(doc: ReportDoc, lang: Lang, opts: PptxOptions): Promise<Uint8Array> {
  checkPrintable(doc);
  const d = dir(lang);
  const p = opts.palette;
  const title = reportTitle(doc, lang);
  const period = periodLabel(doc, lang);
  const department = textOf(doc.department, lang);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `${title} — ${period}`;
  const number = numberOf(doc) ?? word('draft', lang);
  pptx.subject = number;
  pptx.author = department;
  pptx.company = department;
  pptx.rtlMode = d.rtl;

  const text = (extra: PptxGenJS.TextPropsOptions = {}): PptxGenJS.TextPropsOptions => ({
    fontFace: PPTX_FONT.body,
    color: hex(p.text),
    align: d.start,
    valign: 'top',
    margin: 0,
    rtlMode: d.rtl,
    lang: d.lang,
    ...extra,
  });

  // Cover.
  const cover = pptx.addSlide();
  cover.background = { color: hex(p['nav-bg']) };
  if (opts.logoPng) {
    const h = pt(40);
    const w = h * opts.logoAspect;
    cover.addImage({ data: opts.logoPng, x: d.x(pt(56), w), y: pt(56), w, h, altText: 'Direct' });
  }
  cover.addShape('rect', {
    x: d.x(pt(56), pt(56)),
    y: pt(196),
    w: pt(56),
    h: pt(4),
    fill: { color: hex(p.accent) },
    line: { type: 'none' },
  });
  const coverW = W - 2 * pt(56);
  cover.addText(
    title,
    text({
      x: pt(56),
      y: pt(214),
      w: coverW,
      h: pt(56),
      fontFace: PPTX_FONT.heading,
      fontSize: 44,
      bold: true,
      color: hex(p['on-primary']),
    }),
  );
  cover.addText(
    period,
    text({
      x: pt(56),
      y: pt(274),
      w: coverW,
      h: pt(42),
      fontFace: PPTX_FONT.heading,
      fontSize: 30,
      bold: true,
      color: hex(p['on-primary']),
    }),
  );
  cover.addText(
    department,
    text({ x: pt(56), y: pt(334), w: coverW, h: pt(24), fontSize: 16, color: hex(p['nav-muted']) }),
  );
  const meta = { y: H - pt(56) - pt(16), h: pt(16), fontSize: 11, color: hex(p['nav-muted']) };
  cover.addText(number, text({ ...meta, x: d.x(pt(56), coverW / 2), w: coverW / 2, fontFace: PPTX_FONT.mono }));
  if (doc.issuedOn)
    cover.addText(
      word('issued_on', lang, { date: longDate(doc.issuedOn, lang) }),
      text({ ...meta, x: d.x(pt(56) + coverW / 2, coverW / 2), w: coverW / 2, align: d.end }),
    );

  // Section slides, paginated, then numbered once the total is known.
  const pages = doc.sections.flatMap((s) => paginate(s, lang));
  const total = pages.length + 1;
  pages.forEach((page, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: hex(p.raised) };
    // Header: the section's title at the reading start with the accent mark under it; the report at the end.
    slide.addText(
      textOf(page.section.title, lang),
      text({
        x: d.x(M, CONTENT_W * 0.7),
        y: pt(30),
        w: CONTENT_W * 0.7,
        h: pt(30),
        fontFace: PPTX_FONT.heading,
        fontSize: 22,
        bold: true,
      }),
    );
    slide.addShape('rect', {
      x: d.x(M, pt(28)),
      y: pt(66),
      w: pt(28),
      h: pt(3),
      fill: { color: hex(p.accent) },
      line: { type: 'none' },
    });
    slide.addText(
      `${title} · ${period}`,
      text({
        x: d.x(M + CONTENT_W * 0.7, CONTENT_W * 0.3),
        y: pt(38),
        w: CONTENT_W * 0.3,
        h: pt(14),
        fontSize: 10,
        color: hex(p.muted),
        align: d.end,
      }),
    );
    // Footer.
    slide.addShape('line', { x: M, y: H - pt(30), w: CONTENT_W, h: 0, line: { color: hex(p.border), width: 0.75 } });
    slide.addText(
      `${number} · ${department}`,
      text({ x: d.x(M, CONTENT_W / 2), y: H - pt(24), w: CONTENT_W / 2, h: pt(12), fontSize: 9, color: hex(p.muted) }),
    );
    slide.addText(
      word('page_of', lang, { n: i + 2, m: total }),
      text({
        x: d.x(M + CONTENT_W / 2, CONTENT_W / 2),
        y: H - pt(24),
        w: CONTENT_W / 2,
        h: pt(12),
        fontSize: 9,
        color: hex(p.muted),
        align: d.end,
      }),
    );

    if (page.kind === 'tiles') addTiles(slide, page, lang, d, p, text);
    if (page.kind === 'lines') addLines(slide, page.groups, lang, d, p);
    if (page.kind === 'table') addTable(slide, page.section.columns, page.rows, lang, d, p);
  });

  const bytes = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
  return writePptx(await openPptx(bytes), calendarDay(doc.issuedOn ?? doc.period.end), { rtl: d.rtl });
}

// ------------------------------------------------------------------------------------------------ parts

function addTiles(
  slide: PptxGenJS.Slide,
  page: Extract<PageOf, { kind: 'tiles' }>,
  lang: Lang,
  d: Dir,
  p: DocPalette,
  text: (extra?: PptxGenJS.TextPropsOptions) => PptxGenJS.TextPropsOptions,
) {
  const s = page.section;
  slide.addText(
    `${textOf(s.currentLabel, lang)} · ${word('vs', lang, { label: textOf(s.previousLabel, lang) })}`,
    text({ x: M, y: CONTENT_TOP, w: CONTENT_W, h: pt(14), fontSize: 11, color: hex(p.muted) }),
  );
  const perRow = page.tiles.length <= 4 ? Math.max(page.tiles.length, 1) : 5;
  const gap = pt(12);
  const tw = (CONTENT_W - gap * (perRow - 1)) / perRow;
  const th = pt(152);
  page.tiles.forEach((tile, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = d.x(M + col * (tw + gap), tw);
    const y = CONTENT_TOP + pt(28) + row * (th + gap);
    slide.addShape('roundRect', {
      x,
      y,
      w: tw,
      h: th,
      rectRadius: 0.06,
      fill: { color: hex(p.surface) },
      line: { color: hex(p.border), width: 0.75 },
    });
    const inner = { x: x + pt(14), w: tw - pt(28) };
    slide.addText(
      textOf(tile.label, lang),
      text({ ...inner, y: y + pt(14), h: pt(30), fontSize: 10.5, color: hex(p.muted) }),
    );
    const now = figureParts(tile.current, lang);
    slide.addText(
      [
        // The paragraph keeps the language's direction; the figure itself reads left to right by the bidi rules.
        {
          text: now.number,
          options: {
            fontFace: PPTX_FONT.heading,
            fontSize: 26,
            bold: true,
            color: hex(p.text),
            rtlMode: d.rtl,
            lang: 'en-GB',
          },
        },
        ...(now.unit ? [{ text: ` ${now.unit}`, options: { fontSize: 10, color: hex(p.muted), lang: d.lang } }] : []),
      ],
      text({ ...inner, y: y + pt(58), h: pt(34) }),
    );
    if (tile.previous) {
      const vw = tw * 0.55;
      const vx = d.rtl ? x + tw - pt(14) - vw : x + pt(14);
      slide.addText(
        word('vs', lang, { label: figureText(tile.previous, lang) }),
        text({ x: vx, w: vw, y: y + th - pt(28), h: pt(14), fontSize: 9.5, color: hex(p.muted) }),
      );
    }
    const delta = change(tile.current, tile.previous, lang);
    if (delta) {
      const better = tile.better ?? 'up';
      const good = better === 'up' ? delta.percent > 0 : delta.percent < 0;
      const bad = better === 'up' ? delta.percent < 0 : delta.percent > 0;
      const cw = pt(58);
      const cx = d.rtl ? x + pt(14) : x + tw - pt(14) - cw;
      // Every Arabic text box reads right to left (oversight, 29 Sep); the left-to-right mark keeps "+18.5%" in order.
      slide.addText(d.rtl ? `\u{200E}${delta.text}` : delta.text, {
        x: cx,
        y: y + th - pt(30),
        w: cw,
        h: pt(16),
        shape: 'roundRect',
        rectRadius: 0.1,
        fill: { color: hex(good ? p['success-soft'] : bad ? p['danger-soft'] : p.bg) },
        color: hex(good ? p.success : bad ? p.danger : p.muted),
        fontFace: PPTX_FONT.body,
        fontSize: 9,
        bold: true,
        align: 'center',
        valign: 'middle',
        margin: 0,
        rtlMode: d.rtl,
        // A points chip holds a word («نقطة»): it is Arabic text in the Arabic deck.
        lang: delta.unit ? d.lang : 'en-GB',
      });
    }
  });
}

function addLines(slide: PptxGenJS.Slide, groups: LineGroup[], lang: Lang, d: Dir, p: DocPalette) {
  // pptxgenjs writes `rtlMode` for table text too, though its types list it only for text boxes.
  const props = (o: Record<string, unknown>) => o as PptxGenJS.TableCellProps;
  const cell = (t: string, extra: Record<string, unknown> = {}): PptxGenJS.TableCell => ({
    text: t,
    options: props({
      fontFace: PPTX_FONT.body,
      fontSize: 11,
      color: hex(p.text),
      align: d.start,
      valign: 'top',
      rtlMode: d.rtl,
      lang: d.lang,
      ...extra,
    }),
  });
  const amountW = pt(150);
  const rows: PptxGenJS.TableRow[] = [];
  for (const g of groups) {
    if (g.title)
      rows.push([cell(textOf(g.title, lang), { bold: true, fontSize: 13, colspan: 2, margin: [pt(10), 0, pt(4), 0] })]);
    for (const line of g.lines) {
      // A line printed in the other language is a paragraph of that language (V403).
      const shown = printedIn(line.text, lang);
      const main = cell(`•  ${textOf(line.text, lang)}`, {
        margin: [pt(2), 0, pt(4), 0],
        rtlMode: shown === 'ar',
        lang: shown === 'ar' ? 'ar-SA' : 'en-GB',
      });
      const amount: PptxGenJS.TableCell = line.amount
        ? {
            text: [
              {
                text: figureText({ kind: 'number', value: line.amount.value, unit: line.amount.unit }, lang),
                options: props({
                  fontFace: PPTX_FONT.mono,
                  fontSize: 10.5,
                  color: hex(p.text),
                  breakLine: !!line.amount.label,
                  rtlMode: d.rtl,
                  lang: d.lang,
                  align: d.end,
                }),
              },
              ...(line.amount.label
                ? [
                    {
                      text: textOf(line.amount.label, lang),
                      options: props({
                        fontFace: PPTX_FONT.body,
                        fontSize: 8.5,
                        color: hex(p.muted),
                        rtlMode: d.rtl,
                        lang: d.lang,
                        align: d.end,
                      }),
                    },
                  ]
                : []),
            ],
            options: props({ align: d.end, valign: 'top', rtlMode: d.rtl, lang: d.lang, margin: [pt(2), 0, pt(4), 0] }),
          }
        : cell('');
      rows.push(d.rtl ? [amount, main] : [main, amount]);
    }
  }
  if (!rows.length) return;
  slide.addTable(rows, {
    x: M,
    y: CONTENT_TOP,
    w: CONTENT_W,
    colW: d.rtl ? [amountW, CONTENT_W - amountW] : [CONTENT_W - amountW, amountW],
    border: { type: 'none' },
    autoPage: false,
  });
}

const STATUS_TONE: Record<Status, 'success' | 'warning' | 'danger' | 'muted'> = {
  on_track: 'success',
  done: 'success',
  at_risk: 'warning',
  behind: 'danger',
  not_measured: 'muted',
  carried_over: 'muted',
};

function addTable(
  slide: PptxGenJS.Slide,
  columns: Column[],
  rows: Extract<Section, { kind: 'table' }>['rows'],
  lang: Lang,
  d: Dir,
  p: DocPalette,
) {
  const order = d.rtl ? [...columns.keys()].reverse() : [...columns.keys()];
  const align = (c: Column) => (c.kind === 'number' ? d.end : d.start);
  const base = (c: Column) => ({
    fontFace: c.kind === 'id' || c.kind === 'number' ? PPTX_FONT.mono : PPTX_FONT.body,
    fontSize: 10.5,
    color: hex(p.text),
    align: align(c),
    valign: 'middle' as const,
    rtlMode: d.rtl,
    lang: d.lang,
    margin: [0, pt(8), 0, pt(8)] as Margin4,
  });
  const header: PptxGenJS.TableRow = order.map((i) => {
    const c = columns[i] as Column;
    return {
      text: textOf(c.title, lang),
      options: {
        ...base(c),
        fontFace: PPTX_FONT.body,
        fontSize: 9.5,
        bold: true,
        color: hex(p.muted),
        fill: { color: hex(p.surface) },
      } as unknown as PptxGenJS.TableCellProps,
    };
  });
  const body: PptxGenJS.TableRow[] = rows.map((row) =>
    order.map((i) => {
      const c = columns[i] as Column;
      const value = row[i] ?? null;
      const status = value && typeof value === 'object' && 'status' in value ? value.status : null;
      const tone = status ? STATUS_TONE[status] : null;
      return {
        text: cellText(value, c, lang),
        options: {
          ...base(c),
          ...(tone ? { bold: true, fontSize: 9, color: hex(tone === 'muted' ? p.muted : p[tone]) } : {}),
        } as unknown as PptxGenJS.TableCellProps,
      };
    }),
  );
  slide.addTable([header, ...body], {
    x: M,
    y: CONTENT_TOP,
    w: CONTENT_W,
    colW: order.map((i) => (columns[i] as Column).width * CONTENT_W),
    rowH: pt(32),
    border: { type: 'solid', pt: 0.5, color: hex(p.border) },
    autoPage: false,
  });
}
