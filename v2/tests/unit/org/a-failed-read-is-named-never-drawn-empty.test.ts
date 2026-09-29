import { describe, expect, it, vi } from 'vitest';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

const { readOrFail } = await import('@/modules/org/read-or-fail');
const { DbError } = await import('@/core/db/errors');

describe('a record page read that fails is named, never drawn as empty or as no access', () => {
  it('answers with the data when the read works', async () => {
    const failed: string[] = [];
    expect(await readOrFail('devices', failed, async () => [{ id: 'd1' }])).toEqual([{ id: 'd1' }]);
    expect(failed).toEqual([]);
  });
  it('leaves out what the database refuses, silently (that is no access, not a failure)', async () => {
    const failed: string[] = [];
    const denied = new DbError('PermissionDenied', 'access.denied');
    expect(await readOrFail('people', failed, async () => Promise.reject(denied))).toBeNull();
    expect(failed).toEqual([]);
  });
  it('names a read that failed for any other reason, so the screen shows Try again', async () => {
    const failed: string[] = [];
    const down = new DbError('Unavailable', 'common.unavailable');
    expect(await readOrFail('signIns', failed, async () => Promise.reject(down))).toBeNull();
    expect(await readOrFail('history', failed, async () => Promise.reject(new TypeError('fetch failed')))).toBeNull();
    expect(failed).toEqual(['signIns', 'history']);
  });
  it('ends the page as not found when the record is gone', async () => {
    const failed: string[] = [];
    const gone = new DbError('NotFound', 'common.not_found');
    await expect(readOrFail('history', failed, async () => Promise.reject(gone))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(failed).toEqual([]);
  });
});
