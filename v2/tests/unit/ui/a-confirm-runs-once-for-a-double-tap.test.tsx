// @vitest-environment jsdom
/**
 * The confirm box (ui/Confirm.tsx), the 13 Nov sweep: a removal that takes a moment kept the box open with its button
 * live, so a double tap on a phone sent the same removal twice — one "Removed" toast and one refusal. The confirming
 * button now runs once while the first run is on its way, shows it is working, and the box closes when it is done.
 * Every name is made up.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Confirm } from '../../../src/ui/Confirm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = (onConfirm: () => Promise<void>, onOpenChange: (o: boolean) => void) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <Confirm
        open
        onOpenChange={onOpenChange}
        title="Remove the made-up Dune Foods contact?"
        cancelLabel="Cancel"
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />,
    );
  });
  return document.querySelector('[data-confirm-action]') as HTMLButtonElement;
};

describe('a confirm runs once for a double tap', () => {
  it('runs the removal once, shows it working, and closes when it is done', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((done) => (finish = done)));
    const onOpenChange = vi.fn();
    const button = draw(onConfirm, onOpenChange);
    await act(async () => {
      button.click();
      button.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const live = document.querySelector('[data-confirm-action]') as HTMLButtonElement;
    expect(live.disabled).toBe(true);
    expect(live.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      live.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect((document.querySelector('[data-confirm-action]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the box open when the removal throws, and lets it be tried again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onConfirm = vi.fn(async () => {
      throw new Error('no answer');
    });
    const onOpenChange = vi.fn();
    const button = draw(onConfirm, onOpenChange);
    await act(async () => button.click());
    expect(onOpenChange).not.toHaveBeenCalled();
    await act(async () => (document.querySelector('[data-confirm-action]') as HTMLButtonElement).click());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
