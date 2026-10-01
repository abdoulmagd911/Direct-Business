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
 * The <html> attributes the server renders (theme, density, language, direction) — the same three sources in the same
 * order as PrefsSync: this browser's own choice (a cookie), the person's saved profile, the admin's default. Rendered
 * this way, a refresh that lands after PrefsSync has written the cookie never snaps the theme back (QA-126).
 */
export function serverPrefs(me: Me | null, app: AppSettings, get: (name: string) => string | undefined): Prefs {
  const raw = prefsFrom(get);
  const own = (key: 'theme' | 'density') => ownChoice(key, get);
  const eff = effectivePrefs(me, app, raw);
  return {
    ...raw,
    theme: own('theme') ? raw.theme : eff.theme,
    density: own('density') ? raw.density : eff.density,
    locale: effectiveLocale(raw.locale, app),
  };
}
