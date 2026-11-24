// Landing 47 (24 Nov) — Finance Part B, A3 + A4 on the import preview: an expense is keyed to a transaction number
// (never a tax invoice number) and its lines travel to the database, which counts each expense once. Each sabotage
// takes one promise back, and the test named must go red for it. The database's own rule is proven in
// supabase/tests/sabotage (CKY-01).
const NORMALISE = 'src/modules/imports/normalise.ts';
const SETTLE = 'src/modules/imports/expense-settle.ts';
const APPLY = 'src/modules/imports/apply.ts';
const UNIT = 'unit:tests/unit/imports/landing-47-an-expense-file-is-settled-by-the-database.test.ts';

export const sabotages = [
  {
    name: 'l47-an-expense-keyed-to-a-tax-invoice-is-read',
    breaks: [UNIT],
    expect: '> holds a line whose reference is a DPIN or a TTIN',
    edits: [
      {
        file: NORMALISE,
        find: '    if (isTaxInvoiceRef(ref)) {',
        replace: '    if (isTaxInvoiceRef(ref) && ref === "") {',
      },
    ],
  },
  {
    name: 'l47-the-expense-lines-do-not-travel',
    breaks: [UNIT],
    expect: '> carries each Approved line with its amount, approval time and expense type',
    edits: [{ file: NORMALISE, find: '    record.lines = group.items;\n', replace: '' }],
  },
  {
    name: 'l47-the-preview-shows-the-files-own-sum',
    breaks: [UNIT],
    expect: '> shows the cost the database answers',
    edits: [
      {
        file: SETTLE,
        find: '    outRecords.push(s.cost === null ? r : { ...r, cost: s.cost, expense_repeats: s.repeated });',
        replace: '    outRecords.push(r);',
      },
    ],
  },
  {
    name: 'l47-a-held-expense-stays-in-the-rows',
    breaks: [UNIT],
    expect: '> moves a row the database holds out of the rows',
    edits: [{ file: SETTLE, find: '    if (s.held) {', replace: '    if (s.held && r.rowNos.length === 0) {' }],
  },
  {
    name: 'l47-a-bad-settlement-is-an-empty-one',
    breaks: [UNIT],
    expect: '> is not an answer when it is not a list of rows',
    edits: [
      {
        file: SETTLE,
        find: '  if (!Array.isArray(answer)) return null;',
        replace: '  if (!Array.isArray(answer)) return [];',
      },
    ],
  },
  {
    name: 'l47-confirm-sends-no-expense-lines',
    breaks: [UNIT],
    expect: '> sends the lines on Confirm for an expense row',
    edits: [
      { file: APPLY, find: "      ...(record.kind === 'expense' ? { lines: record.lines } : {}),\n", replace: '' },
    ],
  },
];
