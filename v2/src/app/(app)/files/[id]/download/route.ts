import { getLocale, getTranslations } from 'next-intl/server';
import { NextResponse, type NextRequest } from 'next/server';
import { requireMe } from '@/core/auth/require-me';
import { DbError } from '@/core/db/errors';
import { serverDb } from '@/core/db/server';
import { serverRpc } from '@/core/db/server-rpc';

/**
 * The re-checking download route (FIX-16, I3): GET /files/<file-id>/download.
 *
 * A copied download link points here, never at a raw signed URL. Every GET re-runs the file_download check for
 * the presser — the same file_visible rule the rows and the signing step use — then mints a fresh short-lived
 * signed URL server-side and redirects to it. Unsharing therefore revokes the link for a non-author reader:
 * their re-press is refused with words instead of serving the file until the old URL's expiry (600 s for
 * documents, 24 h for images). The author/uploader keeps access to their own file after unshare
 * (file_visible_as returns true for created_by — correct and intended, I3): the route serves them, as a fresh
 * Download press would. A signed-out presser is sent to sign in and back here, by the app gate.
 *
 * No new RPC: file_download already answers everything (bucket, path, save-as name, lifetime). No migration:
 * the check is the existing rule, read at press time.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RefusalWords = 'record.files.downloadRefused' | 'record.files.downloadNotFound' | 'record.files.downloadFailed';

/** A refusal page with words, in the presser's own language — never a silent failure (FIX-39). */
async function refusal(status: number, key: RefusalWords): Promise<NextResponse> {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const words = t(key);
  const goMyDay = t('errors.notFound.goMyDay');
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return new NextResponse(
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8">` +
      `<title>${escapeHtml(words)}</title></head><body><main><h1>${escapeHtml(words)}</h1>` +
      `<p><a href="/my-day">${escapeHtml(goMyDay)}</a></p></main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

function escapeHtml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID.test(id)) return refusal(404, 'record.files.downloadNotFound');
  // The app gate: no session → sign in and back here; a refused session → sign out with the reason.
  await requireMe();
  const asked = request.nextUrl.searchParams.get('locale');
  const locale = asked === 'ar' ? 'ar' : 'en';
  let info: { bucket: string; path: string; download_name: string; expires_in: number };
  try {
    info = (await serverRpc('file_download', { p_id: id, p_locale: locale })) as unknown as {
      bucket: string;
      path: string;
      download_name: string;
      expires_in: number;
    };
  } catch (e) {
    // file.cannot_see (a reader unshared since) refuses with words; a missing file is not available; anything
    // else is a failed read, not a refusal — the person is told to try again.
    if (e instanceof DbError && e.kind === 'PermissionDenied') return refusal(403, 'record.files.downloadRefused');
    if (e instanceof DbError && (e.kind === 'NotFound' || e.key === 'file.not_stored'))
      return refusal(404, 'record.files.downloadNotFound');
    return refusal(503, 'record.files.downloadFailed');
  }
  const db = await serverDb();
  const signed = await db.storage
    .from(info.bucket)
    .createSignedUrl(info.path, info.expires_in, { download: info.download_name });
  if (signed.error || !signed.data) return refusal(503, 'record.files.downloadFailed');
  const go = NextResponse.redirect(signed.data.signedUrl, 303);
  go.headers.set('cache-control', 'no-store');
  return go;
}
