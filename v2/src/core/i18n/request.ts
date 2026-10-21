import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { prefsFrom } from '@/core/prefs';
import { effectiveLocale } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';
import { noRawKey, withEnglishFallback } from './fallback';

/**
 * next-intl without URL routing: the locale comes from the person's preference cookie.
 * Arabic stays hidden behind the app.arabic_enabled setting until it is tested (P6-7); the catalog
 * exists from day one so every string has a key (BUILD-PLAN).
 */
export default getRequestConfig(async () => {
  const [store, app] = await Promise.all([cookies(), getAppSettings()]);
  const prefs = prefsFrom((n) => store.get(n)?.value);
  // Arabic only once the owner switches it on (ACC-139): the cookie alone never turns the app Arabic
  const locale = effectiveLocale(prefs.locale, app);
  const english = (await import('../../../messages/en.json')).default;
  // a line with no Arabic yet reads in English, and a key in neither draws nothing — never the raw key (QA-574)
  const messages =
    locale === 'en'
      ? english
      : withEnglishFallback(english, (await import(`../../../messages/${locale}.json`)).default);
  return { locale, messages, timeZone: 'Asia/Riyadh', getMessageFallback: noRawKey };
});
