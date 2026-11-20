// @vitest-environment jsdom
/**
 * Landing 32 (Finance F-B), A2 — Exclude / Include on a ledger row open the reason box: the confirming button stays
 * disabled until a reason is typed, and the change then runs once with the row and the reason typed. A refusal is
 * said in the box, in words, and the box stays open. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-finance-ledger.mjs "exclude-runs-as-include", "a-change-runs-without-a-reason".
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DbError } from '../../../src/core/db/errors';
import { FinanceReport } from '../../../src/modules/finance/screens/FinanceReport';
import type { LedgerRow } from '../../../src/modules/finance/types';
import { byHand, inWords, report, row } from './landing-32-fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

type Toggle = (kind: 'exclude' | 'include', row: LedgerRow, reason: string) => Promise<void>;
const draw = (onToggle: Toggle) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      inWords(
        <FinanceReport
          report={report([row(1), byHand(3)], { canToggle: true })}
          loading={false}
          failed={false}
          onRetry={() => {}}
          onToggle={onToggle}
        />,
      ),
    );
  });
};
const one = <T extends Element>(hook: string) => document.querySelector(`[${hook}]`) as T | null;
const press = async (hook: string) => {
  await act(async () => one<HTMLButtonElement>(hook)!.click());
};
const type = async (text: string) => {
  const box = one<HTMLTextAreaElement>('data-reason')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('Exclude and Include need a reason', () => {
  it('Exclude opens the reason box, naming the row, and its button waits for a reason', async () => {
    draw(vi.fn(async () => {}));
    expect(one('data-reason'), 'no box before the button is pressed').toBeNull();
    await press('data-ledger-exclude');
    expect(document.body.textContent).toContain('Exclude row TX-MADE-1?');
    expect(document.body.textContent).toContain('Reason (required)');
    expect(one<HTMLButtonElement>('data-reason-save')!.disabled, 'no reason, no Exclude').toBe(true);
    await type('   ');
    expect(one<HTMLButtonElement>('data-reason-save')!.disabled, 'spaces are not a reason').toBe(true);
    await type('Made-up duplicate booking');
    expect(one<HTMLButtonElement>('data-reason-save')!.disabled).toBe(false);
  });

  it('Exclude runs once, as an exclusion, with the row and the reason typed', async () => {
    const onToggle = vi.fn<Toggle>(async () => {});
    draw(onToggle);
    await press('data-ledger-exclude');
    await type('  Made-up duplicate booking ');
    await press('data-reason-save');
    expect(onToggle).toHaveBeenCalledTimes(1);
    const [kind, asked, reason] = onToggle.mock.calls[0]!;
    expect(kind).toBe('exclude');
    expect(asked).toMatchObject({ number: 'TX-MADE-1', source_partner_id: 'p-made-up' });
    expect(reason).toBe('Made-up duplicate booking');
  });

  it('Include runs as an inclusion, on the row excluded by hand', async () => {
    const onToggle = vi.fn<Toggle>(async () => {});
    draw(onToggle);
    await press('data-ledger-include');
    expect(document.body.textContent).toContain('Include row TX-MADE-3?');
    expect(one<HTMLButtonElement>('data-reason-save')!.disabled, 'no reason, no Include').toBe(true);
    await type('Made-up: it was a real booking');
    await press('data-reason-save');
    expect(onToggle.mock.calls[0]![0]).toBe('include');
    expect(onToggle.mock.calls[0]![1]).toMatchObject({ number: 'TX-MADE-3' });
  });

  it('a refusal is said in the box, in words, and the box stays open', async () => {
    draw(async () => {
      throw new DbError('RuleBroken', 'finance.row_excluded_by_list', 'TX-MADE-3');
    });
    await press('data-ledger-include');
    await type('Made-up reason');
    await press('data-reason-save');
    const said = document.querySelector('[role="alert"]')?.textContent ?? '';
    expect(said).toContain('Row TX-MADE-3 is excluded by a list rule — change it in Settings → Finance');
    expect(one('data-reason'), 'the box is still open, the reason kept').not.toBeNull();
    expect(one<HTMLTextAreaElement>('data-reason')!.value).toBe('Made-up reason');
  });
});
