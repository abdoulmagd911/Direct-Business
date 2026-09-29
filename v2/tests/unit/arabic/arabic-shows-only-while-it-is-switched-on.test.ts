import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * QA-105 and the scenario catalogue's ACC-129/139: with Arabic switched off (`app.arabic_enabled`, V122 — off until
 * the owner approves it, P6-7) a stored `ar` choice still rendered Arabic. The language is Arabic only when the person
 * chose it AND the switch is on; a switch that cannot be read (an error, the function not there yet) reads as off,
 * and a person who reads English costs no read at all.
 * Sabotages: `arabic-ignores-the-switch`, `arabic-on-when-the-switch-cannot-be-read` (tests/sabotage/arabic.mjs).
 */
const cookie = { value: undefined as string | undefined };
const answer = { data: null as unknown, error: null as unknown, throws: false };
const rpc = vi.fn(async () => {
  if (answer.throws) throw new Error('the network is down');
  return { data: answer.data, error: answer.error };
});

vi.mock('server-only', () => ({}));
// Outside the server renderer next-intl ships its client stub; on the server getRequestConfig hands back the function.
vi.mock('next-intl/server', () => ({ getRequestConfig: <T>(fn: T) => fn }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'v2.locale' && cookie.value ? { value: cookie.value } : undefined),
  }),
}));
vi.mock('@/core/db/server', () => ({ serverDb: async () => ({ rpc }) }));

async function language(): Promise<{ locale: string; save: string }> {
  vi.resetModules(); // React's cache keeps one answer per request; each case is a new request.
  const config = (await import('@/core/i18n/request')).default as unknown as (p: {
    requestLocale: Promise<string | undefined>;
  }) => Promise<{ locale: string; messages: { common: { save: string } } }>;
  const out = await config({ requestLocale: Promise.resolve(undefined) });
  return { locale: out.locale, save: out.messages.common.save };
}

beforeEach(() => {
  cookie.value = undefined;
  Object.assign(answer, { data: null, error: null, throws: false });
  rpc.mockClear();
});

describe('the language a person reads', () => {
  it('is Arabic when they chose it and Arabic is switched on', async () => {
    cookie.value = 'ar';
    answer.data = { arabic_enabled: true };
    expect(await language()).toEqual({ locale: 'ar', save: 'حفظ' });
    expect(rpc).toHaveBeenCalledWith('app_flags');
  });

  it('is English when they chose Arabic but it is switched off', async () => {
    cookie.value = 'ar';
    answer.data = { arabic_enabled: false };
    expect(await language(), 'an ar cookie alone shows English').toEqual({ locale: 'en', save: 'Save' });
  });

  it.each([
    ['an error', () => void (answer.error = { code: 'PGRST202', message: 'no function api.app_flags' })],
    ['no answer', () => void (answer.data = null)],
    ['a thrown failure', () => void (answer.throws = true)],
    ['an answer that is not true', () => void (answer.data = { arabic_enabled: 'yes' })],
  ])('is English when the switch cannot be read (%s)', async (_, set) => {
    cookie.value = 'ar';
    set();
    expect(await language(), 'a switch that cannot be read is off').toEqual({ locale: 'en', save: 'Save' });
  });

  it('is English, with no read of the switch, for someone who chose English or nothing', async () => {
    answer.data = { arabic_enabled: true };
    for (const chosen of ['en', undefined, 'fr']) {
      cookie.value = chosen;
      expect(await language()).toEqual({ locale: 'en', save: 'Save' });
    }
    expect(rpc, 'no read for an English reader').not.toHaveBeenCalled();
  });
});
