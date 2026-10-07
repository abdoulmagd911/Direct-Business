// @ts-check
// Builder C's Past work grid (P5-2c, V306): every grid test goes red under a planted defect, for its reason (V100).
const unit = (/** @type {string} */ f) => `unit:tests/unit/grid/${f}`;
const BLOCK = unit('a-pasted-block-of-20-rows-maps-to-20-rows-and-one-request.test.ts');
const PREVIEW = unit('the-preview-refuses-a-future-date-a-missing-title-and-an-unknown-organisation-by-name.test.ts');
const PASTE = unit('pastes-from-excel-and-google-sheets-read-the-same.test.ts');
const ZONES = unit('a-pasted-date-and-riyadhs-today-read-the-same-in-every-time-zone-and-from-an-arabic-sheet.test.ts');
const GRID = unit('the-grid-previews-every-row-and-saves-the-ready-ones-as-one-request-with-one-undo.test.tsx');
const OLD = unit('a-pasted-name-is-matched-by-the-database-and-a-row-pasted-twice-is-added-once.test.tsx');
const VALUE_TEST = unit('a-newer-reports-deal-value-updates-a-saved-row-and-an-older-one-never-does.test.tsx');
const SOURCE_TEST = unit('every-paste-names-its-source-report-and-an-undated-row-takes-its-last-day.test.tsx');
const ROWS = 'src/ui/grid/rows.ts';
const DATES = 'src/ui/grid/dates.ts';
const READ = 'src/ui/grid/paste.ts';
const COMPONENT = 'src/ui/grid/PastWorkGrid.tsx';
const SOURCE = 'src/ui/grid/source.ts';

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
  // ---------------------------------------------------------------- the old app's missed rows (round 13)
  {
    name: 'grid-holds-an-unknown-owner',
    breaks: [OLD],
    expect: 'saves no one, more than one and an empty cell as Unknown',
    edits: [
      {
        file: ROWS,
        find: "      if (name && !match) problems.push('person_checking');",
        replace: "      if (match?.kind !== 'one') problems.push('person_checking');",
      },
    ],
  },
  {
    name: 'grid-sends-an-unknown-owner-as-the-paster',
    breaks: [OLD],
    expect: 'never the person pasting',
    edits: [{ file: ROWS, find: 'owner_unknown: r.person?.unknown != null,', replace: 'owner_unknown: false,' }],
  },
  {
    name: 'grid-calls-many-people-no-one',
    breaks: [OLD],
    expect: 'each Unknown owner says why',
    edits: [{ file: ROWS, find: '          ? match.kind\n', replace: "          ? 'none'\n" }],
  },
  {
    name: 'grid-reads-people-it-was-not-offered',
    breaks: [OLD],
    expect: 'reads no person where the screen does not offer the column',
    edits: [
      {
        file: ROWS,
        find: 'if (o.people && columns.person !== null && columns.person !== undefined) {',
        replace: 'if (columns.person !== null && columns.person !== undefined) {',
      },
      {
        file: ROWS,
        find: 'const match = name ? o.people.get(name) : undefined;',
        replace: 'const match = name ? o.people?.get(name) : undefined;',
      },
    ],
  },
  {
    name: 'grid-sends-no-person',
    breaks: [OLD],
    expect: 'a matched person, or owner Unknown — never the person pasting',
    edits: [{ file: ROWS, find: 'person_id: r.person?.id ?? null,', replace: 'person_id: null,' }],
  },
  {
    name: 'grid-key-keeps-case-and-spaces',
    breaks: [OLD],
    expect: 'whatever its case and spacing',
    edits: [{ file: ROWS, find: '      norm(title),\n', replace: '      title,\n' }],
  },
  {
    name: 'grid-ignores-saved-rows',
    breaks: [OLD],
    expect: 'names a row the database already holds',
    edits: [{ file: ROWS, find: "      else if (before) problems.push('already_saved');\n", replace: '' }],
  },
  {
    name: 'grid-sends-no-key',
    breaks: [OLD],
    expect: 'names a row the database already holds',
    edits: [{ file: ROWS, find: 'import_key: r.key,', replace: "import_key: ''," }],
  },
  {
    name: 'grid-forgets-what-it-saved',
    breaks: [OLD],
    expect: 'pasting the same 20 rows a second time adds nothing',
    edits: [
      {
        file: COMPONENT,
        find: '      learnSaved(new Map(request.rows.map((r) => [r.import_key, true])));\n',
        replace: '',
      },
    ],
  },
  {
    // The pattern the grid had before: the answer belonged to one run of the effect, and a redraw threw it away.
    name: 'grid-drops-a-late-answer',
    breaks: [OLD],
    expect: 'the answer is kept',
    edits: [
      {
        file: COMPONENT,
        find: '    for (const n of missing) waiting.current.add(n);\n',
        replace: '    for (const n of missing) waiting.current.add(n);\n    let live = true;\n',
      },
      { file: COMPONENT, find: 'if (mounted.current) setKnown(', replace: 'if (mounted.current && live) setKnown(' },
      {
        file: COMPONENT,
        find: '  }, [wanted, known, ask, failed]);',
        replace: '    return () => {\n      live = false;\n    };\n  }, [wanted, known, ask, failed]);',
      },
    ],
  },
  {
    name: 'grid-asks-again-while-waiting',
    breaks: [OLD],
    expect: 'asked once',
    edits: [
      {
        file: COMPONENT,
        find: 'const missing = wanted.filter((n) => !known.has(n) && !waiting.current.has(n));',
        replace: 'const missing = wanted.filter((n) => !known.has(n));',
      },
    ],
  },
  {
    name: 'grid-lets-a-2024-row-in',
    breaks: [SOURCE_TEST],
    expect: 'before past work starts (V506)',
    edits: [{ file: ROWS, find: 'else if (date.day < PAST_WORK_FROM)', replace: "else if (date.day < '1900')" }],
  },
  {
    name: 'grid-leaves-an-undated-row-undated',
    breaks: [SOURCE_TEST],
    expect: 'dates an undated row on the report',
    edits: [
      {
        file: ROWS,
        find: 'const reportDay = !dateCell && o.source ? periodLastDay(o.source.period) : null;',
        replace: 'const reportDay = null as string | null;',
      },
    ],
  },
  {
    name: 'grid-dates-an-undated-row-today',
    breaks: [SOURCE_TEST],
    expect: 'dates an undated row on the report',
    edits: [
      {
        file: ROWS,
        find: 'const reportDay = !dateCell && o.source ? periodLastDay(o.source.period) : null;',
        replace: 'const reportDay = !dateCell && o.source ? o.today : null;',
      },
    ],
  },
  {
    name: 'grid-saves-without-a-report',
    breaks: [SOURCE_TEST],
    expect: 'no Save without a report (V506)',
    edits: [{ file: COMPONENT, find: 'disabled={!ready || !source}', replace: 'disabled={!ready}' }],
  },
  {
    name: 'grid-offers-a-report-not-yet-over',
    breaks: [SOURCE_TEST],
    expect: 'September is not over on 29 September',
    edits: [
      { file: SOURCE, find: 'if (periodLastDay(period)! <= today)', replace: "if (periodLastDay(period)! <= '9999')" },
    ],
  },
  {
    name: 'grid-counts-february-as-30-days',
    breaks: [SOURCE_TEST],
    expect: 'February 2025 has 28 days',
    edits: [
      {
        file: SOURCE,
        find: 'const last = new Date(Date.UTC(year, month, 0)).getUTCDate();',
        replace: 'const last = month === 2 ? 30 : new Date(Date.UTC(year, month, 0)).getUTCDate();',
      },
    ],
  },
  {
    name: 'grid-keys-a-row-by-its-report',
    breaks: [SOURCE_TEST],
    expect: 'as one row',
    edits: [
      {
        file: ROWS,
        find: 'const key = JSON.stringify([\n      o.mode,',
        replace: 'const key = JSON.stringify([\n      o.mode,\n      o.source?.period,',
      },
    ],
  },
  {
    name: 'grid-sends-no-report',
    breaks: [BLOCK],
    expect: 'the report the rows come from (V506)',
    edits: [
      {
        file: ROWS,
        find: 'source: { kind: source.kind, period: source.period, last_day: lastDay },',
        replace: "source: undefined as unknown as BackfillRequest['source'],",
      },
    ],
  },
  {
    name: 'grid-reads-a-report-day-in-the-computers-zone',
    breaks: [SOURCE_TEST],
    expect: 'in every time zone',
    edits: [
      { file: SOURCE, find: 'Date.UTC(year, month, 0)).getUTCDate()', replace: 'Date.UTC(year, month, 0)).getDate()' },
    ],
  },
  {
    name: 'grid-hands-a-report-dated-row-its-day-as-if-dated',
    breaks: [SOURCE_TEST],
    expect: 'never hands it a day',
    edits: [
      {
        file: ROWS,
        find: 'happened_on: r.dateFromReport ? null : r.happenedOn!,',
        replace: 'happened_on: r.happenedOn!,',
      },
    ],
  },
  {
    name: 'grid-takes-a-value-for-a-category-without-one',
    breaks: [VALUE_TEST],
    expect: 'Cost savings has no deal value (V505)',
    edits: [
      {
        file: ROWS,
        find: "else if (kind && !(o.valueKinds ?? []).includes(kind)) problems.push('value_not_allowed');",
        replace: "else if (kind && false) problems.push('value_not_allowed');",
      },
    ],
  },
  {
    name: 'grid-lets-an-older-report-replace-a-saved-value',
    breaks: [VALUE_TEST],
    expect: 'is not replaced by March',
    edits: [
      {
        file: ROWS,
        find: "return held.from !== null && held.from !== 'typed' && reportIsNewer(source, held.from);",
        replace: "return held.from !== null && held.from !== 'typed';",
      },
    ],
  },
  {
    name: 'grid-lets-a-report-replace-a-typed-value',
    breaks: [VALUE_TEST],
    expect: 'never replaces a value a person typed',
    edits: [
      {
        file: ROWS,
        find: "return held.from !== null && held.from !== 'typed' && reportIsNewer(source, held.from);",
        replace: "return held.from === 'typed' || (held.from !== null && reportIsNewer(source, held.from));",
      },
    ],
  },
  {
    name: 'grid-lets-the-monthly-beat-the-quarterly',
    breaks: [VALUE_TEST],
    expect: 'both end 31 March: the quarterly wins',
    edits: [
      {
        file: SOURCE,
        find: "return SOURCE_PERIOD[a.kind] === 'quarter' && SOURCE_PERIOD[b.kind] === 'month';",
        replace: "return SOURCE_PERIOD[a.kind] === 'month' && SOURCE_PERIOD[b.kind] === 'quarter';",
      },
    ],
  },
  {
    name: 'grid-sends-a-value-with-a-task',
    breaks: [VALUE_TEST],
    expect: 'a task row carries no value key',
    edits: [
      { file: ROWS, find: "...(mode === 'achievements' ? { value: r.value } : {}),", replace: 'value: r.value,' },
    ],
  },
  {
    name: 'grid-reads-an-arabic-amount-as-no-amount',
    breaks: [VALUE_TEST],
    expect: 'Arabic-Indic digits and thousands mark',
    edits: [{ file: ROWS, find: '.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))', replace: '' }],
  },
  {
    name: 'grid-updates-a-saved-row-with-the-same-value',
    breaks: [VALUE_TEST],
    expect: 'does not call the same amount an update',
    edits: [
      {
        file: ROWS,
        find: 'if (value === null || !source || value === held.amount) return false;',
        replace: 'if (value === null || !source) return false;',
      },
    ],
  },
  {
    name: 'grid-offers-the-value-column-for-tasks',
    breaks: [VALUE_TEST],
    expect: 'a task has no value column',
    edits: [
      {
        file: COMPONENT,
        find: "const offersValue = mode === 'achievements' && !!props.valueKinds?.length;",
        replace: 'const offersValue = !!props.valueKinds?.length;',
      },
    ],
  },
  {
    name: 'grid-reads-a-value-in-a-task-paste',
    breaks: [VALUE_TEST],
    expect: 'no value problem for a task',
    edits: [
      {
        file: ROWS,
        find: "const valueCell = o.mode === 'achievements' ? at(row, 'value') : '';",
        replace: "const valueCell = at(row, 'value');",
      },
    ],
  },
  {
    name: 'grid-calls-an-update-backfilled',
    breaks: [VALUE_TEST],
    expect: 'Updates a saved row',
    edits: [
      { file: COMPONENT, find: '{r.updatesSaved ? labels.updatesSaved : labels.ready}', replace: '{labels.ready}' },
    ],
  },
  {
    name: 'grid-reads-a-held-map-as-a-plain-set',
    breaks: [VALUE_TEST],
    expect: 'marked as an update',
    edits: [
      { file: COMPONENT, find: 'held instanceof Map ? (held.get(k) ?? false) : held.has(k)', replace: 'held.has(k)' },
    ],
  },
  {
    // V382, QA-518: a decimal comma was read as a thousands separator ("12,50" as 1250)
    name: 'amount-reads-a-decimal-comma-as-thousands',
    breaks: [VALUE_TEST],
    expect: 'a decimal comma or a stray separator is refused',
    edits: [
      {
        file: ROWS,
        find: '(?:\\d+|\\d{1,3}(?:[\\s\\u00a0,٬]\\d{3})+)',
        replace: '[\\d\\s\\u00a0,٬]+',
      },
    ],
  },
];
