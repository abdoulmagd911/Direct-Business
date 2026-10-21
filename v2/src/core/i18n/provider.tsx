'use client';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';
import { noRawKey } from './fallback';

/**
 * The app's one client provider. The server hands it the messages; the fallback for a key found nowhere is a function,
 * which a server component cannot pass down, so it is set here (QA-574: the app never draws a raw key).
 */
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Riyadh" getMessageFallback={noRawKey}>
      {children}
    </NextIntlClientProvider>
  );
}
