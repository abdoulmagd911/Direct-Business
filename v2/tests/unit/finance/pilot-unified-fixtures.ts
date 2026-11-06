// Pilot unified-read fixtures: TEST companies only, no real data, no
// customer names, emails or phones anywhere. Three companies, each with
// more than one Direct payment client id, across prepaid, postpaid and
// tender — the pilot shape the owner approved.
//
// Code text is NOT unique: the same text appears under two different
// code ids on purpose, so a test that keys by text alone would merge
// two different codes. The unified read keys imported rows by their
// import row (and, for a code view, by text — the known limit written
// up in NOTES.md), never by pretending one text is one code.

import type { UnifiedInputRow } from '@/modules/finance/unified';

export const pilotAlphaId = '11111111-1111-4111-8111-111111111111';
export const pilotBetaId = '22222222-2222-4222-8222-222222222222';
export const pilotGammaId = '33333333-3333-4333-8333-333333333333';

// TEST company A: prepaid + postpaid client ids.
export const pilotAlpha = {
  id: pilotAlphaId,
  clientIds: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'prepaid', value: 'PRE-1001' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'postpaid', value: 'POST-1002' },
  ],
};

// TEST company B: postpaid + tender client ids.
export const pilotBeta = {
  id: pilotBetaId,
  clientIds: [
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', kind: 'postpaid', value: 'POST-2001' },
    { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', kind: 'tender', value: 'TENDER-2002' },
  ],
};

// TEST company C: prepaid + tender client ids.
export const pilotGamma = {
  id: pilotGammaId,
  clientIds: [
    { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', kind: 'prepaid', value: 'PRE-3001' },
    { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', kind: 'tender', value: 'TENDER-3002' },
  ],
};

// Two different code ids carrying the same text, on purpose.
export const pilotCodeOne = {
  id: '10101010-1010-4101-8101-010101010101',
  code: 'TESTSAVE20',
};
export const pilotCodeTwo = {
  id: '20202020-2020-4202-8202-020202020202',
  code: 'TESTSAVE20',
};

function row(partial: Partial<UnifiedInputRow> & { key: string }): UnifiedInputRow {
  return {
    source: 'manual',
    partnerId: null,
    createdOn: '2026-11-01',
    transactionNumber: null,
    invoiceNumber: null,
    revenue: null,
    cost: null,
    profit: null,
    counted: true,
    isPromo: false,
    code: null,
    discount: null,
    ...partial,
  };
}

/** One manually recorded, fully paid row with an approved cost. */
export const manualRow: UnifiedInputRow = row({
  key: 'manual-1',
  source: 'manual',
  partnerId: pilotAlphaId,
  transactionNumber: '1163000001',
  invoiceNumber: '1163000001',
  revenue: 1000,
  cost: 200,
  profit: 800,
});

/** One imported, fully paid row with an approved cost. */
export const importRow: UnifiedInputRow = row({
  key: 'import-1',
  source: 'import',
  partnerId: pilotBetaId,
  transactionNumber: '1163000002',
  invoiceNumber: '1163000002',
  revenue: 500,
  cost: 100,
  profit: 400,
});

/** The same imported money seen twice (a re-import, or an invoice-only
 *  row beside its transaction row): the second copy must not count. */
export const importRowDuplicate: UnifiedInputRow = row({
  ...importRow,
  key: 'import-1',
});

/** An imported row that is not fully paid: it must never count. */
export const importRowNotPaid: UnifiedInputRow = row({
  key: 'import-2',
  source: 'import',
  partnerId: pilotGammaId,
  transactionNumber: '1163000003',
  invoiceNumber: '1163000003',
  revenue: 900,
  cost: 300,
  profit: 600,
  counted: false,
});

/** An imported row carrying a discount-code attribution: on a plain
 *  view it must never enter the company's totals. */
export const importPromoRow: UnifiedInputRow = row({
  key: 'import-3',
  source: 'import',
  partnerId: pilotAlphaId,
  transactionNumber: '1163000004',
  invoiceNumber: '1163000004',
  revenue: 400,
  cost: 50,
  profit: 350,
  isPromo: true,
  code: pilotCodeOne.code,
  discount: 80,
});

/** An imported, fully paid row with no approved cost yet: its cost and
 *  profit stay empty, never 0. */
export const importRowNoCost: UnifiedInputRow = row({
  key: 'import-4',
  source: 'import',
  partnerId: pilotGammaId,
  transactionNumber: '1163000005',
  invoiceNumber: '1163000005',
  revenue: 700,
  cost: null,
  profit: null,
});

export const pilotUnifiedRows: UnifiedInputRow[] = [
  manualRow,
  importRow,
  importRowDuplicate,
  importRowNotPaid,
  importPromoRow,
  importRowNoCost,
];
