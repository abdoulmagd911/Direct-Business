import localFont from 'next/font/local';

/** Self-hosted OFL fonts (public/fonts). No font CDN — the old DirectFont trouble (spec §1). */
export const fontUi = localFont({
  variable: '--font-ui',
  display: 'swap',
  src: [
    { path: '../../public/fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
    {
      path: '../../public/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
});

export const fontDisplay = localFont({
  variable: '--font-display',
  display: 'swap',
  src: [
    { path: '../../public/fonts/readex-pro-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/readex-pro-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/readex-pro-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/readex-pro-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/readex-pro-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/readex-pro-arabic-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/readex-pro-arabic-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/readex-pro-arabic-700-normal.woff2', weight: '700', style: 'normal' },
  ],
});

export const fontData = localFont({
  variable: '--font-data',
  display: 'swap',
  src: [
    { path: '../../public/fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
});

export const fontClassNames = `${fontUi.variable} ${fontDisplay.variable} ${fontData.variable}`;
