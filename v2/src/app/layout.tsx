import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dirOf, prefsFrom } from '@/core/prefs';
import { Hydrated } from '@/core/auth/Hydrated';
import { fontClassNames } from '@/ui/fonts';
import '@/ui/globals.css';

export const metadata: Metadata = {
  title: { default: 'Commercial', template: '%s · Commercial' },
  icons: { icon: '/brand/direct-logo.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const dynamic = 'force-dynamic';

/**
 * The root layout sets theme, density, language and direction on <html> from the person's
 * preferences BEFORE the first paint — no flash of the wrong theme (A5, A13).
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const prefs = prefsFrom((n) => store.get(n)?.value);
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
