'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { recordFileDownloadUrl } from '@/core/files/download-url';
import { Button } from '@/ui/Button';

/**
 * A file's download link, with a copy action (FIX-16, F064): the link is the re-checking route
 * (/files/<file-id>/download), which checks the presser may still see the file on every GET and redirects to a
 * freshly minted short-lived signed URL — so unsharing revokes it for a non-author reader, and a re-press after
 * unshare refuses with words. The link itself never expires and carries no file bytes, so it is shown at once
 * (no minting on press) and is safe to copy. The link opens in a new tab on a genuine click (no
 * popup-blocked window.open). The copy writes the route address; if the clipboard refuses, the link is still
 * shown below, so the person can copy it by hand.
 */
export function FileLinkButton({ fileId, size = 'xs' }: { fileId: string; size?: 'xs' | 'sm' }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [copied, setCopied] = useState(false);
  const url = recordFileDownloadUrl(fileId, locale);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // The link is shown below, so the person can copy it by hand.
      setCopied(false);
    }
  };

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <Button size={size} variant="ghost" onClick={() => void copy()} data-file-copy-link>
          {t('record.files.copyLink')}
        </Button>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline">
          {t('record.files.openLink')}
        </a>
      </span>
      <span className="text-xs text-muted">
        {t('record.files.linkChecksAccess')}
        {copied ? ` · ${t('record.files.linkCopied')}` : ''}
      </span>
    </span>
  );
}
