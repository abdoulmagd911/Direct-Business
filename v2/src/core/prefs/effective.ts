import type { Me } from '@/core/auth/me';
import type { AppSettings } from '@/core/settings/app';
import { PREF_DEFS, ownChoice, prefsFrom, readTheme, type Prefs } from './index';

/**
 * What the screen should show for a signed-in person (ACC-090/091/139): their own profile choice first, then the
 * admin's default, then the registry's; the language is the workspace's — English while Arabic is off (V122), Arabic
 * while it is on — unless the person chose their own (personLocale).
 * The cookies are only this answer's cache (core/prefs) — PrefsSync brings them in line.
 */
export function effectivePrefs(me: Me | null, app: AppSettings): Pick<Prefs, 'theme' | 'density' | 'locale'> {
  const profile = me?.profile ?? null;
  const theme = readTheme(profile?.theme) ?? app.default_theme;
  const density = profile?.density ?? app.default_density;
  const locale = personLocale(profile?.locale, app);
  return { theme, density, locale };
}

/**
 * The language a signed-in person is answered in — ONE rule for the words (core/i18n/request.ts), the page's
 * direction (serverPrefs), the cookie PrefsSync keeps and the one My profile keeps:
 *   - Arabic off (Settings → App → Arabic): English, whatever anyone chose;
 *   - Arabic on: the workspace's language IS Arabic. A person who chose their own language (the Arabic card's
 *     "Your language", the profile menu, My profile — saved in their profile) keeps it, English or Arabic; a person
 *     who never chose (no profile, or no language in it) is answered in Arabic.
 * The cookie is not part of the rule (Landing 34b): it is only this answer's cache, so the same person reads the same
 * language on every device from the first paint. Before, a person who had not chosen followed the cookie — English on
 * every device that had never been told otherwise — so turning Arabic on switched nothing for anyone.
 */
export function personLocale(
  profileLocale: Prefs['locale'] | null | undefined,
  app: Pick<AppSettings, 'arabic_enabled'>,
): Prefs['locale'] {
  if (!app.arabic_enabled) return 'en';
  return profileLocale === 'ar' || profileLocale === 'en' ? profileLocale : 'ar';
}

/** The language a request is answered in: the cookie's choice, unless Arabic is switched off (ACC-139). */
export function effectiveLocale(cookieLocale: Prefs['locale'], app: AppSettings): Prefs['locale'] {
  return app.arabic_enabled ? cookieLocale : 'en';
}

/**
 * The <html> attributes the server renders (theme, density, language, direction). For a signed-in person the theme and
 * density have ONE source: their saved profile, then the admin's default — the same in every tab and every browser, and
 * right before the first paint. The cookies are only that answer's cache (PrefsSync keeps them in line), never a rival
 * choice: a browser that once held its own value would otherwise show it for ever, light here and dark there. The door
 * (nobody signed in) has no profile, so a value this browser holds still stands there.
 */
export function serverPrefs(me: Me | null, app: AppSettings, get: (name: string) => string | undefined): Prefs {
  const raw = prefsFrom(get);
  const own = (key: 'theme' | 'density') => !me && ownChoice(key, get);
  const eff = effectivePrefs(me, app);
  // Before sign-in (Landing 31, the theme-switcher rules): the theme last used on this device — its cookie, a choice
  // made here or the cache of the last person's — and on a first visit, with no cookie at all, the device's own
  // light or dark setting (System).
  const lastUsed = get(PREF_DEFS.theme.cookie) !== undefined;
  const doorTheme = own('theme') || lastUsed ? raw.theme : 'system';
  return {
    ...raw,
    theme: me ? eff.theme : doorTheme,
    density: own('density') ? raw.density : eff.density,
    // the door (nobody signed in) has no profile, so the cookie's language stands there whatever the Arabic
    // switch says (F205); signed in, the switch rules and then the person's own choice (personLocale)
    locale: me ? eff.locale : raw.locale,
  };
}
