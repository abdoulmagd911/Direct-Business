'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { browserDb } from '@/core/db/client';
import { rpc } from '@/core/db/rpc';
import { command } from '@/core/commands/run';
import { recordFileDownloadUrl } from '@/core/files/download-url';
import { formatDate } from '@/core/i18n/format';
import { Button, buttonVariants } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { DatePicker } from '@/ui/DatePicker';
import { Field } from '@/ui/Field';
import { FileLinkButton } from '@/ui/record/FileLinkButton';
import { Input } from '@/ui/Input';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Select } from '@/ui/Select';
import { useCommandWords } from './words';

/** One file on a record, as api.files answers it (the CompanyFile shape, generalised). */
export type RecordFile = {
  id: string;
  link_id: string;
  kind: string;
  kind_en: string;
  kind_ar: string | null;
  purpose: string;
  side: 'client' | 'supplier_partner' | null;
  display_name_en: string | null;
  display_name_ar: string | null;
  original_name: string | null;
  mime: string;
  size_bytes: number;
  sensitivity: string;
  status: string;
  review_on: string | null;
  review_due: boolean;
  added_by: string | null;
  added_at: string;
  version: number;
};

/** One kind the section offers: its kind, the purpose it is stored under, and its shown name. */
export type FileKindOption = {
  kind: string;
  purpose: string;
  /** The kind needs a review date at upload time (a travel policy). */
  reviewRequired?: boolean;
  label: string;
};

/** A file's size in words ("1.2 MB"), for a row or a stream entry. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A file's SHA-256, as file_finish wants it. */
export async function sha256HexFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// A file's download is a real link to the re-checking route (FIX-16, core/files/download-url.ts): the route
// re-checks the presser may still see the file on every GET and redirects to a freshly minted short-lived
// signed URL. Minting a raw signed URL in the browser is gone: it was bearer and unsharing never revoked it,
// so a re-pressed link kept serving until its expiry (600 s for documents, 24 h for images).

/** One upload that failed while this screen still holds the file: it can be tried again from memory. */
type PendingUpload = {
  key: string;
  file: File;
  kind: string;
  purpose: string;
  reviewOn: string | null;
};

/**
 * A record's files (Phase 3, the generic form of the company Files section): upload through the existing file
 * doors (register, store, finish) and listed from them. Several files at once, by choosing, dropping or
 * pasting them; a phone's camera comes through the native file input. The kind defaults to the first kind
 * offered (evidence on a task or an achievement); the company page keeps the kind picker. A review date is
 * asked only for a kind that needs one (a travel policy), at upload time. A file whose upload never finished
 * shows a retry button while the upload is still in memory; after a reload the row says the upload failed and
 * asks the person to pick the file again. No preview. The list is refreshed through onDone — an upload is
 * never assumed to appear at once.
 */
export function FilesSection({
  entity,
  recordId,
  kinds,
  files,
  mayWrite,
  onDone,
  title,
  allFilesHref,
  allFilesLabel,
  intro,
}: {
  /** The entity key, e.g. 'partner', 'task', 'achievement'. */
  entity: string;
  recordId: string;
  kinds: FileKindOption[];
  files: RecordFile[] | null;
  mayWrite: boolean;
  onDone: () => void;
  /** The section's title, in the language on screen. */
  title: string;
  /** Where the "All files" link goes; none when the record has no archive link. */
  allFilesHref?: string;
  allFilesLabel?: string;
  intro?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useCommandWords();
  const [kind, setKind] = useState<string>(kinds[0]?.kind ?? '');
  const [reviewOn, setReviewOn] = useState('');
  const [picked, setPicked] = useState<File[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RecordFile | null>(null);
  // a removal is in flight from the confirm until the refreshed list is triggered: the row's actions stay locked
  // so no second remove runs against the list as it stood before the removal (F145).
  const [removingBusy, setRemovingBusy] = useState(false);
  const removingBusyRef = useRef(false);
  // the removal unlocks when the refreshed list lands: the files prop is a fresh read after the refetch, so a
  // new files array means the list on screen is no longer the pre-removal one. The ref (not the state) is the
  // trigger guard, so setting the flag does not itself fire this effect.
  useEffect(() => {
    if (removingBusyRef.current) {
      removingBusyRef.current = false;
      setRemovingBusy(false);
    }
  }, [files]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = kinds.find((k) => k.kind === kind) ?? kinds[0];
  const needsReview = selected?.reviewRequired === true;
  const canUpload = picked.length > 0 && !!selected && (!needsReview || reviewOn !== '');

  const attempt = async (file: File, kindOpt: FileKindOption, review: string | null) => {
    const begun = (await rpc('file_begin', {
      p_entity: entity,
      p_id: recordId,
      p_kind: kindOpt.kind,
      p_purpose: kindOpt.purpose,
      p_original_name: file.name,
      p_size: file.size,
      p_mime: file.type || 'application/octet-stream',
      ...(review ? { p_review_on: review } : {}),
    })) as unknown as { id: string; bucket: string; path: string };
    const stored = await browserDb().storage.from(begun.bucket).upload(begun.path, file);
    if (stored.error) throw stored.error;
    await rpc('file_finish', { p_id: begun.id, p_sha256: await sha256HexFile(file) });
  };

  const uploadPicked = async () => {
    if (!selected || picked.length === 0) return;
    setBusy(true);
    setError(null);
    const failed: PendingUpload[] = [];
    for (const file of picked) {
      try {
        await attempt(file, selected, needsReview ? reviewOn : null);
      } catch {
        failed.push({
          key: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          kind: selected.kind,
          purpose: selected.purpose,
          reviewOn: needsReview ? reviewOn : null,
        });
      }
    }
    setPending((prev) => [...prev, ...failed]);
    setPicked([]);
    if (inputRef.current) inputRef.current.value = '';
    if (failed.length) setError(t('record.files.uploadFailed'));
    setBusy(false);
    // only refresh when at least one file landed: on a total failure the pending retry rows stay on the page,
    // and a refresh would throw the record away into the full-page crash (F163).
    if (failed.length < picked.length) onDone();
  };

  const retry = async (p: PendingUpload) => {
    const kindOpt = kinds.find((k) => k.kind === p.kind);
    if (!kindOpt) return;
    setBusy(true);
    setError(null);
    try {
      await attempt(p.file, kindOpt, p.reviewOn);
      setPending((prev) => prev.filter((x) => x.key !== p.key));
      onDone();
    } catch {
      setError(t('record.files.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addPicked = (list: FileList | null) => {
    if (!list) return;
    setPicked((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <section
      className="rounded-lg border border-border bg-raised p-5"
      data-record-files
      {...(entity === 'partner' ? { 'data-partner-files': true } : {})}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        addPicked(e.dataTransfer.files);
      }}
      onPaste={(e) => addPicked(e.clipboardData.files)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {allFilesHref && allFilesLabel ? (
          <Link href={allFilesHref} className="text-sm text-link hover:underline">
            {allFilesLabel}
          </Link>
        ) : null}
      </div>
      {intro ? <p className="mb-4 text-sm text-muted">{intro}</p> : null}
      {mayWrite ? (
        <div
          className={`mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end ${dragOver ? 'outline-2 outline-dashed outline-link' : ''}`}
        >
          {kinds.length > 1 ? (
            <Field label={t('record.files.kind')} className="sm:w-64">
              {({ id }) => (
                <Select
                  id={id}
                  value={kind || undefined}
                  onValueChange={setKind}
                  placeholder={t('record.files.chooseKind')}
                  options={kinds.map((k) => ({ value: k.kind, label: k.label }))}
                />
              )}
            </Field>
          ) : null}
          {needsReview ? (
            <Field label={t('record.files.reviewOn')} className="sm:w-48">
              {({ id }) => <DatePicker id={id} value={reviewOn || undefined} onChange={(v) => setReviewOn(v ?? '')} />}
            </Field>
          ) : null}
          <Field label={t('record.files.chooseFile')} className="flex-1">
            {({ id }) => (
              <Input id={id} ref={inputRef} type="file" multiple onChange={(e) => addPicked(e.target.files)} />
            )}
          </Field>
          <Button variant="primary" loading={busy} disabled={!canUpload} onClick={uploadPicked} data-file-upload>
            {t('record.files.upload')}
          </Button>
        </div>
      ) : null}
      {picked.length ? <p className="mb-3 text-sm text-muted">{picked.map((f) => f.name).join(' · ')}</p> : null}
      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending.length ? (
        <ul className="mb-3 flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="truncate text-sm font-medium">{p.file.name}</span>
              <Button size="xs" loading={busy} onClick={() => retry(p)} data-file-retry>
                {t('record.files.retryUpload')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {files === null ? (
        <DataState
          kind="failed"
          what={title}
          message={t('state.failed', { what: title })}
          onRetry={onDone}
          retryLabel={t('common.tryAgain')}
        />
      ) : files.length ? (
        <ul className="divide-y divide-border">
          {files.map((f) => {
            // The row's name is the stored uploaded filename (FIX-38), never the generated display name.
            const name = f.original_name;
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                data-record-file={f.id}
                {...(entity === 'partner' ? { 'data-company-file': f.id } : {})}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted">
                    {locale === 'ar' && f.kind_ar ? f.kind_ar : f.kind_en} · {formatFileSize(f.size_bytes)} ·{' '}
                    {t('record.files.addedOn', {
                      date: formatDate(f.added_at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
                    })}
                    {f.review_on ? (
                      <>
                        {' · '}
                        {t('record.files.reviewOnDate', {
                          date: formatDate(f.review_on, locale, { dateStyle: 'medium' }),
                        })}
                      </>
                    ) : null}
                  </span>
                  {f.status !== 'stored' ? (
                    <>
                      <StatusChip tone="warning" className="mt-1 w-fit">
                        {t('record.files.notStored')}
                      </StatusChip>
                      <span className="mt-1 text-xs text-muted">{t('record.files.uploadFailedPickAgain')}</span>
                    </>
                  ) : null}
                </span>
                <span className="flex gap-2">
                  {f.status === 'stored' ? (
                    <>
                      <a
                        href={recordFileDownloadUrl(f.id, locale)}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ size: 'xs' })}
                        data-file-download
                      >
                        {t('record.files.download')}
                      </a>
                      <FileLinkButton fileId={f.id} />
                    </>
                  ) : null}
                  {mayWrite ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setRemoving(f)}
                      disabled={removingBusy}
                      data-file-remove
                    >
                      {t('record.files.remove')}
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState kind="empty" message={t('record.files.none')} />
      )}
      <ReasonDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('record.files.removeTitle', {
          // The stored uploaded filename (FIX-38), never the generated display name.
          name: removing?.original_name ?? '',
        })}
        destructive
        onSave={async (reason) => {
          const f = removing!;
          setRemoving(null);
          removingBusyRef.current = true;
          setRemovingBusy(true);
          // through command(): a toast with Undo on success, a refusal in words on failure, and the global
          // refetch — the bare rpc + onDone() before it showed nothing on failure and refreshed on it (F145).
          const result = await command(
            words(t('record.files.removed')),
            () =>
              rpc('files_remove', { p_ids: [f.id], p_reason: reason }) as Promise<{
                request_id?: string | null;
              }>,
          );
          if (result === undefined) {
            // the write failed: the list is unchanged, so unlock at once. On success the flag clears when the
            // refreshed files prop lands (the effect above).
            removingBusyRef.current = false;
            setRemovingBusy(false);
          }
        }}
        words={{
          reason: t('common.reason'),
          save: t('common.remove'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
    </section>
  );
}
