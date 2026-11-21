'use client';
import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';
import { readPrefs, setPref, type Locale, type Prefs } from '@/core/prefs';
import { followLanguage } from '@/core/prefs/sync';

/**
 * Brings the preference cookies in line with what the person should see (ACC-090/091/139). The theme and density have
 * one source — the person's saved profile, then the admin's default — so every tab and every browser shows the same
 * and a change made anywhere arrives on the next page. What it writes is marked as a cache (QA-210): the cookie lets the
 * first paint be right, it never counts as a choice. The language has one rule too (personLocale, core/prefs/effective):
 * English while Arabic is off; while it is on, the person's own saved choice, and Arabic for a person who made none.
 * The cookie only follows that answer, never the other way. And when the answer is no longer the language this page
 * was loaded in — an admin has just turned Arabic on or off (the save refreshes the layout, which answers again), or
 * the person arrived from the sign-in page, which follows its own button — the page is asked for again, once: the
 * words come from the server. That one reload is what switches the admin's own screen right after the save. A page
 * the server already drew in the right language is never loaded twice (a first visit on a new device only gets its
 * cookie written).
 */
export function PrefsSync({ theme, density, locale }: Pick<Prefs, 'theme' | 'density' | 'locale'>) {
  // the language this page was loaded in (the root layout's, kept for as long as the shell stays up)
  const loadedIn = useRef(useLocale() as Locale);
  useEffect(() => {
    const now = readPrefs();
    if (now.theme !== theme) setPref('theme', theme, { cache: true });
    if (now.density !== density) setPref('density', density, { cache: true });
    followLanguage(locale, loadedIn.current, {
      cookie: now.locale,
      set: (l) => setPref('locale', l),
      reload: () => window.location.reload(),
    });
  }, [theme, density, locale]);
  return null;
}
