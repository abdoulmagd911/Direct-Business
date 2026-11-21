import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getMe } from '@/core/auth/get-me';
import { prefsFrom } from '@/core/prefs';
import { personLocale } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';

/**
 * next-intl without URL routing: signed in, the locale is the workspace's language — English while the
 * app.arabic_enabled setting is off, Arabic while it is on — unless the person saved their own (personLocale). The
 * catalog exists from day one so every string has a key (BUILD-PLAN). The door is the exception (F205): nobody is
 * signed in there, so the cookie its own language button writes stands, whatever the switch says.
 */
export default getRequestConfig(async () => {
  const [store, app, me] = await Promise.all([cookies(), getAppSettings(), getMe().catch(() => null)]);
  const prefs = prefsFrom((n) => store.get(n)?.value);
  // signed in (status ok) the Arabic switch rules, then the language saved in the person's profile, and without one
  // the workspace's (personLocale — the same rule the layout and <html dir> follow); on the door the cookie decides
  const locale = me?.status === 'ok' ? personLocale(me.profile?.locale, app) : prefs.locale;
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: 'Asia/Riyadh' };
});
