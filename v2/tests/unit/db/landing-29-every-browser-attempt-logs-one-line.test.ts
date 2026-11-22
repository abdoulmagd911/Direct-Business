/**
 * Landing 29 — every attempt of a browser read logs one line: the function, the milliseconds, how it ended (and the
 * error kind when it failed), the attempt number and whether it was the automatic retry. Both browser paths do it:
 * `rpc()` (core/db/rpc.ts) and the Finance reads (`readFinance`, modules/finance/use-reads.ts). The line mirrors the
 * server's `[serverRpc] fn=… ms=… attempts=…`. Timings only — never an argument, never an answer. Every value is
 * made up.
 * Sabotage: tests/sabotage/landing-29.mjs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Answer = { data: unknown; error: { code?: string; message?: string } | null };
let answers: Answer[] = [];
vi.mock('@/core/db/client', () => ({
  browserDb: () => ({ rpc: () => Promise.resolve(answers.shift() ?? { data: [], error: null }) }),
}));

const { rpc } = await import('../../../src/core/db/rpc');
const { readFinance, RETRY_AFTER_MS } = await import('../../../src/modules/finance/use-reads');

const TIMEOUT: Answer = {
  data: null,
  error: { code: '57014', message: 'canceling statement due to statement timeout' },
};
const REFUSED: Answer = { data: null, error: { code: '42501', message: 'access.needs_level' } };
const SECRET = { p_partner: 'made-up-secret-argument' };

let lines: string[] = [];
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 10, 22, 9)) });
  lines = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => void lines.push(String(line)));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const browserLines = () => lines.filter((l) => l.startsWith('[browserRpc] '));
const run = async <T>(work: Promise<T>): Promise<T | Error> => {
  const settled = work.then(
    (v) => v,
    (e: Error) => e,
  );
  await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS + 500);
  return settled;
};

describe('Landing 29: rpc() logs every attempt', () => {
  it('a call that answers logs one line: function, milliseconds, ready, attempt 1, not a retry', async () => {
    answers = [{ data: ['made up'], error: null }];
    await run(rpc('l29_made_up_ok' as never, SECRET as never));
    expect(browserLines(), 'a call that answered logged no line').toHaveLength(1);
    expect(browserLines()[0]).toMatch(/^\[browserRpc\] fn=l29_made_up_ok ms=\d+ outcome=ready attempt=1 retry=false$/);
  });

  it('a read that failed on its way and was tried once more logs both attempts, the second as the retry', async () => {
    answers = [TIMEOUT, { data: [], error: null }];
    await run(rpc('l29_made_up_twice' as never, {} as never, { retry: true }));
    expect(browserLines(), 'each attempt logs its own line').toHaveLength(2);
    expect(browserLines()[0], 'a failed attempt names its error kind').toMatch(
      /^\[browserRpc\] fn=l29_made_up_twice ms=\d+ outcome=failed kind=Unavailable attempt=1 retry=false$/,
    );
    expect(browserLines()[1], 'the second attempt is numbered 2 and marked as the retry').toMatch(
      /^\[browserRpc\] fn=l29_made_up_twice ms=\d+ outcome=ready attempt=2 retry=true$/,
    );
  });

  it('a refused write logs one failed line with its kind, and is not tried again', async () => {
    answers = [REFUSED];
    expect(await run(rpc('l29_made_up_refused' as never, {} as never))).toBeInstanceOf(Error);
    expect(browserLines()).toHaveLength(1);
    expect(browserLines()[0]).toMatch(/ outcome=failed kind=PermissionDenied attempt=1 retry=false$/);
  });

  it('a line never carries an argument or an answer', async () => {
    answers = [{ data: ['made-up-secret-answer'], error: null }];
    await run(rpc('l29_made_up_quiet' as never, SECRET as never));
    expect(lines.join('\n')).not.toContain('made-up-secret');
  });
});

describe('Landing 29: a Finance read logs every attempt', () => {
  const signal = () => new AbortController().signal;

  it('a read that answers logs one ready line', async () => {
    answers = [{ data: ['made up'], error: null }];
    await run(readFinance('l29_finance_ok' as never, {}, signal()));
    expect(browserLines(), 'a Finance read that answered logged no line').toHaveLength(1);
    expect(browserLines()[0]).toMatch(/^\[browserRpc\] fn=l29_finance_ok ms=\d+ outcome=ready attempt=1 retry=false$/);
  });

  it('a read cut off for time logs the failed attempt, then its one second ask as attempt 2, the retry', async () => {
    answers = [TIMEOUT, { data: ['made up'], error: null }];
    await run(readFinance('l29_finance_twice' as never, {}, signal()));
    expect(browserLines(), 'each Finance attempt logs its own line').toHaveLength(2);
    expect(browserLines()[0], 'a failed Finance attempt names its error kind').toMatch(
      /^\[browserRpc\] fn=l29_finance_twice ms=\d+ outcome=failed kind=Unavailable attempt=1 retry=false$/,
    );
    expect(browserLines()[1], 'the second Finance ask is numbered 2 and marked as the retry').toMatch(
      /^\[browserRpc\] fn=l29_finance_twice ms=\d+ outcome=ready attempt=2 retry=true$/,
    );
  });

  it('a refused read logs one failed line with its kind and is not asked again', async () => {
    answers = [REFUSED];
    expect(await run(readFinance('l29_finance_refused' as never, {}, signal()))).toBeInstanceOf(Error);
    expect(browserLines()).toHaveLength(1);
    expect(browserLines()[0]).toMatch(/ outcome=failed kind=PermissionDenied attempt=1 retry=false$/);
  });

  it('an answer from what was kept sends nothing and logs nothing', async () => {
    answers = [{ data: ['made up'], error: null }];
    await run(readFinance('l29_finance_kept' as never, {}, signal()));
    await run(readFinance('l29_finance_kept' as never, {}, signal()));
    expect(browserLines(), 'an answer that was kept logged an attempt').toHaveLength(1);
  });
});
