// @vitest-environment jsdom
/**
 * F-B3-04 (Landing 15): the codes list has a search box — typing part of a code's text narrows the list to
 * the codes carrying it, in the list's own order; a text no code carries says so. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { CodeRow } from '../../../src/modules/codes/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { CodesScreen } = await import('../../../src/modules/codes/screens/CodesScreen');

const row = (over: Partial<CodeRow>): CodeRow => ({
  id: over.id ?? 'id',
  code: over.code ?? 'CODE',
  valid_from: over.valid_from ?? null,
  valid_to: over.valid_to ?? null,
  state: over.state ?? 'active',
  total_discount: over.total_discount ?? null,
  total_collected: over.total_collected ?? null,
  units: over.units ?? 0,
});
const rows = [
  row({ id: 'a', code: 'FLIGHTS10', total_discount: 100 }),
  row({ id: 'b', code: 'HOTEL20', total_discount: 50 }),
  row({ id: 'c', code: 'FLIGHTS20', total_discount: null }),
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <CodesScreen
          rows={rows}
          detail={null}
          companyRows={[]}
          partners={[]}
          full={false}
          selectedId={null}
          listFailed={false}
          detailFailed={false}
          companiesFailed={false}
          files={null}
          filesFailed={false}
        />
      </NextIntlClientProvider>,
    );
  });
};

const type = async (text: string) => {
  const input = document.querySelector('[data-codes-search]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const shown = () => [...document.querySelectorAll('[data-codes-page] ul li')].map((li) => li.textContent ?? '');

describe('the codes list searches by code text', () => {
  it('narrows to the codes carrying the typed fragment, in the list order', async () => {
    await draw();
    expect(shown().length).toBe(3);
    await type('flights');
    expect(shown().map((t) => t.slice(0, 9))).toEqual(['FLIGHTS10', 'FLIGHTS20']);
    await type('flights1');
    expect(shown().map((t) => t.slice(0, 9))).toEqual(['FLIGHTS10']);
    await type('');
    expect(shown().length).toBe(3);
  });

  it('and says so when no code carries the text', async () => {
    await draw();
    await type('zzz');
    expect(shown().length).toBe(0);
    expect(document.body.textContent).toContain('No codes match this search.');
  });
});
