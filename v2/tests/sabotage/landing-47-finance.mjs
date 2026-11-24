// Landing 47 (24 Nov) — Finance Part B on the screens: the marks on a Ledger row (deal type, paid-but-receivable, tax
// invoice issued, commission), "By deal type", the three cards beside the Ledger (agreement, ageing, held), a
// contract's payments, the commission on the New invoice form and the postpaid wallet rule. Each sabotage takes one
// promise back, and the test named must go red for it. The database's own rules are proven in supabase/tests/sabotage.
const MARKS = 'src/modules/finance/screens/DealMarks.tsx';
const DEAL = 'src/modules/finance/deal-type.ts';
const REPORT = 'src/modules/finance/screens/FinanceReport.tsx';
const LEDGER = 'src/modules/finance/ledger.ts';
const CHECKS = 'src/modules/finance/checks.ts';
const CARDS = 'src/modules/finance/screens/FinanceChecks.tsx';
const FORM = 'src/modules/finance/invoice-form.ts';
const CONTRACT = 'src/modules/finance/screens/ContractPayments.tsx';
const POSTPAID = 'src/modules/partners/postpaid.ts';
const ROWS = 'unit:tests/unit/finance/landing-47-every-ledger-row-says-its-deal-type.test.tsx';
const THREE = 'unit:tests/unit/finance/landing-47-finance-agrees-with-itself-what-is-owed-and-what-is-held.test.tsx';
const SMALL =
  'unit:tests/unit/finance/landing-47-a-commission-names-itself-a-contract-lists-its-payments-postpaid-has-no-top-up.test.tsx';

export const sabotages = [
  // ---------------------------------------------------------------- the marks on a row
  {
    name: 'l47-a-row-with-no-deal-type-says-nothing',
    breaks: [ROWS],
    expect: '> a row nothing settles says',
    edits: [
      {
        file: MARKS,
        find: '          <StatusChip tone="warning">{t(\'finance.ledger.deal.notSet\')}</StatusChip>',
        replace: '          {null}',
      },
    ],
  },
  {
    name: 'l47-every-row-says-receivable',
    breaks: [ROWS],
    expect: '> a counted postpaid row says Paid · receivable; no other row does',
    edits: [{ file: MARKS, find: '      {row.receivable ? (', replace: '      {row.deal_type ? (' }],
  },
  {
    name: 'l47-a-dpin-row-does-not-say-issued',
    breaks: [ROWS],
    expect: '> a row whose tax invoice is issued says so',
    edits: [
      { file: MARKS, find: '      {row.tax_invoice_issued ? (', replace: '      {row.tax_invoice_issued && !row ? (' },
    ],
  },
  {
    name: 'l47-a-commission-row-does-not-say-which',
    breaks: [ROWS],
    expect: '> a hand-typed commission says which commission it is',
    edits: [{ file: MARKS, find: '      {row.commission_type ? (', replace: '      {row.commission_type && !row ? (' }],
  },
  {
    name: 'l47-any-word-is-a-deal-type',
    breaks: [ROWS],
    expect: '> an answer with a word that is not a deal type',
    edits: [
      {
        file: DEAL,
        find: '  (DEAL_TYPES as readonly unknown[]).includes(v) ? (v as DealType) : null;',
        replace: "  typeof v === 'string' ? (v as DealType) : null;",
      },
    ],
  },
  // ---------------------------------------------------------------- by deal type
  {
    name: 'l47-the-deal-filter-hides-the-rows-not-set',
    breaks: [ROWS],
    expect: '> the filter keeps one deal type, or the rows that are not set',
    edits: [
      {
        file: DEAL,
        find: "  if (filter === 'none') return rows.filter((r) => !r.deal_type);",
        replace: "  if (filter === 'none') return [];",
      },
    ],
  },
  {
    name: 'l47-the-deal-sort-sorts-nothing',
    breaks: [ROWS],
    expect: '> the sort groups prepaid, postpaid, tender, promo, then not set',
    edits: [
      { file: DEAL, find: '    .sort((a, b) => a.o - b.o || a.i - b.i)', replace: '    .sort((a, b) => a.i - b.i)' },
    ],
  },
  {
    name: 'l47-a-deal-line-with-no-cost-says-zero',
    breaks: [ROWS],
    expect: '> reads the lines under the database’s own name',
    edits: [{ file: DEAL, find: '        cost: num(g.cost),', replace: '        cost: num(g.cost) ?? 0,' }],
  },
  {
    name: 'l47-anyone-is-offered-the-deal-type-control',
    breaks: [ROWS],
    expect: '> nobody else is offered it',
    edits: [
      {
        file: REPORT,
        find: '    report.canSetDealType === true && !!onSetDealType && !!r.number && (r.source',
        replace: '    !!onSetDealType && !!r.number && (r.source',
      },
    ],
  },
  {
    name: 'l47-the-file-drops-the-deal-type',
    breaks: [ROWS],
    expect: '> the file’s last column is the deal type',
    edits: [
      {
        file: LEDGER,
        find: "        ...(headers.dealType ? [r.deal_type ?? ''] : []),",
        replace: "        ...(headers.dealType ? [''] : []),",
      },
    ],
  },
  // ---------------------------------------------------------------- does Finance agree with itself?
  {
    name: 'l47-agrees-is-taken-on-trust',
    breaks: [THREE],
    expect: '> never takes “agrees” on trust',
    edits: [{ file: CHECKS, find: '    agrees: gaps.length === 0,', replace: '    agrees: a.agrees === true,' }],
  },
  {
    name: 'l47-a-bad-reconciliation-reads-as-agreement',
    breaks: [THREE],
    expect: '> an answer that is not the card’s shape is a failed read — never “Agrees”',
    edits: [
      {
        file: CHECKS,
        find: '  if (!a || !Array.isArray(a.gaps)) return null;',
        replace: '  if (!a) return null;\n  if (!Array.isArray(a.gaps)) a.gaps = [];',
      },
    ],
  },
  {
    name: 'l47-a-small-gap-loses-its-halalas',
    breaks: [THREE],
    expect: '> lists every gap with what it is, both figures and the difference',
    edits: [
      {
        file: CARDS,
        find: "    n === null ? t('finance.ledger.noCost') : whole ? formatNumber(n, locale) : formatMoney(n, locale, 2);",
        replace:
          "    n === null ? t('finance.ledger.noCost') : whole ? formatNumber(n, locale) : formatMoney(n, locale);",
      },
    ],
  },
  {
    name: 'l47-a-missing-cost-reads-zero-on-the-agreement-card',
    breaks: [THREE],
    expect: '> a cost with nothing behind it is a dash on both sides, never 0',
    edits: [
      {
        file: CHECKS,
        find: '    ledgerFigure === null && page === 0 ? null : page;',
        replace: '    ledgerFigure === null && page === null ? null : page;',
      },
    ],
  },
  // ---------------------------------------------------------------- outstanding and how old
  {
    name: 'l47-a-row-with-nothing-owed-is-listed',
    breaks: [THREE],
    expect: '> by invoice: its number, its age, its deal type and what it owes',
    edits: [
      {
        file: CHECKS,
        find: '    if (owed === null || owed <= 0) return [];',
        replace: '    if (owed === null) return [];',
      },
    ],
  },
  {
    name: 'l47-the-pursue-list-does-not-say-its-scope',
    breaks: [THREE],
    expect: '> opens as the postpaid pursue list and says so',
    edits: [
      {
        file: CARDS,
        find: "      data-ageing-scope={all ? 'all' : 'postpaid'}",
        replace: '      data-ageing-scope="all"',
      },
    ],
  },
  // ---------------------------------------------------------------- held
  {
    name: 'l47-a-held-reason-nobody-knows-is-dropped',
    breaks: [THREE],
    expect: '> a reason the card does not know fails the read',
    edits: [
      {
        file: CHECKS,
        find: '    if (!(HELD_REASONS as readonly unknown[]).includes(r?.reason)) return null;',
        replace: '    if (!(HELD_REASONS as readonly unknown[]).includes(r?.reason)) continue;',
      },
    ],
  },
  {
    name: 'l47-a-held-reason-counts-its-own-way',
    breaks: [THREE],
    expect: '> lists the held rows under their reason, with the reason’s own count and amount',
    edits: [
      {
        file: CARDS,
        find: '                  count: total?.units ?? rows.length,',
        replace: '                  count: rows.length + 1,',
      },
    ],
  },
  // ---------------------------------------------------------------- the commission, the contract, the wallet
  {
    name: 'l47-a-commission-is-sent-with-no-proof',
    breaks: [SMALL],
    expect: '> a commission with no proof is told so, on the proof field',
    edits: [
      {
        file: FORM,
        find: "  if (commissionOf(d) && d.commissionProof.trim() === '') out.push({ field: 'commissionProof', key: 'required' });",
        replace:
          "  if (commissionOf(d) && d.commissionProof === null) out.push({ field: 'commissionProof', key: 'required' });",
      },
    ],
  },
  {
    name: 'l47-a-monthly-invoice-names-a-commission',
    breaks: [SMALL],
    expect: '> a monthly invoice or a wallet top-up names no commission',
    edits: [
      {
        file: FORM,
        find: '  hasRevenue(d.kind) ? commissionTypeOf(d.commissionType) : null;',
        replace: '  commissionTypeOf(d.commissionType);',
      },
    ],
  },
  {
    name: 'l47-a-pending-invoice-is-not-marked-on-the-contract',
    breaks: [SMALL],
    expect: '> a document not yet counted is listed under its period, marked',
    edits: [
      {
        file: CONTRACT,
        find: '                  {v.counted ? null : <StatusChip tone="warning">{t(\'finance.ledger.notYetCountedPill\')}</StatusChip>}',
        replace: '                  {null}',
      },
    ],
  },
  {
    name: 'l47-a-quarter-is-named-as-a-month',
    breaks: [SMALL],
    expect: '> a quarter is named by its number and year',
    edits: [{ file: CHECKS, find: "  if (grain === 'quarter')", replace: "  if (grain === ('never' as string))" }],
  },
  {
    name: 'l47-an-organisation-with-both-kinds-loses-its-wallet',
    breaks: [SMALL],
    expect: '> keeps its wallet when it also holds a prepaid client ID',
    edits: [
      {
        file: POSTPAID,
        find: "  return ids.some((i) => i.subkind === 'postpaid') && !ids.some((i) => i.subkind === 'prepaid');",
        replace: "  return ids.some((i) => i.subkind === 'postpaid');",
      },
    ],
  },
];
