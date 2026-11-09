// @vitest-environment jsdom
/**
 * F247: a typed Organisation was silently lost on save — the live observation stands, so this test replays the save
 * path end to end in the browser: type "Tabuk" in the Organisation box, pick the hit, save, and the achievement_log
 * call must carry that organisation's id. Every name is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Category } from '../../../src/modules/perf/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no PointerEvent — Radix opens and picks on pointer events, so a mouse-backed stand-in.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  (globalThis as { PointerEvent: unknown }).PointerEvent = class PointerEvent extends MouseEvent {
    pointerType: string;
    constructor(type: string, init?: MouseEventInit & { pointerType?: string }) {
      super(type, init);
      this.pointerType = init?.pointerType ?? 'mouse';
    }
  };
}
// jsdom has no pointer capture — Radix calls it on the trigger.
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
// jsdom has no scrolling — Radix scrolls the highlighted option into view.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn() }));
vi.mock('@/core/commands/run', () => ({
  command: vi.fn(async (_words: unknown, fn: () => Promise<unknown>, opts?: { after?: (r: unknown) => void }) => {
    const r = await fn();
    opts?.after?.(r);
    return r;
  }),
}));

import { rpc } from '@/core/db/rpc';
import { LogAchievement } from '../../../src/modules/perf/screens/LogAchievement';

const TABUK = { id: '11111111-1111-1111-1111-111111111111', name: 'Tabuk North Travel', number: 'DK-P-0028' };
const categories = [
  {
    code: 'COST',
    name_en: 'Cost savings',
    name_ar: 'توفير التكاليف',
    parent_id: null,
    is_money_link: false,
    has_deal_value: false,
    sets_prospect: false,
    required_ref_system: null,
    sort: 1,
    active: true,
  },
] as Category[];
const people = [
  { id: 'me-1', name: 'Me' },
  { id: 'p-2', name: 'Sara' },
];

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host = null;
  document.body.innerHTML = '';
  vi.mocked(rpc).mockReset();
});

const searchAnswer = (term: string) => ({
  term,
  tasks: [],
  partners: [
    {
      id: TABUK.id,
      name: TABUK.name,
      number: TABUK.number,
      type: 'client',
      scope: 'client',
      available: true,
    },
  ],
  mentions: [],
  reminders: [],
  events: [],
  activities: [],
  achievements: [],
  notes: [],
});

const draw = () => {
  (
    vi.mocked(rpc) as unknown as { mockImplementation: (fn: (name: string, args?: unknown) => unknown) => void }
  ).mockImplementation((name: string, args?: unknown) => {
    if (name === 'search') return Promise.resolve(searchAnswer((args as { q: string }).q));
    if (name === 'achievement_repeats') return Promise.resolve([]);
    if (name === 'achievement_log') {
      (draw as unknown as { logArgs?: unknown }).logArgs = args;
      return Promise.resolve({ id: 'ach-1', number: 'ACH-2026-0099', request_id: null });
    }
    return Promise.resolve([]);
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <LogAchievement
          categories={categories}
          year={2026}
          people={people}
          systems={[]}
          meId="me-1"
          initialTitle=""
          sourceTaskId=""
          full
          department={{ id: 'd1', name: 'Business Development' }}
          canOpenPlan={false}
        />
      </NextIntlClientProvider>,
    );
  });
};

const type = (el: HTMLInputElement, value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** Radix Select: open on pointerdown, pick on pointerup; fall back to the keyboard when the pointer does nothing. */
const pickCategory = async () => {
  const trigger = host!.querySelector('form button[data-state]') as HTMLButtonElement;
  act(() => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await act(async () => {});
  const findOption = () =>
    [...document.body.querySelectorAll('[role="option"]')].find((o) =>
      o.textContent?.includes('Cost savings'),
    ) as HTMLElement | null;
  let option = findOption();
  if (!option) {
    act(() => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    await act(async () => {});
    option = findOption();
  }
  expect(option, 'the category menu never opened').not.toBeNull();
  act(() => {
    option!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    option!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {});
  expect(trigger.textContent).toContain('Cost savings');
};

describe('F247: the typed Organisation is saved', () => {
  it('saves the picked organisation id with the achievement', async () => {
    draw();
    await pickCategory();
    const inputs = host!.querySelectorAll('form input');
    type(inputs[0] as HTMLInputElement, 'Renegotiated the Tabuk rate');
    const search = host!.querySelector('[data-partner-search]') as HTMLInputElement;
    type(search, 'Tabuk');
    await act(async () => {});
    await act(async () => {});
    const hit = host!.querySelector('[data-partner-hit]') as HTMLElement | null;
    expect(hit, 'no Tabuk hit appeared').not.toBeNull();
    act(() => {
      hit!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(host!.querySelector('[data-partner-picked]')?.getAttribute('data-partner-picked')).toBe(TABUK.id);
    const save = host!.querySelector('form button[type="submit"]') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    act(() => {
      save.click();
    });
    await act(async () => {});
    await act(async () => {});
    const args = (draw as unknown as { logArgs?: { p_values: { partner_id?: string | null } } }).logArgs;
    expect(args?.p_values?.partner_id).toBe(TABUK.id);
    // FIX-06: after save the form asks — view the record or log another — instead of navigating away.
    // (The dialog is a Radix portal, so it lives under the body, not the host.)
    expect(document.body.querySelector('[data-post-save]')?.textContent).toContain('ACH-2026-0099');
  });
});
