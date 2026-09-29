import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dirOf } from '@/core/prefs';
import { serverPrefs } from '@/core/prefs/effective';
import { getMe } from '@/core/auth/get-me';
import { getAppSettings } from '@/core/settings/app';
import { Hydrated } from '@/core/auth/Hydrated';
import { fontClassNames } from '@/ui/fonts';
import '@/ui/globals.css';

// The tab icon is the orange mark on a slate rounded square: src/app/icon.svg (32), favicon.ico (16 + 32) and
// apple-icon.png (180) — Next serves them at /icon.svg, /favicon.ico and /apple-icon.png and lists them in <head>.
export const metadata: Metadata = {
  title: { default: 'Commercial', template: '%s · Commercial' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const dynamic = 'force-dynamic';

/**
 * The root layout sets theme, density, language and direction on <html> from the person's
 * preferences BEFORE the first paint — no flash of the wrong theme (A5, A13).
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  // one api.me() per request (cached; null on the door) — the profile's theme and density stand in for a missing cookie
  const [store, app, answer] = await Promise.all([cookies(), getAppSettings(), getMe().catch(() => null)]);
  const me = answer?.status === 'ok' ? answer : null;
  // the language follows the Arabic switch (ACC-139): a cookie saying Arabic is ignored while it is off
  const prefs = serverPrefs(me, app, (n) => store.get(n)?.value);
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      dir={dirOf(prefs)}
      data-theme={prefs.theme}
      data-density={prefs.density}
      className={fontClassNames}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Riyadh">
          {children}
          <Hydrated />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
