import { describe, expect, it } from 'vitest';
import { recordFileDownloadUrl } from '@/core/files/download-url';

describe('a file download link points at the in-app route (FIX-16)', () => {
  it('names the file and the reader language, nothing else', () => {
    expect(recordFileDownloadUrl('11111111-1111-1111-1111-111111111111', 'en')).toBe(
      '/files/11111111-1111-1111-1111-111111111111/download?locale=en',
    );
    expect(recordFileDownloadUrl('11111111-1111-1111-1111-111111111111', 'ar')).toBe(
      '/files/11111111-1111-1111-1111-111111111111/download?locale=ar',
    );
  });
});
