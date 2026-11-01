// @vitest-environment jsdom
/**
 * QA 2 on #378: typing 25:99 or abc in the Reminder's Time box turned it red but left Save on, so Save would have set the
 * reminder for the last good time. Now Save stays off and one line beside it says what is missing (V654 (6)); a time
 * typed any common way (2130) saves as 21:30. Every name is made up.
 * Sabotage: tests/sabotage/reminder-when-box.mjs "reminder-save-ignores-the-typed-time".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { MyNote } from '../../../src/modules/my-day/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn() }));

const { ReminderDialog } = await import('../../../src/modules/my-day/screens/TurnDialogs');

const note = { id: 'n1', title: 'Call the made-up Dune Foods buyer', body: '' } as unknown as MyNote;
let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        <ReminderDialog note={note} open onOpenChange={() => {}} />
      </NextIntlClientProvider>,
    );
  });
};
const type = (selector: string, value: string) => {
  const box = document.querySelector(selector) as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const save = () => document.querySelector('[data-reminder-save]') as HTMLButtonElement;
const why = () => document.querySelector('[data-reminder-why]')?.textContent ?? null;

describe('the Reminder dialog and a time that is not a time', () => {
  it('opens ready to save: tomorrow 09:00, nothing missing', () => {
    draw();
    expect(save().disabled).toBe(false);
    expect(why()).toBeNull();
  });
  for (const bad of ['25:99', 'abc']) {
    it(`keeps Save off and says what is missing for "${bad}"`, () => {
      draw();
      type('[data-reminder-time]', bad);
      expect(save().disabled).toBe(true);
      expect(why()).toBe(en.pages.myDay.turn.reminderMissing.time);
    });
  }
  it('turns Save back on once the time reads again', () => {
    draw();
    type('[data-reminder-time]', '25:99');
    type('[data-reminder-time]', '2130');
    expect(save().disabled).toBe(false);
    expect(why()).toBeNull();
  });
  it('says it in Arabic too', () => {
    draw('ar');
    type('[data-reminder-time]', 'abc');
    expect(why()).toBe(ar.pages.myDay.turn.reminderMissing.time);
  });
});
