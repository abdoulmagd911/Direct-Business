import { describe, expect, it, vi } from 'vitest';

/**
 * English beneath Arabic where the app loads its language (V305, V410): `core/i18n/request.ts` hands next-intl the
 * Arabic catalog merged over the English one, so a key not yet in Arabic shows its English — never its key. This
 * holds whatever reads the Arabic switch (builder B's V214 gate, #120; builder A's V182, #136): the database stand-in
 * answers "Arabic on" to either reader. The Arabic catalog here holds one word, so every other key must come from English.
 * Sabotage: `request-drops-the-english-fallback` (tests/sabotage/arabic.mjs).
 */
const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(async (name: string) => ({
    data: name === 'app_settings' ? { 'app.arabic_enabled': true } : { arabic_enabled: true },
    error: null,
  })),
}));

vi.mock('server-only', () => ({}));
// Outside the server renderer next-intl ships its client stub; on the server getRequestConfig hands back the function.
vi.mock('next-intl/server', () => ({ getRequestConfig: <T>(fn: T) => fn }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'v2.locale' ? { value: 'ar' } : undefined) }),
}));
vi.mock('@/core/db/server', () => ({
  serverDb: async () => ({ rpc, auth: { getSession: async () => ({ data: {} }) } }),
}));
// V182 (#136): the admin's App settings are read with the server's own key, so the Arabic switch comes from here.
vi.mock('@/core/db/service', () => ({ serviceDb: () => ({ rpc }) }));
vi.mock('../../../messages/ar.json', () => ({ default: { common: { save: 'حفظ' } } }));

type Catalog = { [k: string]: string | Catalog };

describe('the language loader', () => {
  it('gives an Arabic reader the English of every key not yet in Arabic', async () => {
    const config = (await import('@/core/i18n/request')).default as unknown as (p: {
      requestLocale: Promise<string | undefined>;
    }) => Promise<{ locale: string; messages: Catalog }>;
    const { locale, messages } = await config({ requestLocale: Promise.resolve(undefined) });
    const common = messages.common as Catalog;
    expect(locale).toBe('ar');
    expect(common.save).toBe('حفظ');
    expect(common.saveChanges, 'a key with no Arabic arrives in English').toBe('Save changes');
    expect((messages.nav as Catalog | undefined)?.overview, 'a group with no Arabic arrives in English').toBe(
      'Overview',
    );
  });
});
