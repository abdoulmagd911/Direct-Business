import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { prefsFrom } from '@/core/prefs';
import { arabicEnabled, effectiveLocale } from './arabic';
import { withFallback, type Messages } from './messages';

/**
 * next-intl without URL routing: the locale comes from the person's preference cookie — Arabic only while the owner
 * has it switched on (`app.arabic_enabled`, V122, P6-7; QA-105), so an `ar` cookie alone shows English. The catalog
 * exists from day one so every string has a key (BUILD-PLAN), and English sits beneath it (V410).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const prefs = prefsFrom((n) => store.get(n)?.value);
  // The switch is read only for someone who chose Arabic: English readers cost no extra round trip.
  const locale = effectiveLocale(prefs.locale, prefs.locale === 'ar' && (await arabicEnabled()));
  const en = (await import('../../../messages/en.json')).default as Messages;
  // English beneath every other language: a key not yet in Arabic shows its English (V410).
  const messages =
    locale === 'en' ? en : withFallback((await import(`../../../messages/${locale}.json`)).default as Messages, en);
  return { locale, messages, timeZone: 'Asia/Riyadh' };
});
