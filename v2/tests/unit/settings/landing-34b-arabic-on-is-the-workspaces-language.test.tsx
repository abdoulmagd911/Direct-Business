// @vitest-environment jsdom
/**
 * Landing 34b — "Make the organisation Arabic setting switch the UI too" (the owner, after the live test).
 * Turning Arabic On in Settings → App switched nothing: a person was answered in Arabic only once they had chosen it
 * themselves, because the rule (personLocale) fell back to the browser's cookie — English on every device nobody had
 * told otherwise. Now, while Arabic is on, the workspace's language IS Arabic: a person who chose their own language
 * keeps it (English or Arabic), a person who never chose reads Arabic, right to left, from the first paint on every
 * device; Off puts everyone back in English; the sign-in page still follows its own button. The admin's own screen
 * switches right after the save — the layout answers again and the page is loaded once more in the new language —
 * and My profile, which writes the language cookie on every visit, follows the same one rule and never flips a
 * person back to English. The Arabic card says what the switch does, in plain words, in both languages.
 * Every value is made up.
 * Sabotage: tests/sabotage/landing-34b-people.mjs "arabic-on-still-follows-the-cookie",
 * "a-chosen-english-is-overruled-by-arabic-on", "the-switch-needs-a-second-load",
 * "a-page-in-the-right-language-is-loaded-twice", "the-language-cookie-is-left-behind",
 * "my-profile-flips-the-language-back-to-english", "the-arabic-card-does-not-say-what-it-does",
 * "the-door-follows-the-switch", "the-shell-never-writes-the-language-cookie".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { MeProvider } from '../../../src/core/auth/me-context';
import { PREF_DEFS, SYNCED_COOKIE, dirOf, readPrefs, setPref, type Locale } from '../../../src/core/prefs';
import { effectivePrefs, serverPrefs } from '../../../src/core/prefs/effective';
import { followLanguage } from '../../../src/core/prefs/sync';
import { APP_DEFAULTS } from '../../../src/core/settings/app';
import { MyProfile } from '../../../src/modules/org/screens/MyProfile';
import type { SettingDefRow } from '../../../src/modules/settings/schema';
import { SettingCard } from '../../../src/modules/settings/screens/SettingCard';
import { PrefsSync } from '../../../src/ui/shell/PrefsSync';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
// the screen's password section is a server action: keep it out of this render test
vi.mock('@/core/auth/password-actions', () => ({ changePassword: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ON = { ...APP_DEFAULTS, arabic_enabled: true };
const OFF = { ...APP_DEFAULTS, arabic_enabled: false };
const meWith = (locale: Locale | null | 'no-profile') =>
  ({
    status: 'ok',
    session: {
      device_id: 'd1',
      signed_in_at: '2026-01-01T00:00:00Z',
      last_seen_at: '2026-01-01T00:00:00Z',
      email: 'made.up@example.test',
    },
    person: {
      id: 'p1',
      kind: 'staff',
      full_name_en: 'Made Up',
      full_name_ar: null,
      nickname_en: null,
      nickname_ar: null,
      job_title_en: null,
      job_title_ar: null,
      department_id: 'd1',
      team_id: null,
      manager_id: null,
      role: { id: 'r1', key: 'member', name_en: 'Member', name_ar: 'عضو', is_admin: false },
    },
    levels: {},
    capabilities: [],
    departments: ['d1'],
    profile:
      locale === 'no-profile'
        ? null
        : {
            display_name_en: 'Made Up',
            display_name_ar: null,
            avatar_file_id: null,
            avatar_color: null,
            badge_kind: 'none',
            badge_value: null,
            theme: null,
            density: null,
            locale,
            start_page: null,
            drawer_pinned: null,
            notify: null,
            version: 1,
          },
  }) as unknown as Me;
const cookieSays = (locale: Locale | null) => (n: string) => (n === 'v2.locale' ? (locale ?? undefined) : undefined);

describe('with Arabic on, the workspace’s language is Arabic', () => {
  it('a person who never chose is answered in Arabic, right to left, whatever the device’s cookie says', () => {
    for (const me of [meWith(null), meWith('no-profile')])
      for (const cookie of [null, 'en', 'ar'] as const) {
        const prefs = serverPrefs(me, ON, cookieSays(cookie));
        expect(prefs.locale, `cookie ${cookie}`).toBe('ar');
        expect(dirOf(prefs), `cookie ${cookie}`).toBe('rtl');
        expect(effectivePrefs(me, ON).locale).toBe('ar');
      }
  });

  it('a person who chose keeps their choice, English or Arabic, whatever the cookie says', () => {
    for (const cookie of [null, 'en', 'ar'] as const) {
      const english = serverPrefs(meWith('en'), ON, cookieSays(cookie));
      expect(english.locale, `chose English, cookie ${cookie}`).toBe('en');
      expect(dirOf(english)).toBe('ltr');
      const arabic = serverPrefs(meWith('ar'), ON, cookieSays(cookie));
      expect(arabic.locale, `chose Arabic, cookie ${cookie}`).toBe('ar');
      expect(dirOf(arabic)).toBe('rtl');
    }
  });

  it('with Arabic off everyone is back in English, whatever they chose and whatever the cookie says', () => {
    for (const me of [meWith(null), meWith('no-profile'), meWith('en'), meWith('ar')])
      for (const cookie of [null, 'en', 'ar'] as const) {
        const prefs = serverPrefs(me, OFF, cookieSays(cookie));
        expect(prefs.locale).toBe('en');
        expect(dirOf(prefs)).toBe('ltr');
      }
  });

  it('the sign-in page (nobody signed in) keeps following its own button, whatever the switch says', () => {
    for (const app of [ON, OFF]) {
      expect(serverPrefs(null, app, cookieSays(null)).locale).toBe('en');
      expect(serverPrefs(null, app, cookieSays('en')).locale).toBe('en');
      expect(serverPrefs(null, app, cookieSays('ar')).locale).toBe('ar');
    }
  });
});

describe('the screen follows the language the person should read', () => {
  const run = (want: Locale, loadedIn: Locale, cookie: Locale) => {
    const did: string[] = [];
    followLanguage(want, loadedIn, {
      cookie,
      set: (l) => did.push(`cookie:${l}`),
      reload: () => did.push('reload'),
    });
    return did;
  };

  it('the admin turns Arabic on: the cookie is written and the page is loaded once more, in Arabic', () => {
    expect(run('ar', 'en', 'en')).toEqual(['cookie:ar', 'reload']);
  });

  it('the admin turns Arabic off: back to English the same way', () => {
    expect(run('en', 'ar', 'ar')).toEqual(['cookie:en', 'reload']);
  });

  it('an admin who chose English turns Arabic on: nothing changes on their screen', () => {
    expect(run('en', 'en', 'en')).toEqual([]);
  });

  it('a page already drawn in the right language is never loaded twice — a new device only gets its cookie', () => {
    expect(run('ar', 'ar', 'en')).toEqual(['cookie:ar']);
    expect(run('ar', 'ar', 'ar')).toEqual([]);
    expect(run('en', 'en', 'ar')).toEqual(['cookie:en']);
  });

  it('a page in another language than the cookie already says is still loaded again', () => {
    // arriving from the sign-in page, drawn in its own language, with the cookie already right
    expect(run('ar', 'en', 'ar')).toEqual(['reload']);
  });
});

describe('the shell keeps the language cookie in line (PrefsSync)', () => {
  let root: Root | null = null;
  beforeEach(() => {
    for (const d of Object.values(PREF_DEFS)) document.cookie = `${d.cookie}=; max-age=0; path=/`;
    document.cookie = `${SYNCED_COOKIE}=; max-age=0; path=/`;
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });

  it('a new device of a person who reads Arabic gets the Arabic cookie, and the page turns right to left', () => {
    expect(readPrefs().locale, 'the device held no language').toBe('en');
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
          <PrefsSync theme="light" density="comfortable" locale="ar" />
        </NextIntlClientProvider>,
      );
    });
    expect(readPrefs().locale).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });
});

describe('My profile keeps the language cookie by the same rule', () => {
  let root: Root | null = null;
  beforeEach(() => {
    for (const d of Object.values(PREF_DEFS)) document.cookie = `${d.cookie}=; max-age=0; path=/`;
    document.cookie = `${SYNCED_COOKIE}=; max-age=0; path=/`;
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });
  const visit = (me: Me, arabicEnabled: boolean, shown: Locale) => {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <NextIntlClientProvider locale={shown} messages={shown === 'ar' ? ar : en} timeZone="Asia/Riyadh">
          <MeProvider me={me}>
            <MyProfile me={me} devices={[]} arabicEnabled={arabicEnabled} />
          </MeProvider>
        </NextIntlClientProvider>,
      );
    });
    return readPrefs().locale;
  };

  it('a person who chose no language is not flipped back to English by a visit while Arabic is on', () => {
    setPref('locale', 'ar');
    expect(visit(meWith(null), true, 'ar')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('nor is a person with no profile at all, on a device that never held a language', () => {
    expect(visit(meWith('no-profile'), true, 'ar')).toBe('ar');
  });

  it('a person who chose English keeps English there, and one who chose Arabic keeps Arabic', () => {
    setPref('locale', 'ar');
    expect(visit(meWith('en'), true, 'en')).toBe('en');
    act(() => root?.unmount());
    root = null;
    expect(visit(meWith('ar'), true, 'ar')).toBe('ar');
  });

  it('while Arabic is off the cookie is English, even for a person whose profile says Arabic', () => {
    setPref('locale', 'ar');
    expect(visit(meWith('ar'), false, 'en')).toBe('en');
    act(() => root?.unmount());
    root = null;
    expect(visit(meWith(null), false, 'en')).toBe('en');
  });
});

describe('the Arabic card says what the switch does', () => {
  const def = (value: boolean, key = 'app.arabic_enabled'): SettingDefRow => ({
    key,
    label_key: 'setting.app.arabic_enabled',
    schema: { type: 'boolean' },
    default: false,
    effective_dated: false,
    value,
    rows: [],
  });
  const card = (d: SettingDefRow, locale: Locale = 'en') =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <SettingCard def={d} departments={[]} canEdit today="2026-11-20" />
      </NextIntlClientProvider>,
    );
  const says = (markup: string) => markup.match(/<p[^>]*data-setting-says[^>]*>(.*?)<\/p>/)?.[1] ?? null;

  it('in plain English, on and off', () => {
    const words =
      'When on, the workspace opens in Arabic for everyone who has not chosen their own language. Each person can still choose English or العربية for themselves.';
    expect(says(card(def(true)))).toBe(words);
    expect(says(card(def(false)))).toBe(words);
  });

  it('in plain Arabic', () => {
    expect(says(card(def(true), 'ar'))).toBe(
      'عند التشغيل، تُفتح مساحة العمل بالعربية لكل من لم يختر لغته بنفسه. ويبقى لكل شخص أن يختار English أو العربية لنفسه.',
    );
  });

  it('no other setting carries those words', () => {
    expect(says(card(def(true, 'app.made_up_switch')))).toBeNull();
  });
});
