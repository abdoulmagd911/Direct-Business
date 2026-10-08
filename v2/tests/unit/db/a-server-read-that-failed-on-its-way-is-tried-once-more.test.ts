import { describe, expect, it, vi } from 'vitest';
import { isTransient, readTwice, type CallResult } from '@/core/db/retry';

// W43: the first load of a Settings page answered 500 because the gateway gave up on one signed-in read (status 555,
// "Internal server error.", no database code); the same read a moment later worked.
const noWait = async () => {};
const gaveUp: CallResult = { error: { message: 'Internal server error.' }, status: 555 };
const answered = { data: { ok: true }, error: null, status: 200 };

function calls(...results: CallResult[]) {
  const call = vi.fn();
  for (const r of results) call.mockResolvedValueOnce(r);
  return call;
}

describe('a server read that failed on its way is tried once more before the error screen', () => {
  it('a gateway that gave up, then an answer: the page gets the answer', async () => {
    const call = calls(gaveUp, answered);
    expect(await readTwice(call, noWait)).toBe(answered);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('an answer the first time is not asked again', async () => {
    const call = calls(answered);
    await readTwice(call, noWait);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('twice failed is the error screen: the second failure is answered, never a third try', async () => {
    const call = calls(gaveUp, gaveUp, answered);
    expect(await readTwice(call, noWait)).toBe(gaveUp);
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('a refusal or an error the database gave is an answer, never retried', async () => {
    for (const refusal of [
      { error: { code: 'P0001', message: 'partner.archived' }, status: 400 },
      { error: { code: '42501', message: 'access.needs_level' }, status: 403 },
      { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 },
      { error: { code: '23505', message: 'duplicate key' }, status: 409 },
      // a database error that comes back as a 500 still carries its code: the same read would fail the same way
      { error: { code: 'XX000', message: 'internal error' }, status: 500 },
    ]) {
      const call = calls(refusal, answered);
      expect(await readTwice(call, noWait)).toBe(refusal);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
  it('what counts as failed on the way', () => {
    expect(isTransient(gaveUp)).toBe(true);
    expect(isTransient({ error: { message: 'TypeError: fetch failed' }, status: 0 })).toBe(true);
    expect(isTransient({ error: { message: 'TypeError: fetch failed' } })).toBe(true);
    expect(isTransient({ error: { code: 'PGRST003', message: 'Timed out acquiring connection' }, status: 504 })).toBe(
      true,
    );
    expect(
      isTransient({ error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }),
    ).toBe(true);
    expect(isTransient({ error: { code: '08006', message: 'connection failure' }, status: 503 })).toBe(true);
    expect(isTransient({ error: null, status: 200 })).toBe(false);
    expect(isTransient({ error: { message: 'Not found' }, status: 404 })).toBe(false);
  });
  it('waits a moment before the second try', async () => {
    const wait = vi.fn(async () => {});
    await readTwice(calls(gaveUp, answered), wait);
    expect(wait).toHaveBeenCalledWith(250);
  });
});
