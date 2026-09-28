import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import en from '../../messages/en.json';

export const metadata: Metadata = {
  title: en.app.name,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
