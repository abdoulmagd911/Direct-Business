import { Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { createContext, useContext, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { FONT } from '../../fonts';
import type { LogoPaths } from '../../logo';
import type { DocPalette } from '../../palette';
import {
  calendarDay,
  cellText,
  checkPrintable,
  change,
  figureParts,
  longDate,
  numberOf,
  periodLabel,
  reportTitle,
  textOf,
} from '../format';
import {
  printedIn,
  type Cell,
  type Column,
  type Lang,
  type LineGroup,
  type ReportDoc,
  type Section,
  type Status,
  type Tile,
} from '../model';
import { word } from '../words';
import { direction, type Direction } from './direction';

/**
 * A report as a PDF (V301): react-pdf, in the browser, from the report model — the same model the PPTX is made
 * from. Pages are 16:9 like the department's issued reports (V34): a cover, then one page (or more, when the content
 * flows over) per section, each with the section's title at the reading start and "Page n of m" in the footer.
 *
 * Arabic: textkit 7 runs the Unicode bidi algorithm (bidi-js) and fontkit shapes the letters, so Arabic joins and
 * reads right to left, and English names, IDs and Latin digits inside it keep their own order — checked against
 * Chrome's own rendering of the same lines and held by the golden test.
 */

/** 16:9 in points (13.333 × 7.5 in), the size of the department's slides. */
export const PAGE = { width: 960, height: 540 } as const;
const MARGIN = 40;

interface Ctx {
  lang: Lang;
  d: Direction;
  p: DocPalette;
}
const DocCtx = createContext<Ctx | null>(null);
function useDoc(): Ctx {
  const c = useContext(DocCtx);
  if (!c) throw new Error('ReportPdf parts render inside <ReportPdf>');
  return c;
}

const s = StyleSheet.create({
  page: { paddingTop: 96, paddingBottom: 60, paddingHorizontal: MARGIN, fontSize: 11 },
  header: { position: 'absolute', top: 30, alignItems: 'flex-start', justifyContent: 'space-between' },
  footer: { position: 'absolute', bottom: 22, paddingTop: 8, justifyContent: 'space-between', fontSize: 9 },
  mark: { width: 28, height: 3, marginTop: 6 },
});

/** react-pdf's style object (its types package is not a direct dependency). */
type Style = Parameters<typeof StyleSheet.create>[0][string];

/** Text in the document's direction: react-pdf does not inherit `direction`, so every run states it. */
function T({ style, children }: { style?: Style | Style[]; children?: ReactNode }) {
  const { d } = useDoc();
  const own = Array.isArray(style) ? style : style ? [style] : [];
  return <Text style={[{ direction: d.text, textAlign: d.alignStart }, ...own]}>{children}</Text>;
}

export interface ReportPdfProps {
  doc: ReportDoc;
  lang: Lang;
  palette: DocPalette;
  /** The white logo for the slate cover (`public/brand/direct-logo-on-dark.svg`), or null to leave it out. */
  logo: LogoPaths | null;
}

/**
 * The report as the element react-pdf renders (`pdf(…).toBlob()` in the browser, `renderToBuffer` in Node). Its root
 * is the `<Document>`, wrapped in the context the parts read — react-pdf's types want a bare Document, hence the cast.
 */
export function reportPdfElement(props: ReportPdfProps): ReactElement<ComponentProps<typeof Document>> {
  checkPrintable(props.doc);
  return (<ReportPdf {...props} />) as unknown as ReactElement<ComponentProps<typeof Document>>;
}

export function ReportPdf({ doc, lang, palette, logo }: ReportPdfProps) {
  const ctx: Ctx = { lang, d: direction(lang), p: palette };
  const title = reportTitle(doc, lang);
  const period = periodLabel(doc, lang);
  // The same snapshot always makes the same file (P6-2: "two renderings of the same snapshot are identical"), so
  // the PDF's own dates are the report's, never the moment of download.
  const stamp = calendarDay(doc.issuedOn ?? doc.period.end);
  return (
    <DocCtx.Provider value={ctx}>
      <Document
        title={`${title} — ${period}`}
        author={textOf(doc.department, lang)}
        subject={numberOf(doc) ?? word('draft', lang)}
        creator="Commercial Workspace"
        producer="Commercial Workspace"
        language={lang === 'ar' ? 'ar-SA' : 'en-GB'}
        creationDate={stamp}
        modificationDate={stamp}
      >
        <Cover doc={doc} title={title} period={period} logo={logo} />
        {doc.sections.map((section) => (
          <SectionPage key={section.key} doc={doc} section={section} title={title} period={period} />
        ))}
      </Document>
    </DocCtx.Provider>
  );
}

// ------------------------------------------------------------------------------------------------------ cover

function Cover({
  doc,
  title,
  period,
  logo,
}: {
  doc: ReportDoc;
  title: string;
  period: string;
  logo: LogoPaths | null;
}) {
  const { lang, d, p } = useDoc();
  return (
    <Page
      size={[PAGE.width, PAGE.height]}
      style={{ backgroundColor: p['nav-bg'], padding: 56, fontFamily: FONT.body, color: p['nav-text'] }}
    >
      <View style={{ flexDirection: d.row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {logo ? <Logo logo={logo} height={40} /> : <View />}
        {doc.status === 'draft' ? (
          <Chip text={word('draft', lang)} fg={p['nav-bg']} bg={p['nav-text']} dir={d.text} />
        ) : null}
      </View>
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: d.row }}>
          <View style={{ width: 56, height: 4, backgroundColor: p.accent, marginBottom: 20 }} />
        </View>
        <T style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 44, color: p['on-primary'] }}>{title}</T>
        <T style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 30, color: p['on-primary'], marginTop: 6 }}>
          {period}
        </T>
        <T style={{ fontSize: 16, color: p['nav-muted'], marginTop: 18 }}>{textOf(doc.department, lang)}</T>
      </View>
      <View style={{ flexDirection: d.row, justifyContent: 'space-between', fontSize: 11, color: p['nav-muted'] }}>
        <T style={{ fontFamily: FONT.mono }}>{numberOf(doc) ?? ''}</T>
        <T>{doc.issuedOn ? word('issued_on', lang, { date: longDate(doc.issuedOn, lang) }) : ''}</T>
      </View>
    </Page>
  );
}

function Logo({ logo, height }: { logo: LogoPaths; height: number }) {
  const { x, y, width, height: h } = logo.viewBox;
  return (
    <Svg viewBox={`${x} ${y} ${width} ${h}`} style={{ height, width: (height * width) / h }}>
      {logo.paths.map((path, i) => (
        <Path key={i} d={path.d} fill={path.fill} fillRule={path.fillRule} />
      ))}
    </Svg>
  );
}

// ------------------------------------------------------------------------------------------------------ pages

function SectionPage({
  doc,
  section,
  title,
  period,
}: {
  doc: ReportDoc;
  section: Section;
  title: string;
  period: string;
}) {
  const { lang, d, p } = useDoc();
  const heading = textOf(section.title, lang);
  return (
    <Page
      size={[PAGE.width, PAGE.height]}
      style={[s.page, { backgroundColor: p.raised, fontFamily: FONT.body, color: p.text }]}
      bookmark={{ title: heading, fit: true }}
      wrap
    >
      <View fixed style={[s.header, { flexDirection: d.row, ...d.insetStart(MARGIN), ...d.insetEnd(MARGIN) }]}>
        <View>
          <T style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 22 }}>{heading}</T>
          <View style={{ flexDirection: d.row }}>
            <View style={[s.mark, { backgroundColor: p.accent }]} />
          </View>
        </View>
        <T style={{ fontSize: 10, color: p.muted, marginTop: 8 }}>{`${title} · ${period}`}</T>
      </View>
      {section.kind === 'tiles' ? <Tiles section={section} /> : null}
      {section.kind === 'lines' ? <Lines groups={section.groups} /> : null}
      {section.kind === 'table' ? <Table columns={section.columns} rows={section.rows} /> : null}
      <View
        fixed
        style={[
          s.footer,
          { flexDirection: d.row, borderTopWidth: 0.75, borderTopColor: p.border, color: p.muted },
          { ...d.insetStart(MARGIN), ...d.insetEnd(MARGIN) },
        ]}
      >
        <T>
          <Text style={{ fontFamily: FONT.mono, direction: d.text }}>{numberOf(doc) ?? word('draft', lang)}</Text>
          {` · ${textOf(doc.department, lang)}`}
        </T>
        <Text
          style={{ direction: d.text, textAlign: d.alignEnd }}
          render={({ pageNumber, totalPages }) => word('page_of', lang, { n: pageNumber, m: totalPages })}
        />
      </View>
    </Page>
  );
}

// ------------------------------------------------------------------------------------------------------ tiles

function Tiles({ section }: { section: Extract<Section, { kind: 'tiles' }> }) {
  const { lang, d, p } = useDoc();
  const perRow = section.tiles.length <= 4 ? Math.max(section.tiles.length, 1) : 5;
  const gap = 12;
  const width = (PAGE.width - 2 * MARGIN - gap * (perRow - 1)) / perRow;
  return (
    <View>
      <T style={{ fontSize: 11, color: p.muted, marginBottom: 14 }}>
        {`${textOf(section.currentLabel, lang)} · ${word('vs', lang, { label: textOf(section.previousLabel, lang) })}`}
      </T>
      <View style={{ flexDirection: d.row, flexWrap: 'wrap', rowGap: gap, columnGap: gap }}>
        {section.tiles.map((tile) => (
          <TileBox key={tile.key} tile={tile} width={width} />
        ))}
      </View>
    </View>
  );
}

function TileBox({ tile, width }: { tile: Tile; width: number }) {
  const { lang, d, p } = useDoc();
  const now = figureParts(tile.current, lang);
  const was = tile.previous ? figureParts(tile.previous, lang) : null;
  const delta = change(tile.current, tile.previous);
  const better = tile.better ?? 'up';
  const good = delta && (better === 'up' ? delta.percent > 0 : delta.percent < 0);
  const bad = delta && (better === 'up' ? delta.percent < 0 : delta.percent > 0);
  return (
    <View
      wrap={false}
      style={{
        width,
        height: 152,
        padding: 14,
        backgroundColor: p.surface,
        borderWidth: 0.75,
        borderColor: p.border,
        borderRadius: 6,
        justifyContent: 'space-between',
      }}
    >
      <T style={{ fontSize: 10.5, color: p.muted, lineHeight: 1.35 }}>{textOf(tile.label, lang)}</T>
      <View>
        <View style={{ flexDirection: d.row, alignItems: 'flex-end', columnGap: 4 }}>
          <T style={{ fontFamily: FONT.heading, fontWeight: 600, fontSize: 26, direction: 'ltr' }}>{now.number}</T>
          {now.unit ? <T style={{ fontSize: 10, color: p.muted, marginBottom: 4 }}>{now.unit}</T> : null}
        </View>
        {tile.current.kind === 'not_measured' ? (
          <T style={{ fontSize: 9, color: p.muted }}>{word('not_measured', lang)}</T>
        ) : null}
      </View>
      <View style={{ flexDirection: d.row, justifyContent: 'space-between', alignItems: 'center' }}>
        <T style={{ fontSize: 9.5, color: p.muted }}>
          {was ? word('vs', lang, { label: was.unit ? `${was.number} ${was.unit}` : was.number }) : ''}
        </T>
        {delta ? (
          <Chip
            text={delta.text}
            fg={good ? p.success : bad ? p.danger : p.muted}
            bg={good ? p['success-soft'] : bad ? p['danger-soft'] : p.bg}
            dir="ltr"
          />
        ) : null}
      </View>
    </View>
  );
}

/** A small pill. `dir` is the text's own direction: a figure is always left to right, a word follows the language. */
function Chip({ text, fg, bg, dir }: { text: string; fg: string; bg: string; dir: 'rtl' | 'ltr' }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 9, fontWeight: 600, color: fg, fontFamily: FONT.body, direction: dir }}>{text}</Text>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------------ lines

function Lines({ groups }: { groups: LineGroup[] }) {
  const { lang, d, p } = useDoc();
  return (
    <View>
      {groups.map((g, gi) => (
        <View key={gi} style={{ marginBottom: 14 }}>
          {g.title ? (
            <View minPresenceAhead={40} style={{ flexDirection: d.row, alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 4, height: 14, backgroundColor: p.accent, ...d.marginEnd(8) }} />
              <T style={{ fontSize: 13, fontWeight: 600 }}>{textOf(g.title, lang)}</T>
            </View>
          ) : null}
          {g.lines.map((line, li) => (
            <View
              key={li}
              wrap={false}
              style={{ flexDirection: d.row, alignItems: 'flex-start', marginBottom: 6, columnGap: 10 }}
            >
              <View
                style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p['border-strong'], marginTop: 7 }}
              />
              <T
                style={{
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 1.5,
                  // A line printed in the other language reads in that language's direction (V403).
                  direction: printedIn(line.text, lang) === 'ar' ? 'rtl' : 'ltr',
                }}
              >
                {textOf(line.text, lang)}
              </T>
              {line.amount ? (
                <View style={{ alignItems: d.rtl ? 'flex-start' : 'flex-end', minWidth: 90 }}>
                  <T style={{ fontFamily: FONT.mono, fontSize: 10.5, textAlign: d.alignEnd }}>
                    {figurePartsText(line.amount.value, line.amount.unit, lang)}
                  </T>
                  {line.amount.label ? (
                    <T style={{ fontSize: 8.5, color: p.muted, textAlign: d.alignEnd }}>
                      {textOf(line.amount.label, lang)}
                    </T>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function figurePartsText(value: number, unit: 'count' | 'sar' | 'percent', lang: Lang): string {
  const f = figureParts({ kind: 'number', value, unit }, lang);
  return f.unit ? `${f.number} ${f.unit}` : f.number;
}

// ------------------------------------------------------------------------------------------------------ table

const STATUS_TONE: Record<Status, 'success' | 'warning' | 'danger' | 'muted'> = {
  on_track: 'success',
  done: 'success',
  at_risk: 'warning',
  behind: 'danger',
  not_measured: 'muted',
  carried_over: 'muted',
};

function Table({ columns, rows }: { columns: Column[]; rows: Cell[][] }) {
  const { lang, d, p } = useDoc();
  const inner = PAGE.width - 2 * MARGIN;
  const align = (c: Column) => (c.kind === 'number' ? d.alignEnd : d.alignStart);
  return (
    <View>
      <View
        fixed
        style={{
          flexDirection: d.row,
          backgroundColor: p.surface,
          borderBottomWidth: 0.75,
          borderColor: p['border-strong'],
        }}
      >
        {columns.map((c) => (
          <View key={c.key} style={{ width: inner * c.width, paddingHorizontal: 8, paddingVertical: 7 }}>
            <T style={{ fontSize: 9.5, fontWeight: 600, color: p.muted, textAlign: align(c) }}>
              {textOf(c.title, lang)}
            </T>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View
          key={ri}
          wrap={false}
          style={{ flexDirection: d.row, borderBottomWidth: 0.5, borderColor: p.border, alignItems: 'center' }}
        >
          {columns.map((c, ci) => {
            const cell = row[ci] ?? null;
            const text = cellText(cell, c, lang);
            const status = cell && typeof cell === 'object' && 'status' in cell ? cell.status : null;
            return (
              <View key={c.key} style={{ width: inner * c.width, paddingHorizontal: 8, paddingVertical: 8 }}>
                {status ? (
                  <View style={{ flexDirection: d.row }}>
                    <Chip
                      text={text}
                      fg={toneFg(p, STATUS_TONE[status])}
                      bg={toneBg(p, STATUS_TONE[status])}
                      dir={d.text}
                    />
                  </View>
                ) : (
                  <T
                    style={{
                      fontSize: 10.5,
                      textAlign: align(c),
                      fontFamily: c.kind === 'id' || c.kind === 'number' ? FONT.mono : FONT.body,
                    }}
                  >
                    {text}
                  </T>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function toneFg(p: DocPalette, tone: 'success' | 'warning' | 'danger' | 'muted'): string {
  return tone === 'muted' ? p.muted : p[tone];
}
function toneBg(p: DocPalette, tone: 'success' | 'warning' | 'danger' | 'muted'): string {
  return tone === 'muted' ? p.bg : p[`${tone}-soft`];
}
