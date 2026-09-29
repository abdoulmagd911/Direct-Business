import type { Me } from '@/core/auth/me';
import type { AppSettings } from '@/core/settings/app';
import type { Prefs } from './index';

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
