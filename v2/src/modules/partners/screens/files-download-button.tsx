'use client';
import { useLocale } from 'next-intl';
import { recordFileDownloadUrl } from '@/core/files/download-url';
import { buttonVariants } from '@/ui/Button';
import { FileLinkButton } from '@/ui/record/FileLinkButton';

/**
 * One archive row's download: a real link to the re-checking route (FIX-16), which checks the presser may still
 * see the file on every GET and redirects to a freshly minted short-lived signed URL. A genuine click on a real
 * link — no async window.open, so no popup-blocked silence (F248) — and a refusal opens the route's page with
 * words, never silence. A copy-link action sits beside it, on the same route address.
 */
export function FileDownloadButton({ fileId, label }: { fileId: string; label: string }) {
  const locale = useLocale() as 'en' | 'ar';
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <a
          href={recordFileDownloadUrl(fileId, locale)}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: 'xs' })}
          data-file-download
        >
          {label}
        </a>
        <FileLinkButton fileId={fileId} />
      </span>
    </span>
  );
}
