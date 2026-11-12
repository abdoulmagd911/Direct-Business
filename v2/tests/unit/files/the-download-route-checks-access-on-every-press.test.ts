import { beforeEach, describe, expect, it, vi } from 'vitest';

// The download route (FIX-16, I3): every GET re-checks the presser may still see the file and redirects to a
// freshly minted signed URL; a reader unshared since is refused with words. The gate, the read and the signing
// are mocked — the route's own decisions (what it asks, what it answers) are what is pinned here.
const requireMe = vi.fn(async () => undefined);
vi.mock('@/core/auth/require-me', () => ({ requireMe }));

const serverRpc = vi.fn();
vi.mock('@/core/db/server-rpc', () => ({ serverRpc }));

const createSignedUrl = vi.fn(
  async (): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }> => ({
    data: { signedUrl: 'https://storage.example/signed/file.pdf?token=made-up' },
    error: null,
  }),
);
const from = vi.fn(() => ({ createSignedUrl }));
const serverDb = vi.fn(async () => ({ storage: { from } }));
vi.mock('@/core/db/server', () => ({ serverDb }));

const WORDS: Record<string, string> = {
  'record.files.downloadRefused': 'You can no longer download this file — it is no longer shared with you',
  'record.files.downloadNotFound': 'This file is not available',
  'record.files.downloadFailed': 'The file could not be opened — try again',
  'errors.notFound.goMyDay': 'Go to My day',
};
const WORDS_AR: Record<string, string> = {
  'record.files.downloadRefused': 'لم يعد بإمكانك تنزيل هذا الملف — لم يعد مشاركًا معك',
  'record.files.downloadNotFound': 'هذا الملف غير متاح',
  'record.files.downloadFailed': 'تعذّر فتح الملف — حاول مرة أخرى',
  'errors.notFound.goMyDay': 'إلى يومي',
};
vi.mock('next-intl/server', () => ({
  // the route asks for translations in the link's language (F-B2-01): the mock answers in that language,
  // as next-intl does — the session language stays English.
  getTranslations: async (opts?: { locale?: string }) => (key: string) =>
    (opts?.locale === 'ar' ? WORDS_AR[key] : WORDS[key]) ?? key,
  getLocale: async () => 'en',
}));

const { GET } = await import('@/app/(app)/files/[id]/download/route');
const { DbError } = await import('@/core/db/errors');

const FILE_ID = '11111111-1111-1111-1111-111111111111';
const INFO = { bucket: 'files', path: 'made-up/file.pdf', download_name: 'file.pdf', expires_in: 600 };

function req(locale = 'en') {
  return { nextUrl: new URL(`http://localhost/files/${FILE_ID}/download?locale=${locale}`) } as never;
}

describe('the download route checks access on every press (FIX-16, I3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects a visible file to a freshly minted signed URL', async () => {
    serverRpc.mockResolvedValueOnce(INFO);
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://storage.example/signed/file.pdf?token=made-up');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(serverRpc).toHaveBeenCalledWith('file_download', { p_id: FILE_ID, p_locale: 'en' });
    expect(from).toHaveBeenCalledWith('files');
    expect(createSignedUrl).toHaveBeenCalledWith('made-up/file.pdf', 600, { download: 'file.pdf' });
  });
  it('asks for the download name in the reader language', async () => {
    serverRpc.mockResolvedValueOnce(INFO);
    await GET(req('ar'), { params: Promise.resolve({ id: FILE_ID }) });
    expect(serverRpc).toHaveBeenCalledWith('file_download', { p_id: FILE_ID, p_locale: 'ar' });
  });
  it('refuses a reader unshared since, with words', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('PermissionDenied', 'file.cannot_see'));
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('You can no longer download this file');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
  it('says a missing file is not available', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('NotFound', 'common.not_found'));
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('This file is not available');
  });
  it('says a file whose upload never finished is not available', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('RuleBroken', 'file.not_stored'));
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('This file is not available');
  });
  it('says a failed read could not be opened, and to try again', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('Unavailable', 'common.unavailable'));
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('The file could not be opened — try again');
  });
  it('refuses a bad id without asking the database', async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: 'not-a-file' }) });
    expect(res.status).toBe(404);
    expect(serverRpc).not.toHaveBeenCalled();
  });
  it('refuses in Arabic when the link asks for Arabic, even with an English session (F-B2-01)', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('PermissionDenied', 'file.cannot_see'));
    const res = await GET(req('ar'), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('لم يعد بإمكانك تنزيل هذا الملف');
  });
  it('says a missing file is not available in Arabic when the link asks for Arabic', async () => {
    serverRpc.mockRejectedValueOnce(new DbError('NotFound', 'common.not_found'));
    const res = await GET(req('ar'), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('هذا الملف غير متاح');
  });
  it('lets the gate send a signed-out presser to sign in', async () => {
    requireMe.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
    await expect(GET(req(), { params: Promise.resolve({ id: FILE_ID }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(serverRpc).not.toHaveBeenCalled();
  });
  it('says a failed signing could not be opened, and to try again', async () => {
    serverRpc.mockResolvedValueOnce(INFO);
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'signing failed' } });
    const res = await GET(req(), { params: Promise.resolve({ id: FILE_ID }) });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('The file could not be opened — try again');
  });
});
