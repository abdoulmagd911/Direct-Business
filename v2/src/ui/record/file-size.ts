import { formatNumber } from '@/core/i18n/format';

/**
 * A file's size in words, in the language on screen ("1.2 MB", "1.2 ميغابايت"), for a row or a stream entry — the
 * units were English letters in Arabic too. One function for every screen that shows a size: a record's Files, its
 * Discussion and the All files page (which drew its own sizes once, with keys of its own). Not a client module, so a
 * server page may call it as well.
 */
export function formatFileSize(
  bytes: number,
  t: (key: string, values: Record<string, string>) => string,
  locale: 'en' | 'ar',
): string {
  if (bytes < 1024) return t('record.files.size.bytes', { n: formatNumber(bytes, locale) });
  const one = (n: number) => formatNumber(n, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) return t('record.files.size.kb', { n: one(bytes / 1024) });
  return t('record.files.size.mb', { n: one(bytes / (1024 * 1024)) });
}
