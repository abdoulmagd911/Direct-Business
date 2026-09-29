import 'server-only';

import { cache } from 'react';
import { serverDb } from '@/core/db/server';
import type { Locale } from '@/core/prefs';

/**
 * Arabic is shown only when the owner has switched it on (`app.arabic_enabled`, V122, P6-7) — a stored `ar` choice
 * alone never shows it (QA-105; the scenario catalogue's ACC-129/139). The switch is read through
 * `api.app_flags()`, which answers before sign-in too (the sign-in page has a language switch once Arabic is on).
 * Any failure to read it — no answer, an error, the function not there yet — reads as off: Arabic stays hidden.
 * One read per request (React's cache), and none for a person who reads English.
 */
export const arabicEnabled = cache(async (): Promise<boolean> => {
  try {
    const db = await serverDb();
    const { data, error } = await db.rpc('app_flags' as never);
    if (error) return false;
    return (data as { arabic_enabled?: unknown } | null)?.arabic_enabled === true;
  } catch {
    return false;
  }
});

/** The language a person reads: Arabic only when they chose it and it is switched on; English otherwise. */
export function effectiveLocale(chosen: Locale, enabled: boolean): Locale {
  return chosen === 'ar' && enabled ? 'ar' : 'en';
}
