// @vitest-environment jsdom
/**
 * Landing 29 — the bar of its spec, section 6: when the window comes back, no read is sent twice and no read still on
 * its way is sent again. Landing 34 built the mechanism (a window coming back is not a write); this test is the proof
 * on a whole page: the real shell bridge beside six blocks — two that have answered, two still on their way, one a
 * twin of a read on its way, one still waiting for its turn (two reads at a time). Every request that leaves the
 * browser is counted. Every value is made up.
 * Sabotage: tests/sabotage/landing-29.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { FOCUS_SETTLE_MS, RefetchBridge } from '../../../src/ui/shell/RefetchBridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

type Answer = { data: unknown; error: null };
const sent: string[] = [];
/** The reads that answer only when the test lets them. */
const held = new Map<string, ((a: Answer) => void)[]>();
let slow = new Set<string>();
vi.mock('@/core/db/client', () => ({
  browserDb: () => ({
    rpc: (fn: string) => {
      sent.push(fn);
      if (!slow.has(fn)) return Promise.resolve({ data: [fn], error: null });
      return new Promise<Answer>((resolve) => held.set(fn, [...(held.get(fn) ?? []), resolve]));
    },
  }),
}));

const { BACK_STALE_MS, LIMIT, useFinanceRead } = await import('../../../src/modules/finance/use-reads');

const times = (fn: string) => sent.filter((c) => c === fn).length;
const land = (fn: string) => {
  const waiting = held.get(fn) ?? [];
  held.delete(fn);
  for (const resolve of waiting) resolve({ data: [fn], error: null });
};

function Block({ fn, id }: { fn: string; id: string }) {
  const read = useFinanceRead<unknown, never>(fn as never, {} as never, fn);
  return <span data-block={id} data-status={read.block.status} />;
}

let root: Root | null = null;
const mount = (blocks: { fn: string; id: string }[]) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <RefetchBridge />
        {blocks.map((b) => (
          <Block key={b.id} fn={b.fn} id={b.id} />
        ))}
      </NextIntlClientProvider>,
    );
  });
};
const status = (id: string) => (document.querySelector(`[data-block="${id}"]`) as HTMLElement).dataset.status;
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(1)));
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
/** The person looks away and comes back; the shell asks every screen to refetch a moment after the focus. */
const comeBack = async () => {
  act(() => void window.dispatchEvent(new Event('focus')));
  await wait(FOCUS_SETTLE_MS + 5);
};

let hour = 0;
beforeEach(() => {
  hour += 1;
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 10, 22, hour)) });
  sent.length = 0;
  held.clear();
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('Landing 29: a window that comes back sends no read twice', () => {
  it('nothing is sent when the window comes back to a page still loading; every read is sent exactly once', async () => {
    const page = ['l29_a_done_1', 'l29_a_done_2', 'l29_a_slow_1', 'l29_a_slow_2', 'l29_a_queued'];
    slow = new Set(['l29_a_slow_1', 'l29_a_slow_2', 'l29_a_queued']);
    mount([...page.map((fn) => ({ fn, id: fn })), { fn: 'l29_a_slow_1', id: 'twin' }]);
    await flush();
    expect(LIMIT, 'two reads at a time').toBe(2);
    expect(sent, 'the first load: two answered, two on their way, one waits for its turn').toEqual([
      'l29_a_done_1',
      'l29_a_done_2',
      'l29_a_slow_1',
      'l29_a_slow_2',
    ]);

    await comeBack();
    expect(sent.length, 'the window came back and a read was sent again').toBe(4);
    expect(status('l29_a_slow_1'), 'a read on its way stays on its way').toBe('loading');
    expect(status('l29_a_done_1')).toBe('ready');

    // the reads on their way land; the one waiting takes its turn; the twin is answered by the same request
    land('l29_a_slow_1');
    await flush();
    land('l29_a_slow_2');
    await flush();
    land('l29_a_queued');
    await flush();
    for (const fn of page) expect(times(fn), `${fn} was sent more than once`).toBe(1);
    expect(sent.length, 'the same read asked by two blocks was sent twice').toBe(5);
    for (const id of [...page, 'twin']) expect(status(id)).toBe('ready');
  });

  it('answers gone old are asked once each, the figures stay on screen meanwhile, and a second return sends nothing', async () => {
    const page = ['l29_b_one', 'l29_b_two', 'l29_b_three'];
    slow = new Set();
    mount(page.map((fn) => ({ fn, id: fn })));
    await flush();
    expect(sent.length).toBe(3);

    // a short look away: the answers are fresh, nothing is sent
    await wait(20_000);
    await comeBack();
    expect(sent.length, 'a fresh answer was asked again').toBe(3);

    // a long one: every answer is older than a minute, and each is asked again — two at a time, the third waits
    slow = new Set(page);
    await wait(BACK_STALE_MS + 1_000);
    await comeBack();
    expect(sent.slice(3), 'an old answer is asked again when the window comes back').toEqual([
      'l29_b_one',
      'l29_b_two',
    ]);
    for (const fn of page)
      expect(status(fn), 'the figures gave way to Loading when the window came back').toBe('ready');

    // the person comes back again while those are on their way (past the shell's 15 s, inside the reads' own 20 s
    // deadline): nothing more is sent
    await wait(16_000);
    await comeBack();
    expect(sent.length, 'a read on its way was sent again on the second return').toBe(5);
    land('l29_b_one');
    await flush();
    land('l29_b_two');
    await flush();
    for (const fn of page) expect(times(fn), `${fn}: an old answer is asked again exactly once`).toBe(2);
    for (const fn of page) land(fn);
    await flush();
    for (const fn of page) expect(status(fn)).toBe('ready');
  });
});
