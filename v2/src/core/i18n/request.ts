import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getMe } from '@/core/auth/get-me';
import { prefsFrom } from '@/core/prefs';
import { effectiveLocale } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';

/**
 * next-intl without URL routing: the locale comes from the person's preference cookie.
 * Arabic stays hidden behind the app.arabic_enabled setting until it is tested (P6-7); the catalog
 * exists from day one so every string has a key (BUILD-PLAN). The door is the exception (F205): nobody is
 * signed in there, so the cookie stands whatever the switch says — signed in, the switch still rules (ACC-139).
 */
export default getRequestConfig(async () => {
  const [store, app, me] = await Promise.all([cookies(), getAppSettings(), getMe().catch(() => null)]);
  const prefs = prefsFrom((n) => store.get(n)?.value);
  // signed in (status ok) the Arabic switch rules; on the door the cookie alone decides
  const locale = me?.status === 'ok' ? effectiveLocale(prefs.locale, app) : prefs.locale;
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: 'Asia/Riyadh' };
});
