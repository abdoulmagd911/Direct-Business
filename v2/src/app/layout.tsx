import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dirOf, prefsFrom } from '@/core/prefs';
import { effectiveLocale } from '@/core/prefs/effective';
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
  const [store, app] = await Promise.all([cookies(), getAppSettings()]);
  const raw = prefsFrom((n) => store.get(n)?.value);
  // the language follows the Arabic switch (ACC-139): a cookie saying Arabic is ignored while it is off
  const prefs = { ...raw, locale: effectiveLocale(raw.locale, app) };
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
