// Import engine v2, workstream D: signature registry, Fully Paid gate, normalisers,
// five-count preview, and ledger figures. Pure functions only — no database, no network —
// so the review screen, the unit tests, and the database apply step all check the same
// rules. The database side lives in 20261104130000_work_import_engine.sql.

export { parseCsv } from './csv';
export { existingFromImportLedger, toApplyPayload } from './apply';
export type { ApplyRow, ImportLedgerRecord } from './apply';
export { SIGNATURES, detectSignature, headerKey, signatureByKey, templateHeaders } from './signatures';
export type { Detection, Signature, SignatureKey } from './signatures';
export { parseDate, parseIssuedInvoice, parseMoney, roundMoney, tenDigitRef } from './money';
export { fullyPaidVerdict, isApprovedExpense } from './paid';
export type { PaidVerdict } from './paid';
export { WHY, whyOf, whyText } from './reasons';
export type { Why, WhyCode } from './reasons';
export { normaliseFile } from './normalise';
export type { HeldRow, NormaliseOptions, NormaliseResult, NormalisedRow } from './normalise';
export { buildPreview, mergedRecord } from './preview';
export type {
  ExistingRecord,
  Preview,
  PreviewChange,
  PreviewCounts,
  PreviewDecisions,
  PreviewOutcome,
  PreviewRow,
} from './preview';
export { deriveFigures, ledgerBuckets } from './ledger';
export type { LedgerFigures, LedgerRecord, LedgerTotals } from './ledger';
