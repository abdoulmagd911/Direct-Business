import type { Me } from '@/core/auth/me';
import type { AppSettings } from '@/core/settings/app';
import { ownChoice, prefsFrom, type Prefs } from './index';

/**
 * What the screen should show for a signed-in person (ACC-090/091/139): their own profile choice first, then the
 * admin's default, then the registry's; the language is English whatever the cookie says while Arabic is off (V122).
 * The cookies are only this answer's cache (core/prefs) — PrefsSync brings them in line.
 */
export function effectivePrefs(
  me: Me | null,
  app: AppSettings,
  cookies: Prefs,
): Pick<Prefs, 'theme' | 'density' | 'locale'> {
  const profile = me?.profile ?? null;
  const theme = profile?.theme ?? app.default_theme;
  const density = profile?.density ?? app.default_density;
  const wanted = profile?.locale ?? cookies.locale;
  const locale = app.arabic_enabled ? wanted : 'en';
  return { theme, density, locale };
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
  const eff = effectivePrefs(me, app, raw);
  return {
    ...raw,
    theme: own('theme') ? raw.theme : eff.theme,
    density: own('density') ? raw.density : eff.density,
    locale: effectiveLocale(raw.locale, app),
  };
}
