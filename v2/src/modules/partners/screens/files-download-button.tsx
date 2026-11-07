'use client';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { browserDb } from '@/core/db/client';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';

/** One archive row's download: the signed URL for the file, through the file_download door. */
export function FileDownloadButton({
  fileId,
  label,
  failedLabel,
}: {
  fileId: string;
  label: string;
  failedLabel: string;
}) {
  const locale = useLocale() as 'en' | 'ar';
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const info = (await rpc('file_download', { p_id: fileId, p_locale: locale })) as unknown as {
        bucket: string;
        path: string;
        download_name: string;
        expires_in: number;
      };
      const signed = await browserDb()
        .storage.from(info.bucket)
        .createSignedUrl(info.path, info.expires_in, { download: info.download_name });
      if (signed.error || !signed.data) throw signed.error ?? new Error('no url');
      window.open(signed.data.signedUrl, '_blank', 'noreferrer');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex flex-col items-end gap-1">
      <Button size="xs" loading={busy} onClick={download} data-file-download>
        {label}
      </Button>
      {failed ? (
        <span role="alert" className="text-xs text-danger">
          {failedLabel}
        </span>
      ) : null}
    </span>
  );
}
