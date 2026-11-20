/**
 * Landing 34 (the 19 Nov test round, item 4) — every Finance read settles, to its data or to an error with a Try again
 * that works. Three causes were in the code: (1) the ledger waited for the figures to be READY, so a failed figures
 * read left it on "Loading" for good; (2) nothing bounded a request, so one the network never answered held its slot
 * for ever and every later read — a Try again too — waited behind it; (3) the window coming back (the shell's focus
 * refetch) threw away every read of the page, one still on its way included, and asked them all again.
 * Sabotage: tests/sabotage/landing-34-finance.mjs "ledger-waits-for-the-figures-to-succeed",
 * "a-read-with-no-answer-waits-for-ever", "a-read-with-no-answer-is-asked-twice",
 * "window-back-restarts-a-read-in-flight", "window-back-reasks-a-fresh-answer".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DbError } from '../../../src/core/db/errors';
import { ledgerMayAsk, opensLedgerView } from '../../../src/modules/finance/ledger';

const calls: string[] = [];
let answer: (fn: string) => Promise<unknown> = async () => ({ data: {}, error: null });
vi.mock('@/core/db/client', () => ({
  browserDb: () => ({
    rpc: (fn: string) => {
      calls.push(fn);
      return answer(fn);
    },
  }),
}));

const { BACK_STALE_MS, DEADLINE_MS, LIMIT, readFinance, refetchPlan } =
  await import('../../../src/modules/finance/use-reads');

const never = () => new Promise<never>(() => {});
const signal = () => new AbortController().signal;
// each test asks its own read names, so nothing kept or in flight from another test answers it
const fn = (name: string) => name as never;

describe('the ledger asks its read once the figures have settled', () => {
  it('waits only while the figures are on their way', () => {
    expect(ledgerMayAsk('loading')).toBe(false);
    expect(ledgerMayAsk('ready')).toBe(true);
  });

  it('is not held by a figures read that failed — it never sits on Loading for good', () => {
    expect(ledgerMayAsk('failed')).toBe(true);
  });

  it('an address that names a part of the ledger opens the Ledger view on a phone', () => {
    expect(opensLedgerView('#finance-company')).toBe(true);
    expect(opensLedgerView('#finance-ledger')).toBe(true);
    expect(opensLedgerView('#finance-service')).toBe(false);
    expect(opensLedgerView('')).toBe(false);
  });
});

describe('a request that gets no answer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails as "could not be reached" at the deadline — the block is never left loading', async () => {
    answer = never;
    const read = readFinance(fn('made_up_silent'), {}, signal());
    const settled = vi.fn();
    read.then(settled, settled);
    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(settled).toHaveBeenCalledTimes(1);
    const e = settled.mock.calls[0]![0] as DbError;
    expect(e).toBeInstanceOf(DbError);
    expect(e.kind).toBe('Unavailable');
  });

  it('is not asked a second time on its own — the person’s Try again asks it', async () => {
    answer = never;
    const read = readFinance(fn('made_up_silent_once'), {}, signal()).catch(() => 'failed');
    await vi.advanceTimersByTimeAsync(DEADLINE_MS * 3);
    expect(await read).toBe('failed');
    expect(calls.filter((c) => c === 'made_up_silent_once')).toHaveLength(1);
  });

  it('hands its slot on: reads that waited behind it are sent, and a Try again is asked afresh', async () => {
    answer = (name) =>
      name.startsWith('made_up_stuck') ? never() : Promise.resolve({ data: { ok: name }, error: null });
    const stuck = Array.from({ length: LIMIT }, (_, i) =>
      readFinance(fn(`made_up_stuck_${i}`), {}, signal()).catch(() => 'failed'),
    );
    const behind = readFinance<{ ok: string }>(fn('made_up_behind'), {}, signal());
    await vi.advanceTimersByTimeAsync(DEADLINE_MS - 1);
    expect(calls, 'both slots are held: the third read has not been sent').not.toContain('made_up_behind');
    await vi.advanceTimersByTimeAsync(2);
    expect(await Promise.all(stuck)).toEqual(Array.from({ length: LIMIT }, () => 'failed'));
    expect(await behind).toEqual({ ok: 'made_up_behind' });
    // Try again on a block that failed at the deadline sends its read once more
    answer = async (name) => ({ data: { ok: name }, error: null });
    expect(await readFinance(fn('made_up_stuck_0'), {}, signal())).toEqual({ ok: 'made_up_stuck_0' });
    expect(calls.filter((c) => c === 'made_up_stuck_0')).toHaveLength(2);
  });

  it('a read the database could not answer in time is still asked once more, after a pause', async () => {
    let n = 0;
    answer = async () =>
      ++n === 1
        ? { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
        : { data: { ok: true }, error: null };
    const read = readFinance(fn('made_up_slow'), {}, signal());
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await read).toEqual({ ok: true });
    expect(calls.filter((c) => c === 'made_up_slow')).toHaveLength(2);
  });
});

describe('the shell asks every screen to refetch', () => {
  const now = 1_000_000;

  it('after a write every block asks again, whatever it holds', () => {
    for (const status of ['loading', 'ready', 'failed'] as const)
      expect(refetchPlan('write', { status, answeredAt: now }, now)).toBe('ask');
  });

  it('a window that only came back leaves a read still on its way alone', () => {
    expect(refetchPlan('back', { status: 'loading', answeredAt: 0 }, now)).toBe('leave');
  });

  it('a window that came back leaves a fresh answer, and a failed block keeps its own Try again', () => {
    expect(refetchPlan('back', { status: 'ready', answeredAt: now - BACK_STALE_MS + 1 }, now)).toBe('leave');
    expect(refetchPlan('back', { status: 'failed', answeredAt: 0 }, now)).toBe('leave');
  });

  it('a window that came back re-asks an answer that has gone old', () => {
    expect(refetchPlan('back', { status: 'ready', answeredAt: now - BACK_STALE_MS - 1 }, now)).toBe('ask');
  });
});
