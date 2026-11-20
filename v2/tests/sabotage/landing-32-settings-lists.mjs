// Landing 32 (Finance F-B) — the exclusion list and the merge list in Settings → Finance: admins only, the lists draw
// what the reads return, Add needs a kind, a value and a reason (a merge also its organisation), a duplicate is said in
// words, and nothing is ever pre-filled. Each sabotage takes one of those back, and the test named must go red for it.
const RULE = 'src/modules/settings/finance-lists.ts';
const PARTS = 'src/modules/settings/screens/FinanceListParts.tsx';
const EXCLUSIONS = 'src/modules/settings/screens/ExclusionListCard.tsx';
const MERGES = 'src/modules/settings/screens/MergeListCard.tsx';
const PAGE = 'src/app/(app)/settings/[group]/page.tsx';
const LISTS =
  'unit:tests/unit/settings/the-finance-lists-show-what-the-reads-return-and-nothing-is-pre-filled.test.tsx';
const WHO = 'unit:tests/unit/settings/the-finance-lists-are-drawn-for-an-admin-only.test.tsx';

export const sabotages = [
  // ---- who sees the lists
  {
    name: 'finance-lists-anyone-with-a-role-sees-them',
    breaks: [WHO],
    expect: '> a manager, a head of department, a team member, a viewer and a person with no role do not',
    edits: [{ file: RULE, find: 'me.person.role?.is_admin === true', replace: 'me.person.role != null' }],
  },
  {
    name: 'finance-lists-on-every-settings-group',
    breaks: [WHO],
    expect: '> an admin on another Settings group sees neither card',
    edits: [
      { file: PAGE, find: 'const hasLists = showsFinanceLists(me, group);', replace: 'const hasLists = isAdmin(me);' },
    ],
  },
  {
    name: 'finance-lists-a-failed-read-arrives-as-an-empty-list',
    breaks: [WHO],
    expect: '> a read that fails reaches its card as null',
    edits: [
      {
        file: PAGE,
        find: "hasLists ? orNull(serverRpc('finance_exclusion_rules', {} as never) as Promise<unknown>) : null,",
        replace:
          "hasLists ? (serverRpc('finance_exclusion_rules', {} as never) as Promise<unknown>).catch(() => []) : null,",
      },
    ],
  },
  // ---- the lists draw what the reads return
  {
    name: 'exclusion-list-row-rules-mixed-into-the-list',
    breaks: [LISTS],
    expect: '> lists the rules made by Exclude on single Ledger rows apart',
    edits: [{ file: RULE, find: 'list: rules.filter((r) => r.row_level !== true),', replace: 'list: [...rules],' }],
  },
  {
    name: 'finance-lists-the-amount-is-not-written-as-money',
    breaks: [LISTS],
    expect: '> says what each rule catches now as "N rows · SAR amount"',
    edits: [{ file: PARTS, find: '{formatMoney(amount, locale)}', replace: '{amount}' }],
  },
  {
    name: 'exclusion-list-a-failed-read-is-drawn-as-empty',
    breaks: [LISTS],
    expect: '> a read that failed is said with Try again',
    edits: [{ file: EXCLUSIONS, find: ') : rules === null ? (', replace: ') : rules === undefined ? (' }],
  },
  {
    name: 'exclusion-list-the-sentence-is-gone',
    breaks: [LISTS],
    expect: '> carries the sentence that says what excluding does',
    edits: [{ file: EXCLUSIONS, find: "{t('settings.exclusions.about')}", replace: '{null}' }],
  },
  {
    name: 'merge-list-the-organisation-in-the-other-language',
    breaks: [LISTS],
    expect: '> names the organisation in the reader’s language',
    edits: [{ file: RULE, find: "locale === 'ar' && r.trade_name_ar", replace: "locale === 'en' && r.trade_name_ar" }],
  },
  {
    name: 'merge-list-a-failed-read-is-drawn-as-empty',
    breaks: [LISTS],
    expect: '> an empty list says "Nothing is merged yet."',
    edits: [{ file: MERGES, find: ') : rules === null ? (', replace: ') : rules === undefined ? (' }],
  },
  // ---- Add
  {
    name: 'finance-lists-add-without-a-reason',
    breaks: [LISTS],
    expect: '> needs a reason',
    edits: [
      {
        file: RULE,
        find: 'const hasReason = (reason: string) => reason.trim().length > 0;',
        replace: 'const hasReason = (reason: string) => reason.length >= 0;',
      },
    ],
  },
  {
    name: 'finance-lists-add-without-a-value',
    breaks: [LISTS],
    expect: '> needs a value',
    edits: [{ file: RULE, find: 'return v.length > 0 && (', replace: 'return v.length >= 0 && (' }],
  },
  {
    name: 'finance-lists-a-client-id-takes-letters',
    breaks: [LISTS],
    expect: '> a client ID is digits only',
    edits: [{ file: RULE, find: "if (kind !== 'client_id') return text;", replace: 'if (kind) return text;' }],
  },
  {
    name: 'merge-list-add-without-an-organisation',
    breaks: [LISTS],
    expect: '> a merge needs the organisation it is counted under',
    edits: [{ file: RULE, find: '    d.partner !== null &&\n', replace: '' }],
  },
  // ---- nothing is pre-filled
  {
    name: 'exclusion-list-the-add-dialog-opens-with-a-kind-chosen',
    breaks: [LISTS],
    expect: '> the add dialog of the exclusion list opens with no kind, no value and no reason',
    edits: [
      {
        file: RULE,
        find: "(): ExclusionDraft => ({ kind: '', value: '', reason: '' })",
        replace: "(): ExclusionDraft => ({ kind: 'client_id', value: '', reason: '' })",
      },
    ],
  },
  {
    name: 'merge-list-the-add-dialog-opens-with-a-kind-chosen',
    breaks: [LISTS],
    expect: '> the add dialog of the merge list opens with no kind, no value, no organisation and no reason',
    edits: [
      {
        file: RULE,
        find: "({ kind: '', value: '', partner: null, reason: '' })",
        replace: "({ kind: 'discount_code', value: '', partner: null, reason: '' })",
      },
    ],
  },
  // ---- a duplicate
  {
    name: 'finance-lists-a-duplicate-is-not-said-in-words',
    breaks: [LISTS],
    expect: '> a duplicate is said in words',
    edits: [{ file: RULE, find: 'errorKey(e, words.has)', replace: 'errorKey(e, () => false)' }],
  },
];
