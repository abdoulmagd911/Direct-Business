// @vitest-environment jsdom
/**
 * The board (26 Oct): a blocked task's card says "Blocked: <reason>" in full, and a task that is not blocked says
 * nothing. Every value is made up. Sabotages: tests/sabotage/screens.mjs "board-card-hides-the-block-reason",
 * "board-card-blames-an-unblocked-task".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { BlockReason } from '../../../src/modules/tasks/screens/BlockReason';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (task: Parameters<typeof BlockReason>[0]['task']) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BlockReason task={task} />
      </NextIntlClientProvider>,
    );
  });
};

describe('a card on the board', () => {
  it('says why a blocked task is blocked, in full', () => {
    const why = 'Waiting for the made-up supplier to confirm the made-up dates and the very long list of the rooms';
    draw({ meaning: 'in_progress', blocked_reason: why });
    const line = document.querySelector('[data-board-block-reason]');
    expect(line, 'a reason line').not.toBeNull();
    expect(line!.textContent).toBe(`Blocked: ${why}`);
  });

  it('says nothing for a task that is not blocked', () => {
    draw({ meaning: 'in_progress', blocked_reason: null });
    expect(document.querySelector('[data-board-block-reason]')).toBeNull();
    draw({ meaning: 'done', blocked_reason: 'an old reason' });
    expect(document.querySelector('[data-board-block-reason]'), 'a done task is not blocked').toBeNull();
  });
});
