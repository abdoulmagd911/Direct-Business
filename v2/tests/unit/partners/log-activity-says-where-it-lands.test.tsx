// @vitest-environment jsdom
/**
 * Log activity (22 Oct rulings): the title names the organisation with a Change link, and the type opens filled — Call
 * the first time — so it is never an empty box. Every name is made up.
 * Sabotages: tests/sabotage/log-activity-entry.mjs "log-activity-type-opens-empty", "log-activity-title-names-nobody".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { ListEntry } from '../../../src/modules/partners/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ person: { id: 'p1' } }) }));

const { LogActivityDialog } = await import('../../../src/modules/partners/screens/record/LogActivityDialog');

const types = [
  { id: 't1', key: 'whatsapp', name_en: 'WhatsApp', name_ar: 'واتساب' },
  { id: 't2', key: 'call', name_en: 'Call', name_ar: 'مكالمة' },
] as unknown as ListEntry[];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  window.localStorage.clear();
});
const draw = (extra: Record<string, unknown>) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <LogActivityDialog
          open
          onOpenChange={() => {}}
          partnerId="x"
          types={types}
          outcomes={[]}
          onDone={() => {}}
          {...extra}
        />
      </NextIntlClientProvider>,
    );
  });
};
const typeBox = () => document.querySelector('[data-activity-form] button[role="combobox"]')?.textContent;

describe('Log activity', () => {
  it('names the organisation in the title and offers Change', () => {
    draw({ partnerName: 'TEST Org One', onChangeWho: () => {} });
    expect(document.body.textContent).toContain('Log activity for TEST Org One');
    expect(document.querySelector('[data-activity-change]')).not.toBeNull();
  });

  it('keeps the plain title and no Change on a record page', () => {
    draw({});
    expect(document.querySelector('[data-activity-change]')).toBeNull();
    expect(document.body.textContent).not.toContain('Log activity for');
  });

  it('opens on Call the first time, never on an empty type', () => {
    draw({});
    expect(typeBox()).toBe('Call');
  });

  it('opens on the type this person used last', () => {
    window.localStorage.setItem('activity-last-type:p1', 'whatsapp');
    draw({});
    expect(typeBox()).toBe('WhatsApp');
  });
});
