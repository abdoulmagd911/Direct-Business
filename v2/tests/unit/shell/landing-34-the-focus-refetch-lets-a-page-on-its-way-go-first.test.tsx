// @vitest-environment jsdom
/**
 * Landing 34, item 10 (the 19 Nov test round: "Finance did nothing on the first click; Tasks did nothing twice"). A
 * window that comes back refetches the page it shows (TECH-SPEC §2.4) — and the click that brings a window back is
 * very often a click on a link, with "focus" said at the press and "click" at the release. So the refetch started a
 * whole re-read of the page being LEFT a moment before the move began, and the two raced on a slow database. Now the
 * refetch waits a moment, and never runs while a page is on its way or a write is in flight.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { commandFinished, commandStarted } from '../../../src/core/commands/refetch';
import { navSettled, navStartedTo } from '../../../src/ui/shell/nav-pending';
import { FOCUS_SETTLE_MS, RefetchBridge } from '../../../src/ui/shell/RefetchBridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

let root: Root | null = null;
let minute = 0;
beforeEach(() => {
  // each case starts a minute after the last: well past the 15 s since the last refetch
  minute += 1;
  vi.useFakeTimers({ now: new Date(Date.UTC(2026, 10, 20, 9, minute)) });
  window.history.replaceState(null, '', '/partners/made-up');
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <RefetchBridge />
      </NextIntlClientProvider>,
    );
  });
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  refreshMock.mockClear();
  navSettled();
  vi.useRealTimers();
});

const focus = () => act(() => void window.dispatchEvent(new Event('focus')));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('the focus refetch lets a page on its way go first', () => {
  it('a window that comes back refetches — a moment later, not at the press', () => {
    focus();
    expect(refreshMock, 'not at the press: the click of the same tap comes first').not.toHaveBeenCalled();
    wait(FOCUS_SETTLE_MS + 1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
  it('the tap that brought the window back was a tap on a link: the page being left is not read again', () => {
    focus();
    // the release of the same tap: a move to another page begins
    act(() => void navStartedTo('/finance'));
    wait(FOCUS_SETTLE_MS + 1);
    expect(refreshMock).not.toHaveBeenCalled();
  });
  it('a write in flight still holds the refetch back (F131)', () => {
    commandStarted();
    try {
      focus();
      wait(FOCUS_SETTLE_MS + 1);
      expect(refreshMock).not.toHaveBeenCalled();
    } finally {
      commandFinished();
    }
  });
  it('two "came back" signals of one return (focus and visibility) are one refetch', () => {
    focus();
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    wait(FOCUS_SETTLE_MS + 1);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
