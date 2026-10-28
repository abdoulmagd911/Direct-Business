/**
 * V656: while the owner is signed in as a TEST user, a bar at the top says "TEST user: [name] (you are [owner])" in the
 * language of the screen and offers Back to my account; the People page offers Sign in as test user to admins on TEST
 * rows only; a refusal of the server is said in plain words, in English and in Arabic. Made-up names.
 * Sabotage: tests/sabotage/test-switch.mjs.
 */
import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';
import type { Me } from '../../../src/core/auth/me';
import { DbError } from '../../../src/core/db/errors';
import { errorKey } from '../../../src/core/db/words';
import { offersSwitch } from '../../../src/core/test-switch/offer';
import { TestSwitchBarView, testSwitchNames } from '../../../src/ui/shell/TestSwitchBar';

const me = (over: Partial<Me> = {}) =>
  ({
    status: 'ok',
    test_switch: { by_id: 'o1', by_name_en: 'Made-up Owner', by_name_ar: 'مالك تجريبي', since: '2026-10-28T10:00:00Z' },
    person: { id: 't1', full_name_en: 'TEST Manager', full_name_ar: 'تجريبي مدير', role: { is_admin: false } },
    ...over,
  }) as unknown as Me;

const tr = (locale: 'en' | 'ar') => createTranslator({ locale, messages: locale === 'en' ? en : ar });

describe('the bar at the top while signed in as a TEST user', () => {
  it('names the TEST user and the owner, in English and in Arabic', () => {
    for (const locale of ['en', 'ar'] as const) {
      const t = tr(locale);
      const names = testSwitchNames(me(), locale);
      const line = t('testSwitch.bar', names);
      expect(line).toContain(names.name);
      expect(line).toContain(names.owner);
      expect(names.name).toBe(locale === 'en' ? 'TEST Manager' : 'تجريبي مدير');
      expect(names.owner).toBe(locale === 'en' ? 'Made-up Owner' : 'مالك تجريبي');
    }
    expect(tr('en')('testSwitch.bar', testSwitchNames(me(), 'en'))).toBe(
      'TEST user: TEST Manager (you are Made-up Owner)',
    );
  });
  it('falls back to the English name where there is no Arabic one', () => {
    const noAr = me({
      test_switch: { by_id: 'o1', by_name_en: 'Made-up Owner', by_name_ar: null, since: '2026-10-28T10:00:00Z' },
    });
    expect(testSwitchNames(noAr, 'ar').owner).toBe('Made-up Owner');
  });
  it('draws the line and a Back to my account button', () => {
    const t = tr('en');
    const html = renderToStaticMarkup(
      <TestSwitchBarView
        line={t('testSwitch.bar', testSwitchNames(me(), 'en'))}
        back={t('testSwitch.back')}
        onBack={() => {}}
      />,
    );
    expect(html).toContain('data-test-switch-bar');
    expect(html).toContain('TEST user: TEST Manager (you are Made-up Owner)');
    expect(html).toContain('Back to my account');
    expect(html).toContain('data-test-switch-back');
  });
});

describe('Sign in as test user on the People page', () => {
  const admin = { person: { role: { is_admin: true } } } as unknown as Me;
  const member = { person: { role: { is_admin: false } } } as unknown as Me;
  it('is offered to an admin on a TEST row', () => {
    expect(offersSwitch(admin, { is_test: true })).toBe(true);
  });
  it('is not offered on a real colleague, nor to someone who is not an admin', () => {
    expect(offersSwitch(admin, { is_test: false })).toBe(false);
    expect(offersSwitch(admin, {})).toBe(false);
    expect(offersSwitch(member, { is_test: true })).toBe(false);
  });
});

describe('a refusal of the switch is said in plain words', () => {
  const refusals = ['not_allowed', 'not_a_test_user', 'already_switched', 'no_access_change'];
  it('has its own line in English and in Arabic, never a general one or a key', () => {
    for (const locale of ['en', 'ar'] as const) {
      const t = tr(locale);
      for (const r of refusals) {
        const e = new DbError('PermissionDenied', `test_switch.${r}`);
        const { key, detail } = errorKey(e, (k) => t.has(k as never));
        expect(key).toBe(`errors.test_switch.${r}`);
        const words = (t as unknown as (k: string, v: object) => string)(key, { detail });
        expect(words).not.toContain('test_switch');
        expect(words.length).toBeGreaterThan(10);
      }
    }
  });
  it("says test_switch.not_allowed as only the owner's account", () => {
    expect(tr('en')('errors.test_switch.not_allowed')).toBe("Only the owner's account can sign in as a test user.");
  });
});

describe('the two presses call the server and start the page over', () => {
  it('Sign in as test user calls test_switch_start for that person, then opens the start page', async () => {
    const calls: unknown[][] = [];
    const page = { went: [] as string[], reloaded: 0 };
    vi.resetModules();
    vi.doMock('../../../src/core/db/rpc', () => ({
      rpc: async (...args: unknown[]) => {
        calls.push(args);
        return {};
      },
    }));
    const { switchStart, switchEnd } = await import('../../../src/core/test-switch/use-test-switch');
    const starter = { go: (p: string) => page.went.push(p), reload: () => (page.reloaded += 1) };
    await switchStart('person-1', starter);
    expect(calls).toEqual([['test_switch_start', { p_person: 'person-1' }]]);
    expect(page.went).toEqual(['/']);
    await switchEnd(starter);
    expect(calls[1]?.[0]).toBe('test_switch_end');
    expect(page.reloaded).toBe(1);
  });
  it('a refusal leaves the page where it is', async () => {
    const page = { went: [] as string[], reloaded: 0 };
    vi.resetModules();
    vi.doMock('../../../src/core/db/rpc', () => ({
      rpc: async () => {
        throw new DbError('PermissionDenied', 'test_switch.not_allowed');
      },
    }));
    const { switchStart, switchEnd } = await import('../../../src/core/test-switch/use-test-switch');
    const starter = { go: (p: string) => page.went.push(p), reload: () => (page.reloaded += 1) };
    await expect(switchStart('person-1', starter)).rejects.toMatchObject({ key: 'test_switch.not_allowed' });
    await expect(switchEnd(starter)).rejects.toBeInstanceOf(DbError);
    expect(page.went).toEqual([]);
    expect(page.reloaded).toBe(0);
  });
});
