// @vitest-environment jsdom
/**
 * Landing 34, the follow-up — the cause of "What needs attention" stuck on Loading. A window that comes back is not a
 * write: the reads of the page are not thrown away and asked again. Landing 34 told the two apart by a mark that
 * lasted until the end of the browser's focus event — and the shell (the same landing) asks for its refetch 400 ms
 * AFTER that event, so in the real app every return of the window was still a write: the read on its way began again
 * at the back of the queue each time, and the block that had not answered yet (the health line, asked last) stayed on
 * "Loading". This test runs the real shell bridge beside a real block. Also here: a block knows a refusal from a
 * failure, and Try again always goes to the database. Every value is made up.
 * Sabotage: tests/sabotage/landing-34b-finance.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { commandFinished, commandStarted, refetchAll } from '../../../src/core/commands/refetch';
import { DbError } from '../../../src/core/db/errors';
import { FOCUS_SETTLE_MS, RefetchBridge } from '../../../src/ui/shell/RefetchBridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Answer = { data: unknown; error: { code?: string; message?: string } | null };
const calls: string[] = [];
let answer: (fn: string) => Promise<Answer> = async () => ({ data: [], error: null });
vi.mock('@/core/db/client', () => ({
  browserDb: () => ({
    rpc: (fn: string) => {
      calls.push(fn);
      return answer(fn);
    },
  }),
}));

const { BACK_WINDOW_MS, financeWrote, isRefusal, readFinance, refetchCause, useFinanceRead } =
  await import('../../../src/modules/finance/use-reads');

const asked = (fn: string) => calls.filter((c) => c === fn).length;

/** One block of the page, as the Overview holds the health line: its state in an attribute, its Try again a button. */
function Probe({ fn }: { fn: string }) {
  const read = useFinanceRead<unknown, never>(fn as never, {} as never, fn);
  return (
    <button
      type="button"
      data-probe={read.block.status}
      data-refused={read.block.status === 'failed' && read.block.refused ? '' : undefined}
      onClick={read.retry}
    />
  );
}

let root: Root | null = null;
let minute = 0;
const mount = (fn: string) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <RefetchBridge />
        <Probe fn={fn} />
      </NextIntlClientProvider>,
    );
  });
};
const probe = () => document.querySelector('[data-probe]') as HTMLButtonElement;
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(1)));
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const focus = () => act(() => void window.dispatchEvent(new Event('focus')));

beforeEach(() => {
  // each case starts a minute after the last: well past the shell's 15 s since the last refetch
  minute += 1;
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 10, 20, 10, minute)) });
  calls.length = 0;
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('a window that comes back is not a write', () => {
  it('the mark outlasts the shell’s wait before its focus refetch', () => {
    expect(BACK_WINDOW_MS).toBeGreaterThan(FOCUS_SETTLE_MS);
    const cameBackAt = 1_000_000;
    expect(refetchCause({ cameBackAt, now: cameBackAt + FOCUS_SETTLE_MS, busy: false })).toBe('back');
  });

  it('a doubt is always a write: no return of the window, an old one, or a write in flight', () => {
    const cameBackAt = 1_000_000;
    expect(refetchCause({ cameBackAt: null, now: cameBackAt, busy: false })).toBe('write');
    expect(refetchCause({ cameBackAt, now: cameBackAt + BACK_WINDOW_MS + 1, busy: false })).toBe('write');
    expect(refetchCause({ cameBackAt, now: cameBackAt + FOCUS_SETTLE_MS, busy: true })).toBe('write');
  });

  it('a read still on its way is left alone when the window comes back — it is not asked again', async () => {
    let land: (a: Answer) => void = () => {};
    answer = () => new Promise<Answer>((resolve) => (land = resolve));
    mount('made_up_health_on_its_way');
    await flush();
    expect(asked('made_up_health_on_its_way')).toBe(1);
    expect(probe().dataset.probe).toBe('loading');
    // the person looks away and comes back: the shell asks every screen to refetch, a moment after the focus
    focus();
    await wait(FOCUS_SETTLE_MS + 5);
    expect(asked('made_up_health_on_its_way'), 'the read on its way was thrown away and asked again').toBe(1);
    // and its answer, when it lands, is drawn
    land({ data: [{ key: 'checks_failed', count: 4, amount_sar: null }], error: null });
    await flush();
    expect(probe().dataset.probe).toBe('ready');
  });

  it('a fresh answer is not asked again either', async () => {
    answer = async () => ({ data: [], error: null });
    mount('made_up_health_fresh');
    await flush();
    expect(probe().dataset.probe).toBe('ready');
    focus();
    await wait(FOCUS_SETTLE_MS + 5);
    expect(asked('made_up_health_fresh')).toBe(1);
  });

  it('a write still asks every block again — also right after the window came back', async () => {
    answer = async () => ({ data: [], error: null });
    mount('made_up_health_written');
    await flush();
    expect(asked('made_up_health_written')).toBe(1);
    // a Finance screen's own write (not through command()): it says so, then asks for the refetch
    focus();
    financeWrote();
    act(() => refetchAll());
    await flush();
    expect(asked('made_up_health_written'), 'a write by a Finance screen').toBe(2);
    // a command() write: the busy count is held around its refetch
    focus();
    commandStarted();
    act(() => refetchAll());
    commandFinished();
    await flush();
    expect(asked('made_up_health_written'), 'a write through command()').toBe(3);
    // the return of the window counts once: a refetch after the shell's own is a write
    // past the shell's 15 s since its last refetch, and the answer is still fresh
    await wait(20_000);
    focus();
    await wait(FOCUS_SETTLE_MS + 5);
    expect(asked('made_up_health_written'), 'the window coming back').toBe(3);
    act(() => refetchAll());
    await flush();
    expect(asked('made_up_health_written'), 'a write a moment after the window came back').toBe(4);
  });
});

describe('a block knows a refusal from a failure', () => {
  it('the database’s refusal (42501) settles the block at once as refused — never Loading, never asked twice', async () => {
    answer = async () => ({ data: null, error: { code: '42501', message: 'access.needs_level' } });
    mount('made_up_health_refused');
    await flush();
    expect(probe().dataset.probe).toBe('failed');
    expect(probe().dataset.refused).toBe('');
    await wait(5_000);
    expect(asked('made_up_health_refused')).toBe(1);
  });

  it('a read the database could not answer in time fails after its one second ask — not as a refusal', async () => {
    answer = async () => ({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    });
    mount('made_up_health_slow');
    await wait(5_000);
    expect(probe().dataset.probe).toBe('failed');
    expect(probe().dataset.refused).toBeUndefined();
    expect(asked('made_up_health_slow')).toBe(2);
  });

  it('only the database’s "you may not" is a refusal', () => {
    expect(isRefusal(new DbError('PermissionDenied', 'access.needs_level'))).toBe(true);
    expect(isRefusal(new DbError('Unavailable', 'common.unavailable'))).toBe(false);
    expect(isRefusal(new DbError('RuleBroken', 'common.invalid'))).toBe(false);
    expect(isRefusal(new Error('network'))).toBe(false);
  });
});

describe('Try again always goes to the database', () => {
  it('an answer of nothing is not kept: Try again asks again and draws what comes back', async () => {
    let n = 0;
    answer = async () => (++n === 1 ? { data: null, error: null } : { data: [], error: null });
    mount('made_up_health_nothing');
    await flush();
    expect(asked('made_up_health_nothing')).toBe(1);
    act(() => probe().click());
    await flush();
    expect(asked('made_up_health_nothing'), 'Try again answered from what was kept').toBe(2);
    expect(probe().dataset.probe).toBe('ready');
  });

  it('an answer of nothing is never kept: the next ask of the same read goes to the database', async () => {
    let n = 0;
    answer = async () => (++n === 1 ? { data: null, error: null } : { data: [], error: null });
    const signal = new AbortController().signal;
    expect(await readFinance('made_up_health_null_twice' as never, {}, signal)).toBeNull();
    expect(await readFinance('made_up_health_null_twice' as never, {}, signal)).toEqual([]);
    expect(asked('made_up_health_null_twice')).toBe(2);
  });

  it('Try again on a kept answer asks afresh too', async () => {
    answer = async () => ({ data: [], error: null });
    mount('made_up_health_kept');
    await flush();
    act(() => probe().click());
    await flush();
    expect(asked('made_up_health_kept')).toBe(2);
  });
});
