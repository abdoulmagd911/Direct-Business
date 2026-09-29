import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { prefsFrom } from '@/core/prefs';
import { effectiveLocale } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';
import { withFallback, type Messages } from './messages';

/**
 * next-intl without URL routing: the locale comes from the person's preference cookie.
 * Arabic stays hidden behind the app.arabic_enabled setting until it is tested (P6-7); the catalog
 * exists from day one so every string has a key (BUILD-PLAN), and English sits beneath it (V410).
 */
export default getRequestConfig(async () => {
  const [store, app] = await Promise.all([cookies(), getAppSettings()]);
  const prefs = prefsFrom((n) => store.get(n)?.value);
  // Arabic only once the owner switches it on (ACC-139): the cookie alone never turns the app Arabic
  const locale = effectiveLocale(prefs.locale, app);
  const en = (await import('../../../messages/en.json')).default as Messages;
  // English beneath every other language: a key not yet in Arabic shows its English (V410).
  const messages =
    locale === 'en' ? en : withFallback((await import(`../../../messages/${locale}.json`)).default as Messages, en);
  return { locale, messages, timeZone: 'Asia/Riyadh' };
});
