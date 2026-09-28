// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PREF_DEFS, applyPrefsToDocument, dirOf, prefsFrom, readPrefs, setPref } from '@/core/prefs';

describe('core/prefs — the only browser storage (A13)', () => {
  beforeEach(() => {
    for (const d of Object.values(PREF_DEFS)) document.cookie = `${d.cookie}=; max-age=0; path=/`;
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
});
