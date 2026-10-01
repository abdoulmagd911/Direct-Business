// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PREF_DEFS,
  SYNCED_COOKIE,
  applyPrefsToDocument,
  dirOf,
  ownChoice,
  prefsFrom,
  readPrefs,
  setPref,
} from '@/core/prefs';
import { serverPrefs } from '@/core/prefs/effective';
import type { AppSettings } from '@/core/settings/app';

describe('core/prefs — the only browser storage (A13)', () => {
  beforeEach(() => {
    for (const d of Object.values(PREF_DEFS)) document.cookie = `${d.cookie}=; max-age=0; path=/`;
    document.cookie = `${SYNCED_COOKIE}=; max-age=0; path=/`;
  });

  it('defaults: Direct theme, comfortable, pinned, English, automatic direction', () => {
    expect(prefsFrom(() => undefined)).toEqual({
      theme: 'direct',
      density: 'comfortable',
      drawer: 'pinned',
      locale: 'en',
      dir: 'auto',
    });
  });

  it('an unknown value falls back to the default instead of leaking into the page', () => {
    expect(prefsFrom((n) => (n === 'v2.theme' ? 'neon' : undefined)).theme).toBe('direct');
  });

  it('setPref refuses a value outside the allow-list', () => {
    // @ts-expect-error — the point of the test
    expect(() => setPref('theme', 'neon')).toThrow();
  });

  it('setPref writes the cookie, mirrors it on <html> and notifies subscribers', () => {
    let notified = 0;
    window.addEventListener('v2:prefs', () => notified++);
    setPref('theme', 'dark');
    setPref('density', 'compact');
    expect(readPrefs().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(notified).toBe(2);
  });

  it('direction follows the locale; the development override wins outside production', () => {
    expect(dirOf(prefsFrom(() => undefined))).toBe('ltr');
    expect(dirOf({ ...prefsFrom(() => undefined), locale: 'ar' })).toBe('rtl');
    expect(dirOf({ ...prefsFrom(() => undefined), dir: 'rtl' })).toBe('rtl');
    applyPrefsToDocument({ ...prefsFrom(() => undefined), dir: 'rtl' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('a value PrefsSync cached is not a choice: the profile still wins, and so does a later change (QA-210)', () => {
    setPref('theme', 'dark', { cache: true });
    const get = (n: string) => document.cookie.match(new RegExp(`(?:^|; )${n.replace(/\./g, '\\.')}=([^;]*)`))?.[1];
    expect(ownChoice('theme', get), 'a cached value is no choice').toBe(false);
    const me = { profile: { theme: 'light', density: null, locale: null } } as never;
    const app: AppSettings = {
      arabic_enabled: false,
      default_theme: 'dark',
      default_density: 'comfortable',
      default_start_page: null,
    };
    expect(serverPrefs(me, app, get).theme, 'the profile beats the cache').toBe('light');
    setPref('theme', 'colorful');
    expect(ownChoice('theme', get), 'a choice made here is one').toBe(true);
    expect(serverPrefs(me, app, get).theme, 'and it beats the profile until it is saved').toBe('colorful');
  });
});
