// @vitest-environment jsdom
// F-B3-04 (Landing 15): the codes detail is tried once more when its read fails in transit (a stalled
// gateway call, kind Unavailable) — so an intermittent stall no longer drops the detail into a failed
// state — and gives up after that, while a refusal the database gave is never retried. Made-up answers only.
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DbError } from '@/core/db/errors';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { calls, captured, failDetail, failRefusal } = vi.hoisted(() => ({
  calls: [] as string[],
  captured: {} as Record<string, unknown>,
  failDetail: { times: 0 },
  failRefusal: { times: 0 },
}));
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn((fn: string) => {
    calls.push(fn);
    if (fn === 'codes_detail' && failRefusal.times > 0) {
      failRefusal.times -= 1;
      throw new DbError('NotFound', 'common.not_found');
    }
    if (fn === 'codes_detail' && failDetail.times > 0) {
      failDetail.times -= 1;
      throw new DbError('Unavailable', 'common.unavailable');
    }
    if (fn === 'codes_list') return Promise.resolve([]);
    if (fn === 'codes_by_company') return Promise.resolve([]);
    if (fn === 'codes_detail')
      return Promise.resolve({ id: 'code-1', code: 'FLIGHTS10', ledger: [], attributions: [] });
    if (fn === 'partners') return Promise.resolve({ rows: [] });
    if (fn === 'files') return Promise.resolve([]);
    return Promise.resolve(null);
  }),
}));
const me = { person: { id: 'made-up-person' }, levels: { codes: 'view' }, capabilities: [] };
vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
  getLocale: async () => 'en',
}));
vi.mock('@/modules/codes/screens/CodesScreen', () => ({
  CodesScreen: (props: Record<string, unknown>) => {
    Object.assign(captured, props);
    return null;
  },
}));
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: ReactNode }) => children }));

const { default: CodesPage } = await import('@/app/(app)/codes/page');

const CODE_ID = '11111111-1111-4111-8111-111111111111';

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

/** Runs the page and renders what it answers, so the screen's props are captured. */
const run = async () => {
  const el = await CodesPage({ searchParams: Promise.resolve({ code: CODE_ID }) });
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(el);
  });
};

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(captured)) delete captured[k];
  failDetail.times = 0;
  failRefusal.times = 0;
});

describe('the codes detail is tried again after a stalled read', () => {
  it('a detail read that fails once in transit lands on the second try', async () => {
    failDetail.times = 1;
    await run();
    expect(calls.filter((c) => c === 'codes_detail').length).toBe(2);
    expect(captured.detail, 'the detail lands').not.toBeNull();
    expect(captured.detailFailed).toBe(false);
  });

  it('and a detail that keeps failing is a failed state, not a silent empty one', async () => {
    failDetail.times = 5;
    await run();
    expect(calls.filter((c) => c === 'codes_detail').length).toBe(2);
    expect(captured.detail).toBeNull();
    expect(captured.detailFailed).toBe(true);
  });

  it('a refusal the database gave is never retried', async () => {
    failRefusal.times = 1;
    await run();
    expect(calls.filter((c) => c === 'codes_detail').length).toBe(1);
    expect(captured.detail).toBeNull();
    expect(captured.detailFailed).toBe(true);
  });
});
