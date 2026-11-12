// @vitest-environment jsdom
/**
 * F-B1-03 / F-B5-06 / F-B5-08 / F-B6-03 (stale-read family): after a write the screen keeps showing the pre-write
 * server props until the refresh's re-read lands, with nothing on screen saying the data is not current yet. The
 * bridge runs the refresh as a transition, so the top bar shows for exactly as long as the fresh read is on its way
 * and clears when the new props land — and the round-trip is timed, the client-side counterpart of serverRpc's
 * [serverRpc] log.
 *
 * The pending state itself is React's transition state, so the test drives it through a stand-in for
 * `useTransition` (the framework's own pending behaviour during a real `router.refresh()` is Next.js's documented
 * contract, exercised live by the re-test — not something a unit test can stage): the stand-in reports the pending
 * flag the test sets and runs the transition at once, which is exactly what the bridge asks of it.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { refetchAll } from '../../../src/core/commands/refetch';
import { RefetchBridge } from '../../../src/ui/shell/RefetchBridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const transitionState = vi.hoisted(() => ({
  pending: false,
  start: vi.fn((fn: () => void) => fn()),
}));
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useTransition: () => [transitionState.pending, transitionState.start] };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

let root: Root | null = null;
let host: HTMLElement | null = null;
let logSpy: ReturnType<typeof vi.spyOn> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  document.body.innerHTML = '';
  transitionState.pending = false;
  transitionState.start.mockClear();
  refreshMock.mockClear();
  logSpy?.mockRestore();
  logSpy = null;
});

const draw = () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <RefetchBridge />
      </NextIntlClientProvider>,
    );
  });
};

const redraw = () => {
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <RefetchBridge />
      </NextIntlClientProvider>,
    );
  });
};

const bar = () => host!.querySelector('[data-nav-pending]');

describe('the refresh shows while the new read is on its way', () => {
  it('a refetch asks the router to refresh, through a transition', () => {
    draw();
    act(() => {
      refetchAll();
    });
    expect(transitionState.start).toHaveBeenCalledTimes(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(bar()).toBeNull();
  });

  it('the top bar shows while the refresh is pending and clears when it lands', () => {
    draw();
    expect(bar()).toBeNull();
    transitionState.pending = true;
    redraw();
    expect(bar()).not.toBeNull();
    expect(bar()?.textContent).toContain('Loading');
    transitionState.pending = false;
    redraw();
    expect(bar()).toBeNull();
  });

  it('the round-trip is timed when a pending refresh settles', () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    draw();
    expect(logSpy).not.toHaveBeenCalled();
    transitionState.pending = true;
    redraw();
    expect(logSpy).not.toHaveBeenCalled();
    transitionState.pending = false;
    redraw();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toMatch(/^\[refetch\] ms=\d+$/);
  });

  it('a refresh that was never pending logs nothing', () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    draw();
    redraw();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
