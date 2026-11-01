// @vitest-environment jsdom
/**
 * The board: a cancelled task's card says "Cancelled: <reason>" in full, and a
 * task that is not cancelled says nothing. Mirrors the blocked-card test.
 * Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { CancelReason } from '../../../src/modules/tasks/screens/CancelReason';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (task: Parameters<typeof CancelReason>[0]['task']) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <CancelReason task={task} />
      </NextIntlClientProvider>,
    );
  });
};

describe('a card on the board', () => {
  it('says why a cancelled task was cancelled, in full', () => {
    const why = 'The made-up client withdrew the made-up request';
    draw({ meaning: 'cancelled', cancelled_reason: why });
    const line = document.querySelector('[data-board-cancel-reason]');
    expect(line, 'a reason line').not.toBeNull();
    expect(line!.textContent).toBe(`Cancelled: ${why}`);
  });

  it('says nothing for a task that is not cancelled', () => {
    draw({ meaning: 'in_progress', cancelled_reason: null });
    expect(document.querySelector('[data-board-cancel-reason]')).toBeNull();
    draw({ meaning: 'done', cancelled_reason: 'an old reason' });
    expect(document.querySelector('[data-board-cancel-reason]'), 'a done task is not cancelled').toBeNull();
  });
});
