// Landing 32 (Finance F-B) — Exclude / Include on a code's page, and a partner's Finance tab that counts only the
// counted rows. Each sabotage takes one rule back; the test named must go red.
const CODES = 'src/modules/codes/screens/CodesScreen.tsx';
const TOGGLE = 'src/modules/codes/toggle.ts';
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';
const CODES_TEST = 'unit:tests/unit/codes/landing-32-an-admin-excludes-and-includes-a-row.test.tsx';
const TAB_TEST = 'unit:tests/unit/partners/landing-32-the-finance-tab-counts-only-counted-rows.test.tsx';

export const sabotages = [
  // ---- a code's page: the toggle
  {
    name: 'l32-code-counted-row-cannot-be-excluded',
    breaks: [CODES_TEST],
    expect: '> a counted row can be excluded, a row excluded by hand can be included, and nothing else is offered',
    edits: [
      {
        file: TOGGLE,
        find: "  if (row.counted) return { kind: 'exclude', ...target };",
        replace: "  if (!row.counted) return { kind: 'exclude', ...target };",
      },
    ],
  },
  {
    name: 'l32-code-list-rule-row-offers-include',
    breaks: [CODES_TEST],
    expect: '> an admin sees Exclude on a counted row and Include only on a row excluded by hand',
    edits: [
      {
        file: TOGGLE,
        find: "  if (row.excluded_row_level === true) return { kind: 'include', ...target };",
        replace: "  if (row.excluded_by) return { kind: 'include', ...target };",
      },
    ],
  },
  {
    name: 'l32-code-row-without-a-number-offers-an-action',
    breaks: [CODES_TEST],
    expect: '> a row with no organisation or no number offers no action',
    edits: [
      {
        file: TOGGLE,
        find: '  if (!row.partner_id || !row.number) return null;',
        replace: '  if (!row.partner_id) return null;',
      },
    ],
  },
  {
    name: 'l32-code-every-reader-may-toggle',
    breaks: [CODES_TEST],
    expect: '> a reader who is not an admin sees no Exclude and no Include, even at Full',
    edits: [
      {
        file: CODES,
        find: '  const canToggle = detail?.can_toggle === true;',
        replace: '  const canToggle = detail?.can_toggle !== false;',
      },
    ],
  },
  {
    name: 'l32-code-list-rule-words-on-a-row-excluded-by-hand',
    breaks: [CODES_TEST],
    expect: '> a row a list rule catches says so in words, and only that row does',
    edits: [
      {
        file: CODES,
        find: 'const byListRule = !l.counted && Boolean(l.excluded_by) && l.excluded_row_level !== true;',
        replace: 'const byListRule = !l.counted && Boolean(l.excluded_by);',
      },
    ],
  },
  {
    name: 'l32-code-list-rule-words-are-not-said',
    breaks: [CODES_TEST],
    expect: '> a row a list rule catches says so in words, and only that row does',
    edits: [
      {
        file: CODES,
        find: '                          {byListRule ? (',
        replace: '                          {byListRule && l.counted ? (',
      },
    ],
  },
  {
    name: 'l32-code-excluded-reason-is-dropped',
    breaks: [CODES_TEST],
    expect: '> keeps the status word and the excluded reason on a row that is not counted',
    edits: [
      {
        file: CODES,
        find: "const why = [l.status_word, l.excluded_reason].filter(Boolean).join(' · ');",
        replace: "const why = [l.status_word].filter(Boolean).join(' · ');",
      },
    ],
  },
  {
    name: 'l32-code-reason-box-does-not-say-required',
    breaks: [CODES_TEST],
    expect:
      '> Exclude asks for a reason, which is required, then excludes the row by its organisation and number and reads again',
    edits: [
      {
        file: CODES,
        find: "          reason: t('pages.codes.detail.toggleReason'),",
        replace: "          reason: t('common.reason'),",
      },
    ],
  },
  {
    name: 'l32-code-exclude-names-the-wrong-row',
    breaks: [CODES_TEST],
    expect:
      '> Exclude asks for a reason, which is required, then excludes the row by its organisation and number and reads again',
    edits: [
      {
        file: CODES,
        find: '                p_number: asked.number,',
        replace: '                p_number: asked.partnerId,',
      },
    ],
  },
  {
    name: 'l32-code-toggle-does-not-read-again',
    breaks: [CODES_TEST],
    expect:
      '> Exclude asks for a reason, which is required, then excludes the row by its organisation and number and reads again',
    edits: [
      {
        file: CODES,
        find: '              }) as Promise<{ request_id?: string | null } | null>,\n            { after: () => router.refresh() },\n          );\n        }}\n      />\n      <ReasonDialog\n        open={removeAttributionId !== null}',
        replace:
          '              }) as Promise<{ request_id?: string | null } | null>,\n            {},\n          );\n        }}\n      />\n      <ReasonDialog\n        open={removeAttributionId !== null}',
      },
    ],
  },
  {
    name: 'l32-code-include-excludes-instead',
    breaks: [CODES_TEST],
    expect: '> Include asks for a reason too, then includes the row again',
    edits: [
      {
        file: CODES,
        find: "rpc(asked.kind === 'exclude' ? 'finance_row_exclude' : 'finance_row_include', {",
        replace: "rpc(asked.kind === 'exclude' ? 'finance_row_exclude' : 'finance_row_exclude', {",
      },
    ],
  },
  {
    name: 'l32-code-buttons-keep-english-in-arabic',
    breaks: [CODES_TEST],
    expect: '> reads in Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '"excludeTitle": "استبعاد هذا السطر من الاحتساب؟"',
        replace: '"excludeTitle": "Exclude this row from the count?"',
      },
    ],
  },
  // ---- a partner's Finance tab
  {
    name: 'l32-tab-totals-add-rows-that-do-not-count',
    breaks: [TAB_TEST],
    expect: '> the cards are the counted rows only — a row that does not count is never added',
    edits: [
      {
        file: TABS,
        find: '  const visibleRows = useMemo(() => shownRows.filter((r) => r.counted !== false), [shownRows]);',
        replace: '  const visibleRows = useMemo(() => shownRows.filter((r) => r.revenue !== null), [shownRows]);',
      },
    ],
  },
  {
    name: 'l32-tab-hidden-imports-let-uncounted-rows-in',
    breaks: [TAB_TEST],
    expect: '> with the imported rows hidden the totals are still the counted rows only',
    edits: [
      {
        file: TABS,
        find: '  const visibleRows = useMemo(() => shownRows.filter((r) => r.counted !== false), [shownRows]);',
        replace:
          '  const visibleRows = useMemo(() => shownRows.filter((r) => hide || r.counted !== false), [shownRows, hide]);',
      },
    ],
  },
  {
    name: 'l32-tab-apart-rows-are-not-listed',
    breaks: [TAB_TEST],
    expect: '> lists the rows that do not count apart, under "Not counted (N)", with revenue and the reason',
    edits: [{ file: TABS, find: '          {apartRows.length ? (', replace: '          {apartRows.length < 0 ? (' }],
  },
  {
    name: 'l32-tab-apart-row-loses-its-reason',
    breaks: [TAB_TEST],
    expect: '> lists the rows that do not count apart, under "Not counted (N)", with revenue and the reason',
    edits: [{ file: TABS, find: '{r.not_counted_reason ? (', replace: '{r.not_counted_reason && r.counted ? (' }],
  },
  {
    name: 'l32-tab-apart-list-ignores-the-imported-switch',
    breaks: [TAB_TEST],
    expect: '> the apart list follows the Imported switch like the main list',
    edits: [
      {
        file: TABS,
        find: '  const apartRows = useMemo(() => shownRows.filter((r) => r.counted === false), [shownRows]);',
        replace:
          '  const apartRows = useMemo(\n    () => ((report?.rows ?? []) as TabRow[]).filter((r) => r.counted === false),\n    [report, shownRows],\n  );',
      },
    ],
  },
  {
    name: 'l32-tab-list-rule-words-on-a-row-excluded-by-hand',
    breaks: [TAB_TEST],
    expect: '> a row a list rule catches says so in words; a row excluded by hand does not',
    edits: [
      {
        file: TABS,
        find: 'const byListRule = Boolean(r.excluded_by) && r.excluded_row_level !== true;',
        replace: 'const byListRule = Boolean(r.excluded_by);',
      },
    ],
  },
  {
    name: 'l32-tab-empty-cost-reads-zero',
    breaks: [TAB_TEST],
    expect:
      '> cost and profit stay a dash when no counted row has a cost, never 0 — a row that does not count changes nothing',
    edits: [
      {
        file: TABS,
        find: '  const cost = costRows.length ? costRows.reduce((s, r) => s + (r.cost ?? 0), 0) : null;',
        replace: '  const cost = costRows.reduce((s, r) => s + (r.cost ?? 0), 0);',
      },
    ],
  },
  {
    name: 'l32-tab-empty-profit-reads-zero',
    breaks: [TAB_TEST],
    expect: '> a partner whose every row is out shows an empty list, a dash for cost and profit, and the rows apart',
    edits: [
      {
        file: TABS,
        find: '  const profit = profitRows.length ? profitRows.reduce((s, r) => s + (r.profit ?? 0), 0) : null;',
        replace: '  const profit = profitRows.reduce((s, r) => s + (r.profit ?? 0), 0);',
      },
    ],
  },
  {
    name: 'l32-tab-code-not-found-has-no-pill',
    breaks: [TAB_TEST],
    expect: '> a row whose code is not among the codes carries the pill "Code has not been found", once',
    edits: [
      {
        file: TABS,
        find: "    r.flags.includes('code_not_found') ? (",
        replace: "    r.flags.includes('code_missing') ? (",
      },
    ],
  },
  {
    name: 'l32-tab-code-not-found-is-said-twice',
    breaks: [TAB_TEST],
    expect: '> a row whose code is not among the codes carries the pill "Code has not been found", once',
    edits: [{ file: TABS, find: "const PILL_FLAGS = ['code_not_found'];", replace: 'const PILL_FLAGS = [];' }],
  },
  {
    name: 'l32-tab-main-list-counts-every-row-read',
    breaks: [TAB_TEST],
    expect: '> the main list shows the counted rows, and its count says so',
    edits: [
      {
        file: TABS,
        find: '<span className="ms-2 font-data text-sm font-normal text-muted tabular">{visibleRows.length}</span>',
        replace: '<span className="ms-2 font-data text-sm font-normal text-muted tabular">{shownRows.length}</span>',
      },
    ],
  },
  {
    name: 'l32-tab-apart-section-is-drawn-empty',
    breaks: [TAB_TEST],
    expect: '> draws no apart section when every row counts',
    edits: [{ file: TABS, find: '          {apartRows.length ? (', replace: '          {shownRows.length ? (' }],
  },
  {
    name: 'l32-tab-offers-include',
    breaks: [TAB_TEST],
    expect: '> offers no Exclude and no Include on this tab, even to an admin',
    edits: [
      {
        file: TABS,
        find: '<StatusChip tone="neutral">{t(\'partners.companyFinance.notCountedPill\')}</StatusChip>',
        replace: '<button type="button">Include</button>',
      },
    ],
  },
  {
    name: 'l32-tab-apart-heading-keeps-english-in-arabic',
    breaks: [TAB_TEST],
    expect: '> reads in Arabic',
    edits: [
      {
        file: 'messages/ar.json',
        find: '"notCountedRows": "غير محتسب ({count})"',
        replace: '"notCountedRows": "Not counted ({count})"',
      },
    ],
  },
];
