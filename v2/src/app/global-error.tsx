'use client';
import { NextIntlClientProvider } from 'next-intl';
import en from '../../messages/en.json';
import { fontClassNames } from '@/ui/fonts';
import RootError from './error';
import '@/ui/globals.css';

/**
 * The last boundary (QA-184): the root layout itself failed, so this page brings its own <html> and <body>, the app
 * font and stylesheet, and the English words (the language cookie is the root layout's, and it did not run).
 */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" dir="ltr" data-theme="direct" data-density="comfortable" className={fontClassNames}>
      <body>
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
          <RootError {...props} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
