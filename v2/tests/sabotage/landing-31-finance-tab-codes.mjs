// Landing 31 (the V21 re-skin) — a partner's Finance tab and the Discount codes page in the Finance page's look.
// Each sabotage takes one thing of the new look, or one behaviour it must keep, back; the test named must go red.
const TABS = 'src/modules/partners/screens/record/CompanyTabs.tsx';
const CODES = 'src/modules/codes/screens/CodesScreen.tsx';
const TAB_TEST = 'unit:tests/unit/partners/the-partner-finance-tab-wears-the-finance-look.test.tsx';
const CODES_TEST = 'unit:tests/unit/codes/a-code-opens-as-its-own-page-in-the-finance-look.test.tsx';

export const sabotages = [
  // ---- the partner's Finance tab
  {
    name: 'l31-tab-revenue-loses-its-green',
    breaks: [TAB_TEST],
    expect:
      '> shows the totals of the rows read as four cards, Revenue in the Revenue green and no other figure coloured',
    edits: [
      {
        file: TABS,
        find: '                tone="success"\n                icon={<Banknote />}',
        replace: '                icon={<Banknote />}',
      },
    ],
  },
  {
    name: 'l31-tab-missing-cost-says-nothing',
    breaks: [TAB_TEST],
    expect: '> a figure with no source is a dash with the words under it, never 0',
    edits: [
      {
        file: TABS,
        find: "cost === null ? (withoutCost > 0 ? t('partners.companyFinance.costMissing') : notKnown) : undefined",
        replace: 'undefined',
      },
    ],
  },
  {
    name: 'l31-tab-every-row-reads-recorded-here',
    breaks: [TAB_TEST],
    expect: '> names each row’s source on a pill and lists every row read',
    edits: [
      {
        file: TABS,
        // the main list's pill (the "Not counted" list below it has one too, two columns deeper)
        find: "\n                          {t(r.source === 'import' ? 'finance.ledger.sourceImport' : 'finance.ledger.sourceManual')}",
        replace: "\n                          {t('finance.ledger.sourceManual')}",
      },
    ],
  },
  {
    name: 'l31-tab-switch-reads-backwards',
    breaks: [TAB_TEST],
    expect:
      '> the one-word switch "Imported" is on while the imported rows show, and turning it off asks for the same hideImported filter',
    edits: [{ file: TABS, find: '            checked={!hide}', replace: '            checked={hide}' }],
  },
  {
    name: 'l31-tab-switch-keeps-the-old-sentence',
    breaks: [TAB_TEST],
    expect: '> opens off when the address carries the filter, in Arabic under the board’s word',
    edits: [
      {
        file: TABS,
        find: "            label={t('partners.companyFinance.imported')}",
        replace: "            label={t('partners.companyFinance.hideImported')}",
      },
    ],
  },
  {
    name: 'l31-tab-loading-has-no-card-skeleton',
    breaks: [TAB_TEST],
    expect: '> draws the loading read as a skeleton of the cards, with no figure',
    edits: [
      { file: TABS, find: '                {[0, 1, 2, 3].map((i) => (', replace: '                {[0].map((i) => (' },
    ],
  },
  {
    name: 'l31-tab-failed-ledger-has-no-try-again',
    breaks: [TAB_TEST],
    expect: '> a failed ledger read says so with Try again, and draws no figure',
    edits: [
      {
        file: TABS,
        find: "          onRetry={ledger.block.status === 'failed' ? ledger.retry : undefined}",
        replace: '          onRetry={undefined}',
      },
    ],
  },
  {
    name: 'l31-tab-closed-money-is-drawn',
    breaks: [TAB_TEST],
    expect:
      '> a partner whose money is not open to the reader says no access, and a summary that failed offers Try again',
    edits: [
      {
        file: TABS,
        find: '  if (!summary.finance_visible || summary.wallet === null || summary.finance === null) {',
        replace: '  if (summary.wallet === null || summary.finance === null) {',
      },
    ],
  },
  {
    name: 'l31-tab-all-counted-is-not-said',
    breaks: [TAB_TEST],
    expect: '> shows the client IDs as tags and an empty wallet in words',
    edits: [
      {
        file: TABS,
        find: "            {notCounted.block.status === 'ready' && allCounted ? (",
        replace: "            {notCounted.block.status === 'ready' && !allCounted ? (",
      },
    ],
  },
  // ---- the Discount codes list
  {
    name: 'l31-codes-every-pill-carries-the-whole-count',
    breaks: [CODES_TEST],
    expect: '> says how many codes there are and carries each state’s count on its pill',
    edits: [
      {
        file: CODES,
        find: '<span className="font-data text-xs tabular">{counts[s]}</span>',
        replace: '<span className="font-data text-xs tabular opacity-80">{counts.all}</span>',
      },
    ],
  },
  {
    name: 'l31-codes-pills-keep-the-chip-words-in-arabic',
    breaks: [CODES_TEST],
    expect: '> counts in Arabic with the board’s words',
    edits: [{ file: CODES, find: '{t(`pages.codes.filterPill.${s}`)}', replace: '{t(`pages.codes.filter.${s}`)}' }],
  },
  {
    name: 'l31-codes-row-opens-by-its-text',
    breaks: [CODES_TEST],
    expect: '> a code’s text opens its page, and each row shows the read’s own figures',
    edits: [{ file: CODES, find: 'href={`/codes?code=${row.id}`}', replace: 'href={`/codes?code=${row.code}`}' }],
  },
  {
    name: 'l31-codes-failed-list-still-counts',
    breaks: [CODES_TEST],
    expect: '> a list that failed says so with Try again and claims no count',
    edits: [{ file: CODES, find: 'meta={listFailed ? undefined : ', replace: 'meta={' }],
  },
  // ---- a code as its own page
  {
    name: 'l31-code-is-drawn-under-the-list-again',
    breaks: [CODES_TEST],
    expect: '> is drawn alone, with the way back in its trail',
    edits: [
      {
        file: CODES,
        find: '      {selectedId ? detailView() : listView()}',
        replace: '      {listView()}\n      {selectedId ? detailView() : null}',
      },
    ],
  },
  {
    name: 'l31-code-collected-loses-its-green',
    breaks: [CODES_TEST],
    expect: '> shows its totals as five cards, what was collected in the Revenue green, an empty total as a dash',
    edits: [
      {
        file: CODES,
        find: '            tone="success"\n            icon={<Banknote />}',
        replace: '            icon={<Banknote />}',
      },
    ],
  },
  {
    name: 'l31-code-ledger-loses-its-order',
    breaks: [CODES_TEST],
    expect: '> keeps one ledger, the counted uses first; a use that is not counted says so and carries no figure',
    edits: [
      {
        file: CODES,
        find: '  const ledgerRows = [...counted, ...notCounted];',
        replace: '  const ledgerRows = detail?.ledger ?? [];',
      },
    ],
  },
  {
    name: 'l31-code-uncounted-use-shows-its-discount',
    breaks: [CODES_TEST],
    expect: '> keeps one ledger, the counted uses first; a use that is not counted says so and carries no figure',
    edits: [
      {
        file: CODES,
        find: '                        {l.counted ? (\n                          <Money value={formatMoney(l.discount_sar, locale)} currency={sar} />',
        replace:
          '                        {l.use_id ? (\n                          <Money value={formatMoney(l.discount_sar, locale)} currency={sar} />',
      },
    ],
  },
  {
    name: 'l31-code-uncounted-use-says-no-reason',
    breaks: [CODES_TEST],
    expect: '> keeps one ledger, the counted uses first; a use that is not counted says so and carries no figure',
    edits: [
      {
        file: CODES,
        find: "const why = [l.status_word, l.excluded_reason].filter(Boolean).join(' · ');",
        replace: "const why = [l.excluded_reason].filter(Boolean).join(' · ');",
      },
    ],
  },
  {
    name: 'l31-code-empty-ledger-says-nothing',
    breaks: [CODES_TEST],
    expect: '> says so when no use is counted yet',
    edits: [{ file: CODES, find: '          {counted.length === 0 ? (', replace: '          {counted.length < 0 ? (' }],
  },
  {
    name: 'l31-code-reader-may-remove-a-use',
    breaks: [CODES_TEST],
    expect: '> keeps the in-app actions for Full, and offers none to a reader',
    edits: [
      {
        file: CODES,
        find: "                      {full ? (\n                        <td className={cn(TD_4, '@4xl:text-end')}>",
        replace:
          "                      {l.use_id ? (\n                        <td className={cn(TD_4, '@4xl:text-end')}>",
      },
    ],
  },
  {
    name: 'l31-code-failed-read-loses-the-way-back',
    breaks: [CODES_TEST],
    expect: '> a code that failed to read keeps the way back, Try again and the error’s kind beside it',
    edits: [
      {
        file: CODES,
        find: "          crumbs={[{ label: t('nav.codes'), href: '/codes' }, { label: t('pages.codes.detail.title') }]}",
        replace: '          crumbs={[]}',
      },
    ],
  },
  {
    name: 'l31-code-pills-keep-the-old-arabic',
    breaks: [CODES_TEST],
    expect: '> reads in Arabic with the reader’s currency word and the board’s pills',
    edits: [
      {
        file: CODES,
        find: "{t(l.counted ? 'pages.codes.detail.countedPill' : 'pages.codes.detail.notCountedPill')}",
        replace: "{t(l.counted ? 'pages.codes.detail.notCounted' : 'pages.codes.detail.notCounted')}",
      },
    ],
  },
];
