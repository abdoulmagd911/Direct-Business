'use client';
import { useEffect } from 'react';
import { readPrefs, setPref, type Prefs } from '@/core/prefs';

/**
 * Brings the preference cookies in line with what the person should see (ACC-090/091/139). The theme and density have
 * one source — the person's saved profile, then the admin's default — so every tab and every browser shows the same
 * and a change made anywhere arrives on the next page. What it writes is marked as a cache (QA-210): the cookie lets the
 * first paint be right, it never counts as a choice. The language is different: while
 * Arabic is off the cookie is overruled, and a changed language asks for the page again (the words come from the
 * server).
 */
export function PrefsSync({ theme, density, locale }: Pick<Prefs, 'theme' | 'density' | 'locale'>) {
  useEffect(() => {
    const now = readPrefs();
    if (now.theme !== theme) setPref('theme', theme, { cache: true });
    if (now.density !== density) setPref('density', density, { cache: true });
    if (now.locale !== locale) {
      setPref('locale', locale);
      window.location.reload();
    }
  }, [theme, density, locale]);
  return null;
}
