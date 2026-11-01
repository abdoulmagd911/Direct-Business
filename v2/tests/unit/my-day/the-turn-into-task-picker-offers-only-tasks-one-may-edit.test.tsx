// @vitest-environment jsdom
/**
 * V662: the Turn into task picker offers only the tasks the person may add to — search says `can_edit` on each task row,
 * and a task they can only view is not drawn (nor a closed one). When nothing is left it says "No task found", as it
 * did before. Every task here is made up. Sabotage: tests/sabotage/turn-into-task-picker.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tasks: unknown[] = [];
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => ({ tasks })) }));

const { TaskPicker } = await import('../../../src/modules/my-day/screens/TaskPicker');

const row = (n: string, extra: Record<string, unknown> = {}) => ({
  id: `id-${n}`,
  number: n,
  title: `Made-up task ${n}`,
  closed: false,
  can_edit: true,
  ...extra,
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const search = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <TaskPicker value={null} onChange={() => {}} />
      </NextIntlClientProvider>,
    );
  });
  const box = document.querySelector('[data-task-search]') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    set.call(box, 'made');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const hits = () => [...document.querySelectorAll('[data-task-hit]')].map((h) => h.getAttribute('data-task-hit'));

describe('the Turn into task picker', () => {
  it('draws the tasks one may edit and leaves out one that is only viewed, and a closed one', async () => {
    tasks = [row('TSK-1'), row('TSK-2', { can_edit: false }), row('TSK-3', { closed: true }), row('TSK-4')];
    await search();
    expect(hits()).toEqual(['id-TSK-1', 'id-TSK-4']);
  });
  it('says "No task found" when every hit is view-only', async () => {
    tasks = [row('TSK-5', { can_edit: false }), row('TSK-6', { can_edit: false })];
    await search();
    expect(hits()).toEqual([]);
    expect(document.querySelector('[data-task-hits]')?.textContent).toBe(en.pages.myDay.turn.noTask);
  });
  it('keeps a task whose row does not say (an answer without can_edit): the database still refuses it in words', async () => {
    tasks = [row('TSK-7', { can_edit: undefined })];
    await search();
    expect(hits()).toEqual(['id-TSK-7']);
  });
});
