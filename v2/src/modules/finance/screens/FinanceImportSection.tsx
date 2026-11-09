'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { refetchAll } from '@/core/commands/refetch';
import { browserDb } from '@/core/db/client';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { formatDate } from '@/core/i18n/format';
import { recordFileDownloadUrl } from '@/core/files/download-url';
import { sha256HexFile } from '@/ui/record/FilesSection';
import {
  buildPreview,
  detectSignature,
  existingFromImportLedger,
  normaliseFile,
  parseCsv,
  toApplyPayload,
  type Detection,
  type ExistingRecord,
  type HeldRow,
  type NormalisedRow,
  type Preview,
  type PreviewCounts,
  type PreviewDecisions,
  type Signature,
} from '@/modules/imports';
import { PartnerPicker } from '@/modules/my-day/screens/PartnerPicker';
import type { PartnerRef } from '@/modules/my-day/types';
import { Button, buttonVariants } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { FileLinkButton } from '@/ui/record/FileLinkButton';
import { Input } from '@/ui/Input';
import { toast } from '@/ui/Toast';

type Stage = 'pick' | 'unknown' | 'preview' | 'confirmed';

const OUTCOME_KEY = {
  new: 'new',
  updated: 'updated',
  unchanged: 'unchanged',
  excluded: 'excluded',
  needs_linking: 'needsLinking',
} as const;

/** One past import batch, as api.import_batches answers it (F177): the outcome snapshot the apply step wrote. */
type PastBatch = {
  id: string;
  file_name: string;
  signature: string;
  source_promo: string | null;
  status: string;
  counts: PreviewCounts;
  problems: { row_no: number; reason: string }[];
  created_at: string;
  created_by_name: string | null;
  source_file_id: string | null;
  source_file_name: string | null;
};

/** One record a past batch first wrote, as api.import_batch_rows answers it — as it stands now, after any later
 * import that updated it; the batch's counts snapshot is the reliable per-batch totals record. */
type PastBatchRow = {
  kind: string;
  transaction_ref: string | null;
  invoice_ref: string | null;
  record_date: string | null;
  amount_sar: number | null;
  status_text: string | null;
};

/** The preview's changed-field names, as import.change.* message keys (F182). */
const CHANGE_KEY: Record<string, string> = {
  amount: 'amount',
  'wallet part': 'walletPart',
  cost: 'cost',
  status: 'status',
  'tax number': 'taxNumber',
  date: 'date',
  'transaction number': 'transactionNumber',
  'invoice number': 'invoiceNumber',
  'discount code': 'discountCode',
  service: 'service',
};

/** A changed value, as shown: empty stays a dash, never a blank or a guessed 0. */
const changeValue = (v: unknown) => (v === null || v === undefined ? '—' : String(v));

/**
 * Importing a Direct export, on the Finance page (the imports module's page is Finance, where the import preview
 * lives). One batch belongs to exactly one partner: the partner is picked first, then a file. The file is read in
 * the browser, recognised by its column signature, and previewed with the five counts — nothing is written until
 * Confirm. A promo file has no code column, so the code text is recorded here before the preview can run, and the
 * upload is refused without it. Held rows are shown with their reasons and never written.
 */
export function FinanceImportSection() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [partner, setPartner] = useState<PartnerRef | null>(null);
  const [fileName, setFileName] = useState('');
  // The original file, kept from pick time: the import only reads its text, so without this the source file could
  // never be stored or re-downloaded afterwards.
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [storedFile, setStoredFile] = useState<{ id: string; name: string } | null>(null);
  const [sourceFileFailed, setSourceFileFailed] = useState(false);
  const [storingFile, setStoringFile] = useState(false);
  const [stage, setStage] = useState<Stage>('pick');
  const [detection, setDetection] = useState<Detection | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [emptyFile, setEmptyFile] = useState(false);
  const [parsed, setParsed] = useState<{ header: string[]; rows: string[][] } | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [existing, setExisting] = useState<ExistingRecord[]>([]);
  const [records, setRecords] = useState<NormalisedRow[]>([]);
  const [held, setHeld] = useState<HeldRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<PreviewDecisions>({});
  const [loading, setLoading] = useState(false);
  const [existingFailed, setExistingFailed] = useState(false);
  const [fileProblem, setFileProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<PreviewCounts | null>(null);
  // Past imports for the picked partner (F177): the batches this partner already confirmed, re-viewable with
  // their counts, held rows and source file. Null until read; a failed read shows a line, never blocks the import.
  const [batches, setBatches] = useState<PastBatch[] | null>(null);
  const [batchesFailed, setBatchesFailed] = useState(false);
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<PastBatchRow[] | null>(null);
  const [batchRowsFailed, setBatchRowsFailed] = useState(false);
  // The preview read's generation (F180): a Start over, a partner change or a newer preview supersedes a read
  // still in flight, and its late answer must not resurrect the cleared preview.
  const previewGen = useRef(0);

  // The derived import state, without touching the file input element (F181): picking a file must not wipe the
  // control that shows its name. Start over and partner change use resetFile, which clears the input too.
  const resetDerived = () => {
    setFileName('');
    setSourceFile(null);
    setBatchId(null);
    setStoredFile(null);
    setSourceFileFailed(false);
    setStoringFile(false);
    setDetection(null);
    setSignature(null);
    setEmptyFile(false);
    setParsed(null);
    setCode('');
    setCodeError('');
    setExisting([]);
    setRecords([]);
    setHeld([]);
    setPreview(null);
    setDecisions({});
    setLoading(false);
    setExistingFailed(false);
    setFileProblem('');
    setConfirmed(null);
    setStage('pick');
  };

  const resetFile = () => {
    previewGen.current += 1;
    if (fileRef.current) fileRef.current.value = '';
    resetDerived();
  };

  const loadBatches = async (partnerId: string) => {
    try {
      const answer = (await rpc('import_batches', { p_partner: partnerId }, { retry: true })) as unknown as PastBatch[];
      setBatches(Array.isArray(answer) ? answer : []);
    } catch {
      setBatchesFailed(true);
    }
  };

  useEffect(() => {
    if (!partner) return;
    // The first read runs after the paint (the compiler's rule: no state set inside the effect itself).
    queueMicrotask(() => void loadBatches(partner.id));
    // The partner's id only: the picker hands a fresh object per pick, and the batches belong to the partner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);

  const toggleBatch = async (batch: PastBatch) => {
    if (openBatch === batch.id) {
      setOpenBatch(null);
      setBatchRows(null);
      return;
    }
    setOpenBatch(batch.id);
    setBatchRows(null);
    setBatchRowsFailed(false);
    try {
      const answer = (await rpc(
        'import_batch_rows',
        { p_batch: batch.id },
        { retry: true },
      )) as unknown as PastBatchRow[];
      setBatchRows(Array.isArray(answer) ? answer : []);
    } catch {
      setBatchRowsFailed(true);
    }
  };

  const runPreview = async (sig: Signature, header: string[], rows: string[][], codeText: string | null) => {
    if (!partner) return;
    const gen = ++previewGen.current;
    setLoading(true);
    setExistingFailed(false);
    try {
      const answer = await rpc('import_ledger', { p_partner: partner.id });
      // A Start over (or a newer preview) landed while this read was in flight: its answer is stale, and
      // applying it would resurrect the cleared preview (F180). Drop it silently.
      if (gen !== previewGen.current) return;
      const stored = existingFromImportLedger(answer);
      const norm = normaliseFile(sig.key, header, rows, { sourcePromo: codeText });
      if (norm.fileProblem) {
        setFileProblem(norm.fileProblem);
        return;
      }
      setExisting(stored);
      setRecords(norm.records);
      setHeld(norm.held);
      setDecisions({});
      setPreview(buildPreview(stored, norm.records, norm.held, {}));
      setStage('preview');
    } catch {
      if (gen === previewGen.current) setExistingFailed(true);
    } finally {
      if (gen === previewGen.current) setLoading(false);
    }
  };

  // Store the import's source file against its batch (kind import_file, restricted): register, store, finish —
  // the same doors the record Files sections use. A failure here never blocks the import itself; the confirmed
  // view says the file was not stored and offers a retry from the file still held in state.
  const storeSourceFile = async (batch: string, file: File) => {
    setStoringFile(true);
    setSourceFileFailed(false);
    try {
      const begun = (await rpc('file_begin', {
        p_entity: 'import_batch',
        p_id: batch,
        p_kind: 'import_file',
        p_purpose: 'attachment',
        p_original_name: file.name,
        p_size: file.size,
        p_mime: file.type || 'text/csv',
        p_sensitivity: 'restricted',
      })) as unknown as { id: string; bucket: string; path: string };
      const stored = await browserDb().storage.from(begun.bucket).upload(begun.path, file);
      if (stored.error) throw stored.error;
      await rpc('file_finish', { p_id: begun.id, p_sha256: await sha256HexFile(file) });
      setStoredFile({ id: begun.id, name: file.name });
    } catch {
      setSourceFileFailed(true);
    } finally {
      setStoringFile(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file || !partner) return;
    // Reset the derived state only (F181): clearing the input element here would wipe the just-picked file out
    // of the control, which would read "No file chosen" although the file was accepted.
    resetDerived();
    setFileName(file.name);
    setSourceFile(file);
    const text = await file.text();
    const all = parseCsv(text);
    const header = all[0] ?? [];
    const rows = all.slice(1);
    setParsed({ header, rows });
    if (all.length === 0 || (all.length === 1 && header.every((h) => h.trim() === ''))) {
      setEmptyFile(true);
      setDetection({ recognised: false, columns: [], reason: 'unknown' });
      setStage('unknown');
      return;
    }
    const found = detectSignature(header);
    setDetection(found);
    if (!found.recognised) {
      setStage('unknown');
      return;
    }
    setSignature(found.signature);
    if (found.signature.kind === 'promo') {
      // The code text is recorded before the preview can run: the file has no code column.
      setStage('preview');
      return;
    }
    await runPreview(found.signature, header, rows, null);
  };

  const onReview = async () => {
    if (!signature || !parsed) return;
    if (signature.kind === 'promo' && code.trim() === '') {
      setCodeError(t('import.noCodeForFile'));
      return;
    }
    setCodeError('');
    await runPreview(signature, parsed.header, parsed.rows, signature.kind === 'promo' ? code.trim() : null);
  };

  const onKeepDuplicate = (rowNo: number, keep: boolean) => {
    const next: PreviewDecisions = { ...decisions, [rowNo]: keep ? 'keep' : 'skip' };
    setDecisions(next);
    setPreview(buildPreview(existing, records, held, next));
  };

  const onConfirm = async () => {
    if (!partner || !signature || !preview || busy) return;
    setBusy(true);
    try {
      const batch = (await rpc('import_batch_start', {
        p_partner: partner.id,
        p_signature: signature.key,
        p_file_name: fileName,
        ...(signature.kind === 'promo' ? { p_source_promo: code.trim() } : {}),
      })) as { id?: string } | null;
      const batchId = batch?.id;
      if (!batchId) throw new Error('import_batch_start answered without a batch id');
      setBatchId(batchId);
      if (sourceFile) await storeSourceFile(batchId, sourceFile);
      const payload = toApplyPayload(preview, records, decisions);
      const done = (await rpc('import_apply', {
        p_batch: batchId,
        p_rows: payload.rows as never,
        p_held: payload.held as never,
        p_decisions: payload.decisions as never,
      })) as { counts?: PreviewCounts } | null;
      setConfirmed(done?.counts ?? preview.counts);
      toast.done(t('import.confirmed'));
      refetchAll();
      setStage('confirmed');
    } catch (e) {
      const { key, detail } = errorKey(e, (k) => t.has(k));
      toast.failed(t(key, { detail }));
    } finally {
      setBusy(false);
    }
  };

  const counts = (c: PreviewCounts) => (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-import-counts>
      {(
        [
          ['new', c.new],
          ['updated', c.updated],
          ['unchanged', c.unchanged],
          ['excluded', c.excluded],
          ['needsLinking', c.needs_linking],
        ] as const
      ).map(([key, n]) => (
        <li key={key}>
          <span className="text-muted">{t(`import.${key}`)}: </span>
          <span className="font-data tabular font-semibold">{n}</span>
        </li>
      ))}
    </ul>
  );

  // A changed field's label (F182): the message key when one exists, else the field's own plain name.
  const changeLabel = (field: string) => {
    const key = CHANGE_KEY[field];
    return key && t.has(`import.change.${key}`) ? t(`import.change.${key}`) : field;
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="finance-import" data-finance-import-section>
      <h2 id="finance-import" className="font-display text-lg font-semibold">
        {t('import.title')}
      </h2>
      <p className="text-sm text-muted">{t('import.nothingSavedYet')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('import.choosePartner')} className="min-w-[16rem] flex-1">
          {({ id }) => (
            <PartnerPicker
              id={id}
              value={partner}
              onChange={(p) => {
                resetFile();
                // The past batches belong to the picked partner: a cleared or changed partner clears them.
                setBatches(null);
                setBatchesFailed(false);
                setOpenBatch(null);
                setBatchRows(null);
                setPartner(p);
              }}
            />
          )}
        </Field>
        <Field label={t('import.chooseFile')} className="min-w-[16rem] flex-1">
          {({ id }) => (
            <Input
              id={id}
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              disabled={!partner}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              data-import-file
            />
          )}
        </Field>
      </div>

      {partner ? (
        <div className="flex flex-col gap-2" data-import-past>
          <h3 className="text-sm font-semibold">{t('import.pastTitle')}</h3>
          {batchesFailed ? (
            <p role="alert" className="text-sm text-danger">
              {t('import.pastFailed')}{' '}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBatchesFailed(false);
                  void loadBatches(partner.id);
                }}
              >
                {t('state.tryAgain')}
              </Button>
            </p>
          ) : null}
          {batches === null && !batchesFailed ? (
            <p className="text-sm text-muted">{t('state.loading', { what: t('import.pastTitle') })}</p>
          ) : null}
          {batches?.length === 0 ? <p className="text-sm text-muted">{t('import.pastNone')}</p> : null}
          {batches?.map((batch) => (
            <div key={batch.id} className="rounded border border-line p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void toggleBatch(batch)}
                aria-expanded={openBatch === batch.id}
              >
                {batch.file_name} · {formatDate(batch.created_at, locale)} ·{' '}
                {batch.status === 'confirmed' ? t('import.confirmed') : t('import.pastDraft')}
                {batch.created_by_name ? ` · ${batch.created_by_name}` : ''}
              </Button>
              {openBatch === batch.id ? (
                <div className="mt-2 flex flex-col gap-2 text-sm">
                  <p className="text-muted">
                    {t(`import.signature.${batch.signature}`)}
                    {batch.source_promo ? ` · ${batch.source_promo}` : ''}
                  </p>
                  {counts(batch.counts)}
                  {batch.problems.length > 0 ? (
                    <div>
                      <p className="font-medium">{t('import.held')}</p>
                      <ul className="list-disc ps-5 text-muted">
                        {batch.problems.map((p) => (
                          <li key={p.row_no}>
                            {t('import.row')} {p.row_no}: {p.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {batch.source_file_id ? (
                    <p className="flex flex-wrap items-center gap-3">
                      <span className="text-muted">{t('import.sourceFile')}:</span>
                      <a
                        href={recordFileDownloadUrl(batch.source_file_id!, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        {t('record.files.download')}
                      </a>
                      <FileLinkButton fileId={batch.source_file_id} size="sm" />
                    </p>
                  ) : null}
                  {batchRowsFailed ? (
                    <p role="alert" className="text-sm text-danger">
                      {t('import.pastRowsFailed')}
                    </p>
                  ) : null}
                  {batchRows === null && !batchRowsFailed ? (
                    <p className="text-sm text-muted">{t('state.loading', { what: t('import.pastRows') })}</p>
                  ) : null}
                  {batchRows && batchRows.length > 0 ? (
                    <div>
                      <p className="font-medium">{t('import.pastRows')}</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line text-start text-muted">
                            <th className="px-2 py-1 font-medium">{t('import.reference')}</th>
                            <th className="px-2 py-1 font-medium">{t('import.pastDate')}</th>
                            <th className="px-2 py-1 font-medium">{t('import.pastAmount')}</th>
                            <th className="px-2 py-1 font-medium">{t('import.pastStatus')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchRows.map((row, i) => (
                            <tr key={`${row.transaction_ref ?? row.invoice_ref ?? i}`} className="border-b border-line">
                              <td className="px-2 py-1 font-data tabular">
                                {row.transaction_ref ?? row.invoice_ref ?? '—'}
                              </td>
                              <td className="px-2 py-1">
                                {row.record_date ? formatDate(row.record_date, locale) : '—'}
                              </td>
                              <td className="px-2 py-1 font-data tabular">
                                {row.amount_sar === null ? '—' : row.amount_sar}
                              </td>
                              <td className="px-2 py-1">{row.status_text ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {loading ? <DataState kind="loading" what={t('import.title')} /> : null}

      {stage === 'unknown' && detection && !detection.recognised ? (
        <div className="flex flex-col gap-3" data-import-unknown>
          <p role="alert" className="text-sm text-danger">
            {emptyFile
              ? t('import.emptyFile')
              : detection.reason === 'binary'
                ? t('import.binaryFile')
                : detection.reason === 'own_report'
                  ? t('import.ownReport')
                  : t('import.unknownSignature')}
          </p>
          {!emptyFile && detection.reason === 'unknown' ? (
            <p className="text-sm text-muted">{t('import.unknownSignatureBody')}</p>
          ) : null}
          {detection.reason === 'unknown' && detection.columns.length ? (
            <>
              <h3 className="text-sm font-medium">{t('import.columns')}</h3>
              <ul className="flex flex-wrap gap-2">
                {detection.columns.map((c, i) => (
                  <li
                    key={`${i}:${c}`}
                    className="rounded-md border border-border bg-raised px-2 py-1 font-data text-sm"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div>
            <Button variant="secondary" onClick={resetFile} data-import-start-over>
              {t('import.startOver')}
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'preview' && signature ? (
        <div className="flex flex-col gap-4" data-import-preview>
          <p className="text-sm" data-import-file-type>
            <span className="text-muted">{t('import.fileType')}: </span>
            <span className="font-medium">{t(`import.signature.${signature.key}`)}</span>
            {fileName ? <span className="text-muted"> · </span> : null}
            {fileName ? <span className="font-data">{fileName}</span> : null}
          </p>

          {signature.kind === 'promo' ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label={t('import.code')}
                error={codeError || undefined}
                required={t('common.required')}
                className="min-w-[12rem] flex-1"
              >
                {({ id, ...p }) => (
                  <Input
                    id={id}
                    {...p}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeError('');
                    }}
                    data-import-code
                  />
                )}
              </Field>
              <Button variant="primary" onClick={() => void onReview()} data-import-review>
                {t('import.review')}
              </Button>
            </div>
          ) : null}

          {existingFailed && !preview ? (
            <DataState
              kind="failed"
              what={t('import.title')}
              message={t('import.existingFailed')}
              onRetry={() => void onReview()}
              retryLabel={t('common.tryAgain')}
            />
          ) : null}

          {fileProblem ? (
            <p role="alert" className="text-sm text-danger">
              {fileProblem}
            </p>
          ) : null}

          {preview ? (
            <>
              {counts(preview.counts)}
              <div className="overflow-x-auto rounded-lg border border-border bg-raised">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface text-xs text-muted">
                      <th className="px-4 py-2 text-start font-semibold">{t('import.row')}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t('import.reference')}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t('import.outcome')}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t('import.reason')}</th>
                      <th className="px-4 py-2 text-start font-semibold">{t('import.keep')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row_no} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5 font-data tabular">{r.row_no}</td>
                        <td className="px-4 py-2.5 font-data tabular">{r.transaction_ref ?? r.invoice_ref ?? '—'}</td>
                        <td className="px-4 py-2.5">{t(`import.${OUTCOME_KEY[r.outcome]}`)}</td>
                        <td className="px-4 py-2.5 text-muted">
                          {r.reasons.join(' · ') || '—'}
                          {r.matched ? (
                            <span className="mt-1 block text-xs">
                              <span className="block font-medium text-text">
                                {t('import.matchedRow', {
                                  ref: r.matched.transaction_ref ?? r.matched.invoice_ref ?? '—',
                                })}
                              </span>
                              {r.changes.map((c) => (
                                <span key={c.field} className="block">
                                  {changeLabel(c.field)}: {changeValue(c.before)} → {changeValue(c.after)}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.duplicate ? (
                            <Checkbox
                              checked={decisions[r.row_no] === 'keep'}
                              onCheckedChange={(v) => onKeepDuplicate(r.row_no, v)}
                              label={t('import.keep')}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.clashes.length ? (
                <div className="flex flex-col gap-1" data-import-clashes>
                  <h3 className="text-sm font-medium">{t('import.held')}</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {preview.clashes.map((c) => (
                      <li key={c.row_no}>
                        <span className="font-data tabular">{c.row_no}</span>
                        <span className="text-muted"> · {c.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" loading={busy} onClick={() => void onConfirm()} data-import-confirm>
                  {t('import.confirm')}
                </Button>
                <Button variant="secondary" onClick={resetFile} data-import-start-over>
                  {t('import.startOver')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {stage === 'confirmed' && confirmed ? (
        <div className="flex flex-col gap-3" data-import-confirmed>
          <p className="text-sm font-medium">{t('import.confirmed')}</p>
          {counts(confirmed)}
          {storedFile ? (
            <p className="flex flex-wrap items-center gap-2 text-sm" data-import-source-file>
              <span className="text-muted">{t('import.sourceFile')}: </span>
              <span className="font-data">{storedFile.name}</span>
              <a
                href={recordFileDownloadUrl(storedFile.id, locale)}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: 'xs' })}
                data-import-source-download
              >
                {t('record.files.download')}
              </a>
              <FileLinkButton fileId={storedFile.id} />
            </p>
          ) : sourceFileFailed ? (
            <p className="flex flex-wrap items-center gap-2 text-sm" data-import-source-file-failed role="alert">
              <span className="text-danger">{t('import.sourceFileFailed')}</span>
              {batchId && sourceFile ? (
                <Button
                  size="xs"
                  loading={storingFile}
                  onClick={() => void storeSourceFile(batchId, sourceFile)}
                  data-import-source-retry
                >
                  {t('common.tryAgain')}
                </Button>
              ) : null}
            </p>
          ) : null}
          <div>
            <Button variant="secondary" onClick={resetFile} data-import-start-over>
              {t('import.startOver')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
