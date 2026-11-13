// @vitest-environment jsdom
/**
 * The reminder alert comes even when the job tells the reminder late (D-myday, 13 Nov). At a reminder's time the screen
 * asks for it; when the job (every minute) has not told it yet, the answer carries the same next_at as before. The one
 * timer was set only when next_at changed, so it was never set again and the alert never came while the page stayed
 * open. It is now set again after every read, so the screen asks every 15 s until the job has told it. Every value is
 * made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ person: { id: 'p1' }, levels: {} }) }));
const TIME = '2026-11-13T09:00:00Z';
let told = false;
let reads = 0;
vi.mock('@/core/db/rpc', () => ({
  rpc: vi.fn(async (fn: string) => {
    if (fn !== 'reminders_due') return null;
    reads += 1;
    return told
      ? {
          due: [{ id: 'r1', note_id: 'n1', text: 'Made-up call the hotel back', remind_at: TIME, notification_id: 'x1' }],
          next_at: null,
        }
      : { due: [], next_at: TIME };
  }),
}));

const { ReminderAlert } = await import('../../../src/modules/my-day/screens/ReminderAlert');

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const settle = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('the reminder alert, when the job tells it late', () => {
  it('keeps asking every 15 s after the time and shows the alert once the job has told it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-11-13T08:59:00Z'));
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
          <ReminderAlert />
        </NextIntlClientProvider>,
      );
    });
    await settle(0);
    expect(reads).toBe(1);
    // the time comes; the screen asks 5 s after it, but the job has not told it yet
    await settle(65_000);
    expect(reads).toBe(2);
    expect(document.querySelector('[data-reminder-alert]')).toBeNull();
    // 15 s later it asks again, and again — the job tells it in between
    await settle(15_000);
    expect(reads).toBe(3);
    told = true;
    await settle(15_000);
    expect(reads).toBe(4);
    expect(document.querySelector('[data-alert-text]')?.textContent).toBe('Made-up call the hotel back');
  });
});
