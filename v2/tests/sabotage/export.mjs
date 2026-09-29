// Builder C's sabotages (V100, V300): every test of the export engine and the Translate helper must go red when the
// promise it guards is broken, for the planted reason. Run: node scripts/sabotage.mjs --only <name> (or --kind unit).
const unit = (file) => `unit:tests/unit/${file}.test.ts`;
const PDF_GOLDEN = unit('export/a-report-pdf-matches-its-golden-pages-in-arabic-and-english');
const PDF_LAYOUT = unit('export/arabic-report-pages-read-from-the-right-and-english-ones-from-the-left');
const PDF_BIDI = unit('export/english-ids-names-and-digits-inside-arabic-keep-chromes-order');
const PDF_FACTS = unit('export/a-report-pdf-prints-latin-digits-page-numbers-and-embeds-its-fonts');
const SAME = unit('export/two-renderings-of-the-same-report-are-identical');
const PPTX = unit('export/a-report-pptx-reads-right-to-left-in-arabic-and-matches-its-golden-outline');
const TEMPLATE = unit('export/a-filled-pptx-template-keeps-its-settings-and-repeats-its-slides');
const TEXT = unit('export/the-document-text-prints-latin-digits-live-names-and-honest-figures');
const DESIGN = unit('export/the-document-palette-and-logo-come-from-the-design-files');
const ENGLISH_COPY = unit('export/the-english-copy-prints-a-line-with-no-english-in-arabic');
const AWKWARD = unit('export/awkward-reports-still-print-every-section-and-refuse-a-bad-date');
const WORDS = unit('export/an-amount-in-words-says-every-range-to-the-billions-in-arabic-and-english');
const COLUMNS = unit('export/a-report-table-never-drops-a-column-in-the-pdf-or-the-pptx');
const TRANSLATE = `unit:tests/unit/export/the-translate-button-shows-only-where-the-device-can-translate-and-sends-nothing.test.tsx`;

export const sabotages = [
  // ---- the PDF
  {
    name: 'pdf-tile-grows',
    breaks: [PDF_GOLDEN],
    expect: 'pixels differ from its golden',
    edits: [{ file: 'src/core/print/report/pdf/ReportPdf.tsx', find: 'height: 152,', replace: 'height: 164,' }],
  },
  {
    name: 'pdf-forgets-right-to-left',
    breaks: [PDF_LAYOUT],
    expect: 'the Arabic title sits right of the middle',
    edits: [
      {
        file: 'src/core/print/report/pdf/direction.ts',
        find: "const rtl = lang === 'ar';",
        replace: 'const rtl = false;',
      },
    ],
  },
  {
    name: 'pdf-reads-arabic-left-to-right',
    breaks: [PDF_BIDI],
    expect: 'reads right to left in Arabic',
    edits: [
      { file: 'src/core/print/report/pdf/direction.ts', find: "text: rtl ? 'rtl' : 'ltr',", replace: "text: 'ltr'," },
    ],
  },
  {
    name: 'pdf-prints-arabic-digits',
    breaks: [PDF_FACTS],
    expect: 'an Arabic-Indic digit or sign reached the page',
    edits: [
      {
        file: 'src/core/print/text.ts',
        find: '.replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))',
        replace: '.replace(ARABIC_INDIC, (d) => d)',
      },
    ],
  },
  {
    name: 'latin-digits-keep-arabic-ones',
    breaks: [TEXT],
    expect: 'turns Arabic-Indic digits and signs into Latin ones',
    edits: [
      {
        file: 'src/core/print/text.ts',
        find: '.replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))',
        replace: '.replace(ARABIC_INDIC, (d) => d)',
      },
    ],
  },
  {
    name: 'pdf-drops-page-numbers',
    breaks: [PDF_FACTS],
    expect: 'in its footer',
    edits: [
      {
        file: 'src/core/print/report/pdf/ReportPdf.tsx',
        find: "render={({ pageNumber, totalPages }) => word('page_of', lang, { n: pageNumber, m: totalPages })}",
        replace: "render={() => ''}",
      },
    ],
  },
  {
    name: 'pdf-falls-back-to-a-built-in-font',
    breaks: [PDF_FACTS],
    expect: 'a built-in PDF font',
    edits: [
      {
        file: 'src/core/print/report/pdf/ReportPdf.tsx',
        find: 'fontFamily: FONT.body, direction: dir }}>{text}',
        replace: "fontFamily: 'Helvetica', direction: dir }}>{text}",
      },
    ],
  },
  {
    name: 'pdf-stamps-the-download-time',
    breaks: [SAME],
    expect: 'the second rendering differs from the first',
    edits: [
      {
        file: 'src/core/print/report/pdf/ReportPdf.tsx',
        find: 'const stamp = calendarDay(doc.issuedOn ?? doc.period.end);',
        replace: 'const stamp = new Date();',
      },
    ],
  },
  // ---- the PPTX
  {
    name: 'pptx-drops-an-empty-section',
    breaks: [AWKWARD],
    expect: 'the empty section has its slide',
    edits: [
      {
        file: 'src/core/print/report/pptx/reportPptx.ts',
        find: 'if (groups.length || !pages.length) pages.push',
        replace: 'if (groups.length) pages.push',
      },
    ],
  },
  {
    name: 'pptx-forgets-right-to-left',
    breaks: [PPTX],
    expect: 'is right to left',
    edits: [
      {
        file: 'src/core/print/report/pptx/reportPptx.ts',
        find: "const rtl = lang === 'ar';",
        replace: 'const rtl = false;',
      },
    ],
  },
  {
    name: 'pptx-keeps-the-table-left-to-right',
    breaks: [PPTX],
    expect: 'the Arabic table ends with the status on the left',
    edits: [
      {
        file: 'src/core/print/report/pptx/reportPptx.ts',
        find: 'const order = d.rtl ? [...columns.keys()].reverse() : [...columns.keys()];',
        replace: 'const order = [...columns.keys()];',
      },
    ],
  },
  {
    name: 'pptx-stamps-the-download-time',
    breaks: [SAME],
    expect: 'the second deck differs from the first',
    edits: [
      {
        file: 'src/core/print/report/pptx/zip.ts',
        find: "const iso = stamp.toISOString().replace(/\\.\\d{3}Z$/, 'Z');",
        replace: "const iso = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');",
      },
    ],
  },
  {
    name: 'template-leaves-placeholders',
    breaks: [TEMPLATE],
    expect: 'refuses a placeholder that has no value',
    edits: [
      { file: 'src/core/print/report/pptx/template.ts', find: '  if (missing.size)\n', replace: '  if (false)\n' },
    ],
  },
  {
    name: 'template-loses-a-copy',
    breaks: [TEMPLATE],
    expect: 'copies the repeating slide once per item',
    edits: [
      {
        file: 'src/core/print/report/pptx/template.ts',
        find: 'for (const item of items) {',
        replace: 'for (const item of items.slice(1)) {',
      },
    ],
  },
  // ---- the English copy (V403)
  {
    name: 'english-copy-drops-arabic-only-lines',
    breaks: [ENGLISH_COPY],
    expect: 'the Arabic-only line is on the English copy',
    edits: [
      {
        file: 'src/core/print/report/model.ts',
        find: 'return has(lang) || !has(other) ? lang : other;',
        replace: 'return lang;',
      },
    ],
  },
  // ---- what both documents print
  {
    name: 'names-keep-their-tokens',
    breaks: [TEXT],
    expect: 'puts current names into every text of a report',
    edits: [
      {
        file: 'src/core/print/report/names.ts',
        find: 'lines: g.lines.map((l) => ({ ...l, text: t(l.text) })),',
        replace: 'lines: g.lines,',
      },
    ],
  },
  {
    name: 'figures-say-a-change-from-nothing',
    breaks: [TEXT],
    expect: 'says a change from last year only when',
    edits: [
      {
        file: 'src/core/print/report/format.ts',
        find: ' || previous.value === 0) return null;',
        replace: ') return null;',
      },
    ],
  },
  {
    name: 'palette-drifts-from-the-tokens',
    breaks: [DESIGN],
    expect: '--accent',
    edits: [
      {
        file: 'src/core/print/palette.ts',
        find: 'return pick((t) => values.get(t));',
        replace: "return pick((t) => (t === 'accent' ? values.get('primary') : values.get(t)));",
      },
    ],
  },
  {
    name: 'fonts-ship-a-ttf',
    breaks: [DESIGN],
    expect: 'WOFF — fontkit cannot subset an Arabic WOFF2',
    edits: [
      {
        file: 'src/core/print/fonts.ts',
        find: "heading: [{ file: 'ReadexPro-SemiBold.woff', weight: 600 }],",
        replace: "heading: [{ file: 'ReadexPro-SemiBold.ttf', weight: 600 }],",
      },
    ],
  },
  {
    name: 'logo-draws-what-it-cannot',
    breaks: [DESIGN],
    expect: 'refuses a logo it cannot draw faithfully',
    edits: [
      { file: 'src/core/print/logo.ts', find: "if (!tag.startsWith('<path')) throw", replace: 'if (false) throw' },
    ],
  },
  // ---- Translate to Arabic
  {
    name: 'translate-shows-without-a-translator',
    breaks: [TRANSLATE],
    expect: 'no button at all',
    edits: [
      {
        file: 'src/core/print/translate/onDevice.ts',
        find: "  if (!api) return 'unavailable';\n  try {",
        replace: "  if (!api) return 'downloadable';\n  try {",
      },
      {
        file: 'src/core/print/translate/TranslateButton.tsx',
        find: '  if (!visible || !source.trim()) return null;',
        replace: '  if (!source.trim()) return null;\n  void visible;',
      },
    ],
  },
  {
    name: 'translate-sends-the-text-away',
    breaks: [TRANSLATE],
    expect: 'reaches the network',
    edits: [
      {
        file: 'src/core/print/translate/onDevice.ts',
        find: '  const out = await (await translator).translate(text, { signal: options.signal });',
        replace:
          '  void fetch(`https://translate.example/?q=${encodeURIComponent(text)}`);\n  const out = await (await translator).translate(text, { signal: options.signal });',
      },
    ],
  },
  // ---- the amount in words (oversight, 29 Sep)
  {
    name: 'words-say-million-for-a-billion',
    breaks: [WORDS],
    expect: 'says billion for a billion',
    edits: [
      {
        file: 'src/core/print/amountInWords.ts',
        find: '[Math.floor(riyals / 1e9), BILLION],',
        replace: '[Math.floor(riyals / 1e9), MILLION],',
      },
    ],
  },
  {
    name: 'words-drop-the-construct-form',
    breaks: [WORDS],
    expect: 'فقط ألفا ريال لا غير',
    edits: [
      {
        file: 'src/core/print/amountInWords.ts',
        find: '`${last.of} ${RIYAL.one}`',
        replace: '`${last.text} ${RIYAL.one}`',
      },
    ],
  },
  {
    name: 'words-count-halalas-as-riyals',
    breaks: [WORDS],
    expect: 'read back into the same amount',
    edits: [
      {
        file: 'src/core/print/amountInWords.ts',
        find: 'counted(halalas, HALALA, true)',
        replace: 'counted(halalas, RIYAL, true)',
      },
    ],
  },
  {
    name: 'words-lose-the-accusative',
    breaks: [WORDS],
    expect: 'فقط أحد عشر ريالاً لا غير',
    edits: [{ file: 'src/core/print/amountInWords.ts', find: '  many: ACCUSATIVE.riyal,', replace: "  many: 'ريال'," }],
  },
  {
    name: 'words-say-wahida-for-ihda',
    breaks: [WORDS],
    expect: 'فقط إحدى وعشرون هللة لا غير',
    edits: [{ file: 'src/core/print/amountInWords.ts', find: "feminine && unit === 1 ? 'إحدى' : ", replace: '' }],
  },
  // ---- never drop a column (oversight, 29 Sep)
  {
    name: 'table-drops-its-last-column-in-the-pdf',
    breaks: [COLUMNS],
    expect: 'prints every column of every row in the PDF',
    edits: [
      {
        file: 'src/core/print/report/pdf/ReportPdf.tsx',
        find: '          {columns.map((c, ci) => {',
        replace: '          {columns.slice(0, -1).map((c, ci) => {',
      },
    ],
  },
  {
    name: 'table-drops-its-last-column-in-the-pptx',
    breaks: [COLUMNS],
    expect: 'keeps all 19 columns in the PPTX table',
    edits: [
      {
        file: 'src/core/print/report/pptx/reportPptx.ts',
        find: '  const body: PptxGenJS.TableRow[] = rows.map((row) =>\n    order.map((i) => {',
        replace: '  const body: PptxGenJS.TableRow[] = rows.map((row) =>\n    order.slice(1).map((i) => {',
      },
    ],
  },
  {
    name: 'table-lets-a-short-row-print',
    breaks: [COLUMNS],
    expect: 'a cell short or a cell long',
    edits: [
      {
        file: 'src/core/print/report/format.ts',
        find: '    if (row.length !== t.columns.length)',
        replace: '    if (row.length > t.columns.length)',
      },
    ],
  },
  // ---- every Arabic text box right to left, one settings tag per paragraph (oversight, 29 Sep)
  {
    name: 'pptx-box-left-to-right',
    breaks: [PPTX],
    expect: 'marks every text box',
    edits: [
      {
        file: 'src/core/print/report/pptx/zip.ts',
        find: 'if (opts.rtl) fixed =',
        replace: 'if (opts.rtl && false) fixed =',
      },
    ],
  },
  {
    name: 'pptx-chip-left-to-right',
    breaks: [PPTX],
    expect: 'is right to left',
    edits: [
      {
        file: 'src/core/print/report/pptx/reportPptx.ts',
        find: "        margin: 0,\n        rtlMode: d.rtl,\n        lang: 'en-GB',",
        replace: "        margin: 0,\n        lang: 'en-GB',",
      },
    ],
  },
  {
    name: 'pptx-keeps-a-second-settings-tag',
    breaks: [PPTX],
    expect: 'one paragraph settings tag per paragraph',
    edits: [
      {
        file: 'src/core/print/report/pptx/zip.ts',
        find: 'let fixed = oneSettingsPerParagraph(xml);',
        replace: 'let fixed = xml;',
      },
    ],
  },
];
