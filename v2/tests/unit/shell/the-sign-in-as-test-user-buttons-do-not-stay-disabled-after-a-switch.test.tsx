// @vitest-environment jsdom
/**
 * F-B6-01(e): the "Sign in as test user" buttons stayed disabled after a switch that had already succeeded —
 * `attempt()` cleared `busy` only in the `catch`, so on success the old page sat there with every switch button
 * disabled while the new page loaded. The buttons re-enable once the switch is through, on success and on refusal
 * alike. Made-up people; the switch itself is mocked at the rpc.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { DbError } from '../../../src/core/db/errors';
import { useTestSwitch } from '../../../src/core/test-switch/use-test-switch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rpcMock = vi.hoisted(() => vi.fn());
const toastFailed = vi.hoisted(() => vi.fn());
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));
vi.mock('@/ui/Toast', () => ({ toast: { failed: toastFailed, done: vi.fn(), working: vi.fn(), dismiss: vi.fn() } }));

function Probe() {
  const sw = useTestSwitch();
  return (
    <div>
      <button disabled={sw.busy} data-start onClick={() => void sw.start('person-1')}>
        Start
      </button>
      <button disabled={sw.busy} data-end onClick={() => void sw.end()}>
        End
      </button>
      <span data-busy={sw.busy ? 'yes' : 'no'} />
    </div>
  );
}

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  document.body.innerHTML = '';
  rpcMock.mockReset();
  toastFailed.mockReset();
});

const draw = () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <Probe />
      </NextIntlClientProvider>,
    );
  });
};

const busy = () => host!.querySelector('[data-busy]')?.getAttribute('data-busy');
const click = (sel: string) =>
  act(() => {
    (host!.querySelector(sel) as HTMLButtonElement).click();
  });

describe('the switch buttons do not stay disabled after a switch', () => {
  it('a slow sign-in re-enables the buttons once the switch is through', async () => {
    let release: (v: unknown) => void = () => {};
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'me') return Promise.resolve({ status: 'ok', profile: { theme: 'light', density: 'compact' } });
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    draw();
    expect(busy()).toBe('no');
    click('[data-start]');
    // the switch is still in flight: the buttons are held, so a second press cannot start another switch
    expect(busy()).toBe('yes');
    expect((host!.querySelector('[data-start]') as HTMLButtonElement).disabled).toBe(true);
    release({});
    await act(async () => {});
    await act(async () => {});
    // the switch succeeded server-side and the page is starting over: the old page's buttons are usable again
    // while the new page loads, instead of sitting disabled on a switch that already happened
    expect(busy()).toBe('no');
    expect((host!.querySelector('[data-start]') as HTMLButtonElement).disabled).toBe(false);
    expect(rpcMock).toHaveBeenCalledWith('test_switch_start', { p_person: 'person-1' });
  });

  it('Back to my account re-enables once the switch back is through', async () => {
    let release: (v: unknown) => void = () => {};
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'me') return Promise.resolve({ status: 'ok', profile: { theme: 'light', density: 'compact' } });
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    draw();
    click('[data-end]');
    expect(busy()).toBe('yes');
    release({});
    await act(async () => {});
    await act(async () => {});
    expect(busy()).toBe('no');
    expect(rpcMock).toHaveBeenCalledWith('test_switch_end', {});
  });

  it('a refused switch re-enables the buttons and says the refusal', async () => {
    rpcMock.mockRejectedValue(new DbError('PermissionDenied', 'test_switch.not_allowed'));
    draw();
    click('[data-start]');
    expect(busy()).toBe('yes');
    await act(async () => {});
    await act(async () => {});
    expect(busy()).toBe('no');
    expect((host!.querySelector('[data-start]') as HTMLButtonElement).disabled).toBe(false);
    expect(toastFailed).toHaveBeenCalledTimes(1);
  });
});
