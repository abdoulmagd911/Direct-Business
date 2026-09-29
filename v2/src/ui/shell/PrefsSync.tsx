'use client';
import { useEffect } from 'react';
import { readPrefs, setPref, type Prefs } from '@/core/prefs';

/**
 * Keeps the preference cookies (the cache) in line with what the person should see — their profile, or the admin's
 * defaults (ACC-090/091/139): where a cookie differs, it is set and the page's theme, density and direction change at
 * once. A changed language asks for the page again, since the words come from the server.
 */
export function PrefsSync({ theme, density, locale }: Pick<Prefs, 'theme' | 'density' | 'locale'>) {
  useEffect(() => {
    const now = readPrefs();
    if (now.theme !== theme) setPref('theme', theme);
    if (now.density !== density) setPref('density', density);
    if (now.locale !== locale) {
      setPref('locale', locale);
      window.location.reload();
    }
  }, [theme, density, locale]);
  return null;
}
