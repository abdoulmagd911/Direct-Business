'use client';
import { useEffect } from 'react';
import { prefIsSet, readPrefs, setPref, type Prefs } from '@/core/prefs';

/**
 * Brings the preference cookies in line with what the person should see (ACC-090/091/139). Three sources, in order:
 * this browser's own choice (a cookie the profile menu or My profile set), the person's saved profile, the admin's
 * defaults — so a browser with no choice of its own gets the profile's or the admin's theme and density the first time
 * it opens the app, and a choice made in the menu is never undone on the next page. What it copies is marked as a
 * cache (QA-210): it never counts as a choice, so a later change to the profile or the admin's default still arrives. The language is different: while
 * Arabic is off the cookie is overruled, and a changed language asks for the page again (the words come from the
 * server).
 */
export function PrefsSync({ theme, density, locale }: Pick<Prefs, 'theme' | 'density' | 'locale'>) {
  useEffect(() => {
    const now = readPrefs();
    if (!prefIsSet('theme') && now.theme !== theme) setPref('theme', theme, { cache: true });
    if (!prefIsSet('density') && now.density !== density) setPref('density', density, { cache: true });
    if (now.locale !== locale) {
      setPref('locale', locale);
      window.location.reload();
    }
  }, [theme, density, locale]);
  return null;
}
