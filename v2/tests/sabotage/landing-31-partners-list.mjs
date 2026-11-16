// Landing 31 (16 Nov): the partners list in the new look — four cards (Active · Prospects · Stale · Quiet) that filter
// the list through the address, the phone's three chips, figures counted from the list read, and a table that fits
// its place instead of scrolling sideways. Each sabotage takes one of those back, and the test named must go red.
const KPI = 'src/modules/partners/list/kpi.ts';
const CARDS = 'src/modules/partners/list/KpiCards.tsx';
const FILTERS = 'src/modules/partners/list/filters.ts';
const COLUMNS = 'src/modules/partners/list/columns.ts';
const PAGE = 'src/modules/partners/screens/list-page.tsx';
const T_CARDS = 'unit:tests/unit/partners/the-four-cards-filter-the-list-through-the-address.test.tsx';
const T_COUNTS = 'unit:tests/unit/partners/the-cards-figures-come-from-the-list-read.test.ts';
const LIST = 'src/modules/partners/screens/PartnersList.tsx';
const T_STATES = 'unit:tests/unit/partners/the-list-has-every-state-in-the-new-look.test.tsx';
const T_FITS = 'unit:tests/unit/partners/the-list-table-fits-its-place.test.ts';
const T_QUIET_ROW = 'unit:tests/unit/partners/a-quiet-row-says-so-on-the-list.test.tsx';
const MIGRATION = 'supabase/migrations/20261116110000_partners_list_quiet.sql';

export const sabotages = [
  // ---- pressing a card writes its filter into the address
  {
    name: 'partners-card-press-drops-the-search',
    breaks: [T_CARDS],
    expect: '> the search and the other filters stay; only the cards’ own filter changes',
    edits: [
      {
        file: KPI,
        find: "const off: ListFilters = { ...f, statuses: [], stale: false, quiet: false, view: '' };",
        replace: "const off: ListFilters = { ...f, q: '', statuses: [], stale: false, quiet: false, view: '' };",
      },
    ],
  },
  {
    name: 'partners-card-pressed-again-stays-on',
    breaks: [T_CARDS],
    expect: '> pressing the card that is on clears it, and leaves the rest',
    edits: [
      { file: KPI, find: 'if (k === null || kpiOf(f) === k) return off;', replace: 'if (k === null) return off;' },
    ],
  },
  {
    name: 'partners-stale-card-keeps-the-status-card',
    breaks: [T_CARDS],
    expect: '> one card at a time: a second card replaces the first',
    edits: [
      {
        file: KPI,
        find: "if (k === 'stale') return { ...off, stale: true };",
        replace: "if (k === 'stale') return { ...f, view: '', stale: true };",
      },
    ],
  },
  {
    name: 'partners-prospects-card-filters-active',
    breaks: [T_CARDS],
    expect: '> each card is one of the list’s own filters',
    edits: [
      {
        file: KPI,
        find: "return { ...off, statuses: [k === 'active' ? 'active' : 'prospect'] };",
        replace: "return { ...off, statuses: ['active'] };",
      },
    ],
  },
  // ---- the card that is on is read from the address
  {
    name: 'partners-card-on-for-any-status-filter',
    breaks: [T_CARDS],
    expect: '> a status filter that is not one card’s own lights no card',
    edits: [
      {
        file: KPI,
        find: 'if (f.statuses.length !== 1) return null;',
        replace: 'if (f.statuses.length < 1) return null;',
      },
    ],
  },
  {
    name: 'partners-stale-filter-leaves-the-address',
    breaks: [T_CARDS],
    expect: '> the address round-trips: what a press writes is what the page reads back',
    edits: [{ file: FILTERS, find: "stale: str(q.stale) === '1',", replace: 'stale: false,' }],
  },
  // ---- the cards as drawn
  {
    name: 'partners-pressed-card-does-not-say-so',
    breaks: [T_CARDS],
    expect: '> the card that is on says so, and its link clears it',
    edits: [{ file: CARDS, find: "aria-current={pressed ? 'true' : undefined}", replace: 'aria-current={undefined}' }],
  },
  {
    name: 'partners-pressed-card-is-colour-only',
    breaks: [T_CARDS],
    expect: '> the card that is on says so, and its link clears it',
    edits: [
      {
        file: CARDS,
        find: '{pressed ? <Check className="size-4 shrink-0" aria-hidden="true" data-kpi-tick /> : null}',
        replace: '',
      },
    ],
  },
  {
    name: 'partners-unknown-figure-drawn-as-zero',
    breaks: [T_CARDS],
    expect: '> a figure that is not known is a dash, never 0',
    edits: [
      { file: CARDS, find: 'value={count === null ? null : String(count)}', replace: 'value={String(count ?? 0)}' },
    ],
  },
  {
    name: 'partners-cards-show-a-fixed-figure',
    breaks: [T_CARDS],
    expect: '> shows the four cards with the counted figures',
    edits: [{ file: CARDS, find: 'const count = counts[k];', replace: 'const count = counts.all;' }],
  },
  {
    name: 'partners-card-links-forget-the-filters',
    breaks: [T_CARDS],
    expect: '> each card links to the list with its filter, carrying the search along',
    edits: [
      {
        file: CARDS,
        find: '              href={addressOf(base, pressKpi(filters, k))}',
        replace: "              href={addressOf(base, pressKpi({ ...filters, q: '' }, k))}",
      },
    ],
  },
  // ---- the phone's chips
  {
    name: 'partners-phone-all-chip-always-on',
    breaks: [T_CARDS],
    expect: '> All is on with no card, and clears the card that is on',
    edits: [
      {
        file: CARDS,
        find: "{ key: 'all', kpi: null, label: t('all'), count: counts.all, pressed: none },",
        replace: "{ key: 'all', kpi: null, label: t('all'), count: counts.all, pressed: true },",
      },
    ],
  },
  {
    name: 'partners-phone-chips-are-34-tall',
    breaks: [T_CARDS],
    expect: '> a chip is a finger tall',
    edits: [
      {
        file: CARDS,
        find: "'inline-flex h-11 items-center gap-1.5",
        replace: "'inline-flex h-[34px] items-center gap-1.5",
      },
    ],
  },
  {
    name: 'partners-needs-attention-shows-the-prospects-count',
    breaks: [T_CARDS],
    expect: '> All · Prospects · Needs attention, each with its count',
    edits: [
      {
        file: CARDS,
        find: "label: t('attention'), count: counts.stale,",
        replace: "label: t('attention'), count: counts.prospects,",
      },
    ],
  },
  // ---- the figures are counted
  {
    name: 'partners-stale-count-counts-every-flag',
    breaks: [T_CARDS],
    expect: '> from the rows of a whole list',
    edits: [
      {
        file: KPI,
        find: "stale: rows.filter((r) => r.flags.includes('stale')).length,",
        replace: 'stale: rows.filter((r) => r.flags.length > 0).length,',
      },
    ],
  },
  // ---- Quiet is real (16 Nov, 20261116110000): a card like the others, counted and filtered by the list read
  {
    name: 'partners-quiet-card-pretends-a-figure',
    breaks: [T_CARDS],
    expect: '> Quiet that is not known (below View on Finance): a dash, never 0, and nothing to press',
    edits: [
      {
        file: CARDS,
        find: '<KpiTile className="flex-1" icon={ICONS[k]} label={t(k)} value={null} footnote={note} />',
        replace: '<KpiTile className="flex-1" icon={ICONS[k]} label={t(k)} value="0" footnote={note} />',
      },
    ],
  },
  {
    name: 'partners-quiet-card-cannot-be-pressed',
    breaks: [T_CARDS],
    expect: '> Quiet is a card like the others: its figure, a link, and a tick when it is on',
    edits: [
      {
        file: CARDS,
        find: "if (k === 'quiet' && count === null && !pressed)",
        replace: "if (k === 'quiet')",
      },
    ],
  },
  {
    name: 'partners-quiet-card-filters-stale',
    breaks: [T_CARDS],
    expect: '> each card is one of the list’s own filters',
    edits: [
      {
        file: KPI,
        find: "if (k === 'quiet') return { ...off, quiet: true };",
        replace: "if (k === 'quiet') return { ...off, stale: true };",
      },
    ],
  },
  {
    name: 'partners-quiet-stays-on-under-another-card',
    breaks: [T_CARDS],
    expect: '> one card at a time: a second card replaces the first',
    edits: [
      {
        file: KPI,
        find: "const off: ListFilters = { ...f, statuses: [], stale: false, quiet: false, view: '' };",
        replace: "const off: ListFilters = { ...f, statuses: [], stale: false, view: '' };",
      },
    ],
  },
  {
    name: 'partners-quiet-is-not-in-the-address',
    breaks: [T_CARDS],
    expect: '> the address round-trips: what a press writes is what the page reads back',
    edits: [{ file: FILTERS, find: "    quiet: str(q.quiet) === '1',\n", replace: '    quiet: false,\n' }],
  },
  {
    name: 'partners-quiet-is-not-asked-of-the-database',
    breaks: [T_CARDS],
    expect: '> Quiet is asked of the database as Stale is',
    edits: [{ file: FILTERS, find: '  if (f.quiet) p.quiet = true;\n', replace: '' }],
  },
  {
    name: 'partners-quiet-row-is-drawn-as-a-contract',
    breaks: [T_QUIET_ROW],
    expect: '> in a word with its icon, after Stale, on the quiet row only',
    edits: [
      {
        file: LIST,
        find: '{t(`partners.flags.${f}`)}',
        replace: "{t(`partners.flags.${f === 'quiet' ? 'stale' : f}`)}",
      },
    ],
  },
  {
    name: 'partners-quiet-filter-is-not-a-filter-to-clear',
    breaks: [T_QUIET_ROW],
    expect: '> with Quiet on: its card is on, and the filter can be cleared like any other',
    edits: [
      {
        file: LIST,
        find: '          filters.stale ||\n          filters.quiet ||\n          filters.archived ? (',
        replace: '          filters.stale ||\n          filters.archived ? (',
      },
    ],
  },
  // ---- the figures come with the list read
  {
    name: 'partners-list-read-does-not-ask-for-counts',
    breaks: [T_COUNTS],
    expect: '> as the list opens: the one partners read is asked for its counts, and they are the figures',
    edits: [
      { file: PAGE, find: 'p_filters: withCounts(p_filters) as never,', replace: 'p_filters: p_filters as never,' },
    ],
  },
  {
    name: 'partners-figures-are-counted-from-the-rows-on-screen',
    breaks: [T_COUNTS],
    expect: '> with a card on: still one partners read, and the figures are the read’s, not the card’s rows',
    edits: [
      {
        file: PAGE,
        find: '    : (countsOf(answer) ??\n      (!cardDimensionOn(filters) && answer.total <= answer.rows.length',
        replace: '    : (null ??\n      (answer.total >= 0',
      },
    ],
  },
  {
    name: 'partners-capped-list-without-counts-counts-the-rows-on-screen',
    breaks: [T_COUNTS],
    expect: '> an answer with no counts falls back to its rows only when they are the whole, unfiltered list',
    edits: [{ file: PAGE, find: 'answer.total <= answer.rows.length', replace: 'answer.total >= 0' }],
  },
  {
    name: 'partners-unknown-quiet-is-zero',
    breaks: [T_CARDS],
    expect: '> a figure the read did not give is not known, never 0',
    edits: [
      {
        file: KPI,
        find: "const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);",
        replace: "const num = (v: unknown): number | null => (typeof v === 'number' ? v : 0);",
      },
    ],
  },
  {
    name: 'partners-prospects-card-shows-the-active-count',
    breaks: [T_CARDS],
    expect: '> by the list read itself: asked for with the list’s own filters, and read off its answer',
    edits: [{ file: KPI, find: '    prospects: num(c.prospect),', replace: '    prospects: num(c.active),' }],
  },
  // ---- the database's own rule (QUIET-01, QUIET-02)
  {
    name: 'partners-quiet-forgets-its-days',
    breaks: ['sql:QUIET-01'],
    expect: 'the alert tells of the one quiet client',
    edits: [{ file: MIGRATION, find: "#>> '{}')::int, 60)", replace: "#>> '{}')::int, 60) - 60" }],
  },
  {
    name: 'partners-quiet-filter-is-ignored',
    breaks: ['sql:QUIET-01'],
    expect: 'the list filtered to quiet shows exactly the client the alert tells of',
    edits: [
      {
        file: MIGRATION,
        find: "        and (f ->> 'quiet' is null or (b.id in (select qc.partner_id from quiet qc)) = (f ->> 'quiet')::boolean)",
        replace: '',
      },
    ],
  },
  {
    name: 'partners-quiet-rows-are-not-flagged',
    breaks: ['sql:QUIET-01'],
    expect: 'and flags it quiet',
    edits: [
      {
        file: MIGRATION,
        find: 'case when v_quiet and h.id in (select qc.partner_id from quiet qc) then',
        replace: 'case when false then',
      },
    ],
  },
  {
    name: 'partners-counts-follow-the-pressed-card',
    breaks: ['sql:QUIET-02'],
    expect: 'a status card pressed: the figures stay',
    edits: [{ file: MIGRATION, find: '           from pre c))', replace: '           from hit c))' }],
  },
  {
    name: 'partners-counts-see-past-access',
    breaks: ['sql:QUIET-02'],
    expect: 'and without a side counts the one supplier they may see',
    edits: [
      {
        file: MIGRATION,
        find: "                 else partner.level_of(me, p.id) >= 'view' end",
        replace: "                 else (v_counts or partner.level_of(me, p.id) >= 'view') end",
      },
    ],
  },
  {
    name: 'partners-quiet-told-below-finance',
    breaks: ['sql:QUIET-02'],
    expect: 'a person below View on Finance gets the other figures, and quiet as not known',
    edits: [{ file: MIGRATION, find: " and authz.level_of(me, 'finance') >= 'view';", replace: ';' }],
  },
  // ---- the table fits its place
  {
    name: 'partners-table-keeps-every-column',
    breaks: [T_FITS],
    expect: '> Type goes first, then Owner, then Last activity',
    edits: [{ file: COLUMNS, find: 'if (width - used >= NAME_MIN) break;', replace: 'if (width > 0) break;' }],
  },
  {
    name: 'partners-table-drops-last-activity-first',
    breaks: [T_FITS],
    expect: '> Type goes first, then Owner, then Last activity',
    edits: [
      {
        file: COLUMNS,
        find: "const DROP_ORDER: HideableColumn[] = ['type', 'owner_id', 'last_activity_on'];",
        replace: "const DROP_ORDER: HideableColumn[] = ['last_activity_on', 'owner_id', 'type'];",
      },
    ],
  },
  {
    name: 'partners-narrow-place-keeps-the-table',
    breaks: [T_FITS],
    expect: '> under a table’s width the list is rows in one card',
    edits: [
      {
        file: COLUMNS,
        find: 'if (width < CARDS_UNDER) return { cards: true,',
        replace: 'if (width < 0) return { cards: true,',
      },
    ],
  },
  {
    name: 'partners-name-takes-more-than-is-left',
    breaks: [T_FITS],
    expect: '> never asks for more room than the place has, at any width from 600 to 1600',
    edits: [
      {
        file: COLUMNS,
        find: 'nameMax: Math.max(160, Math.min(NAME_MAX, width - used)) };',
        replace: 'nameMax: NAME_MAX };',
      },
    ],
  },
  // ---- every state in the new look
  {
    name: 'partners-cards-drawn-on-a-phone',
    breaks: [T_STATES],
    expect: '> a list with rows carries the four cards and the phone’s chips over it',
    edits: [
      {
        file: CARDS,
        find: '<ul className="grid grid-cols-2 gap-4 max-sm:hidden lg:grid-cols-4"',
        replace: '<ul className="grid grid-cols-2 gap-4 lg:grid-cols-4"',
      },
    ],
  },
  {
    name: 'partners-empty-side-draws-four-zeros',
    breaks: [T_STATES],
    expect: '> a side with no organisation yet says so with its one action, and no cards of four zeros',
    edits: [
      {
        file: LIST,
        find: 'const showCards = !!answer && !failed && !trulyEmpty;',
        replace: 'const showCards = !!answer && !failed;',
      },
    ],
  },
  {
    name: 'partners-filter-that-finds-nothing-reads-as-none-yet',
    breaks: [T_STATES],
    expect:
      '> a filter that finds nothing keeps the cards, so the one that is on can be pressed off, and offers Clear all',
    edits: [
      {
        file: LIST,
        find: 'const trulyEmpty = !!answer && answer.total === 0 && activeFilters === 0;',
        replace: 'const trulyEmpty = !!answer && answer.total === 0;',
      },
    ],
  },
  {
    name: 'partners-view-only-is-offered-new-on-an-empty-side',
    breaks: [T_STATES],
    expect: '> someone who may only view is not offered New there',
    edits: [
      {
        file: LIST,
        find: '              trulyEmpty ? (\n                full ? (',
        replace: '              trulyEmpty ? (\n                !!me ? (',
      },
    ],
  },
  {
    name: 'partners-failed-list-says-only-its-title',
    breaks: [T_STATES],
    expect: '> a list that could not be read says so with Try again, and draws no figures',
    edits: [{ file: LIST, find: "message={t('partners.list.failed')}", replace: 'message={undefined}' }],
  },
];
