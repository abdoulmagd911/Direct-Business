/**
 * The in-app download address for one stored file (FIX-16, I3): the route re-checks that the presser may still
 * see the file on every GET and redirects to a freshly minted short-lived signed URL — so unsharing revokes the
 * link for a non-author reader, where a raw signed URL would keep serving until its expiry. The address itself
 * never expires and carries no file bytes, so it is the link the rows show and copy.
 */
export function recordFileDownloadUrl(fileId: string, locale: 'en' | 'ar'): string {
  return `/files/${fileId}/download?locale=${locale}`;
}
