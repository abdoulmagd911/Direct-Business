'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { refetchAll } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
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
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
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

/**
 * Importing a Direct export, on the Finance page (the imports module's page is Finance, where the import preview
 * lives). One batch belongs to exactly one partner: the partner is picked first, then a file. The file is read in
 * the browser, recognised by its column signature, and previewed with the five counts — nothing is written until
 * Confirm. A promo file has no code column, so the code text is recorded here before the preview can run, and the
 * upload is refused without it. Held rows are shown with their reasons and never written.
 */
export function FinanceImportSection() {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [partner, setPartner] = useState<PartnerRef | null>(null);
  const [fileName, setFileName] = useState('');
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

  const resetFile = () => {
    if (fileRef.current) fileRef.current.value = '';
    setFileName('');
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

  const runPreview = async (sig: Signature, header: string[], rows: string[][], codeText: string | null) => {
    if (!partner) return;
    setLoading(true);
    setExistingFailed(false);
    try {
      const answer = await rpc('import_ledger', { p_partner: partner.id });
      const stored = existingFromImportLedger(answer);
      const norm = normaliseFile(sig.key, header, rows, { sourcePromo: codeText });
      if (norm.fileProblem) {
        setFileProblem(norm.fileProblem);
        setLoading(false);
        return;
      }
      setExisting(stored);
      setRecords(norm.records);
      setHeld(norm.held);
      setDecisions({});
      setPreview(buildPreview(stored, norm.records, norm.held, {}));
      setStage('preview');
    } catch {
      setExistingFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file || !partner) return;
    resetFile();
    setFileName(file.name);
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

          {signature.kind === 'promo' && !preview ? (
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
                        <td className="px-4 py-2.5 text-muted">{r.reasons.join(' · ') || '—'}</td>
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
