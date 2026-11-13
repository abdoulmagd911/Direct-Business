// @vitest-environment jsdom
/**
 * Two quick ticks on a checklist's rows on My day both hold (D-myday, 13 Nov): the second tick, made before the page's
 * re-read arrives, builds on the first — it writes over the version the first save answered and keeps the first row
 * ticked. Before, it wrote over the page's older copy: the database refused it as "someone changed this since you
 * opened it" (or, had the version matched, it would have undone the first tick). The ticked row leaves the list at once.
 * Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { MyNote } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const calls: { p_version: number; done: boolean[] }[] = [];
vi.mock('@/core/db/rpc', () => ({
  rpc: vi.fn(async (fn: string, args: { p_version: number; p_values: { items: { done: boolean }[] } }) => {
    if (fn !== 'note_update') return null;
    calls.push({ p_version: args.p_version, done: args.p_values.items.map((i) => i.done) });
    return { id: 'n1', request_id: `r${calls.length}`, version: args.p_version + 1 };
  }),
}));

const { NoteRow } = await import('../../../src/modules/my-day/screens/NoteBits');

const note = {
  id: 'n1',
  version: 4,
  kind: 'checklist',
  capture_kind: 'checklist',
  title: 'Made-up packing list',
  body: null,
  items: [
    { text: 'Made-up passport', done: false },
    { text: 'Made-up tickets', done: false },
    { text: 'Made-up voucher', done: false },
  ],
  visibility: 'private',
  happened_on: '2026-11-13',
  logged_at: '2026-11-13T07:00:00Z',
  author_id: 'p1',
  mine: true,
  meeting_partner: null,
  meeting_on: null,
  finished_at: null,
  carried_to: null,
  done_at: null,
  mentions: [],
  links: [],
} as unknown as MyNote;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const ticks = () => [...document.querySelectorAll('[data-note-tick]')];
const tick = async (row: Element) => {
  await act(async () => {
    (row.querySelector('button') as HTMLButtonElement).click();
  });
};

describe('two quick ticks on a checklist on My day', () => {
  it('both hold: the second builds on the version and the rows the first save left', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
          <ul>
            <NoteRow note={note} />
          </ul>
        </NextIntlClientProvider>,
      );
    });
    expect(ticks().map((r) => r.textContent)).toEqual(['Made-up passport', 'Made-up tickets', 'Made-up voucher']);
    await tick(ticks()[0]!);
    // the page has not been read again (the note prop is still version 4): the ticked row has left the list anyway
    expect(ticks().map((r) => r.textContent)).toEqual(['Made-up tickets', 'Made-up voucher']);
    await tick(ticks()[0]!);
    expect(calls).toEqual([
      { p_version: 4, done: [true, false, false] },
      { p_version: 5, done: [true, true, false] },
    ]);
    expect(ticks().map((r) => r.textContent)).toEqual(['Made-up voucher']);
  });
});
