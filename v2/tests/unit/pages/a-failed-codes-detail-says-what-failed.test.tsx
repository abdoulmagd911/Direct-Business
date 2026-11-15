/**
 * Landing 28: a failed code detail says what failed. The page used to fold the error into a yes/no (detailFailed),
 * so the on-and-off failures on /codes could not be told apart — a stall, a time-out or a refusal all read the same.
 * Now the error's kind and code reach the failed state: the code for a failure in transit, the wording key for a
 * refusal, and never the error's free text. Made-up answers only.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { DbError, toDbError } from '../../../src/core/db/errors';
import { failureRef } from '../../../src/core/db/read-again';

const { state } = vi.hoisted(() => ({ state: { fail: null as null | (() => Error) } }));
vi.mock('server-only', () => ({}));
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string) => {
    if (fn === 'codes_detail' && state.fail) throw state.fail();
    if (fn === 'codes_detail')
      return {
        id: 'code-1',
        code: 'MADEUP10',
        valid_from: null,
        valid_to: null,
        state: 'active',
        fee_percent: null,
        totals: { total_discount: null, total_collected: null, total_cost: null, total_profit: null, units: 0 },
        ledger: [],
        attributions: [],
      };
    if (fn === 'partners') return { rows: [] };
    return [];
  }),
}));
vi.mock('@/core/auth/require-me', () => ({
  requireMe: vi.fn(async () => ({ person: { id: 'made-up-person' }, levels: { codes: 'view' }, capabilities: [] })),
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k, getLocale: async () => 'en' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => '/codes',
  useSearchParams: () => new URLSearchParams(),
}));
const captured: Record<string, unknown> = {};
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: ReactElement }) => children }));
vi.mock('@/modules/codes/screens/CodesScreen', async (real) => {
  const actual = await real<typeof import('../../../src/modules/codes/screens/CodesScreen')>();
  return {
    CodesScreen: (props: Parameters<typeof actual.CodesScreen>[0]) => {
      Object.assign(captured, props);
      return actual.CodesScreen(props);
    },
  };
});

const { default: CodesPage } = await import('@/app/(app)/codes/page');
const CODE_ID = '11111111-1111-4111-8111-111111111111';
const run = async () => {
  const el = await CodesPage({ searchParams: Promise.resolve({ code: CODE_ID }) });
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {el as ReactElement}
    </NextIntlClientProvider>,
  );
};

beforeEach(() => {
  state.fail = null;
  for (const k of Object.keys(captured)) delete captured[k];
});

describe('a failed codes detail says what failed', () => {
  it('a statement cancelled for time shows its kind and its code', async () => {
    state.fail = () => toDbError({ code: '57014', message: 'canceling statement due to statement timeout' });
    const out = await run();
    expect(captured.detailFailed).toBe(true);
    expect(captured.detailError).toBe('Unavailable · 57014');
    expect(out).toContain('data-codes-detail-error');
    expect(out).toContain('Unavailable · 57014');
    expect(out, 'never the free text of the error').not.toContain('canceling statement');
  }, 15_000);

  it('a refusal shows its kind and its wording key', async () => {
    state.fail = () => new DbError('NotFound', 'common.not_found');
    await run();
    expect(captured.detailFailed).toBe(true);
    expect(captured.detailError).toBe('NotFound · common.not_found');
  });

  it('a detail that loads carries no error', async () => {
    const out = await run();
    expect(captured.detailFailed).toBe(false);
    expect(captured.detailError).toBeNull();
    expect(out).not.toContain('data-codes-detail-error');
  });
});

describe('the reference a failed read shows', () => {
  it('is the kind and the code for a failure in transit', () => {
    expect(failureRef(toDbError({ code: 'PGRST002', message: 'Could not query the database' }))).toBe(
      'Unavailable · PGRST002',
    );
    expect(failureRef(toDbError({ code: '57014', message: 'canceling statement' }))).toBe('Unavailable · 57014');
  });
  it('is the kind alone when the failure carries no code', () => {
    expect(failureRef(toDbError({ message: 'Internal server error.' }))).toBe('Unavailable');
    expect(failureRef(new DbError('Unavailable', 'common.unavailable'))).toBe('Unavailable');
  });
  it('is the kind and the key for a refusal', () => {
    expect(failureRef(toDbError({ code: '42501', message: 'test_switch.no_access_change' }))).toBe(
      'PermissionDenied · test_switch.no_access_change',
    );
  });
  it('and says only Unknown for anything that is not a database error', () => {
    expect(failureRef(new Error('made up, with free text'))).toBe('Unknown');
  });
});
